const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const ai = require('./ai');
const { getConfig, saveConfig, getDataPaths, initDataDirs, isGitRepo } = require('./config');
const gitSync = require('./git-sync');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Paths
const ROOT_DIR = path.resolve(__dirname, '../../');
const PYTHON_PATH = path.join(ROOT_DIR, '.venv/bin/python3');

// Get dynamic paths from config
const getSourcesDir = () => path.join(getDataPaths().uploadsPath, 'sources');
const getStorageDir = () => getDataPaths().storagePath;

// Initialize data directories
initDataDirs();
const sourcesDir = getSourcesDir();
if (!fs.existsSync(sourcesDir)) fs.mkdirSync(sourcesDir, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow larger payloads for JSON edits

// Serve static media (including screenshots) - dynamic path
app.use('/media', (req, res, next) => {
    express.static(getStorageDir())(req, res, next);
});
// Screenshots are served via /media/{id}/screenshots/slide_XXXX.png

// Configure Multer with dynamic destination
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = getSourcesDir();
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const id = uuidv4();
        const filename = `${id}${path.extname(file.originalname)}`;
        req.fileId = id;
        cb(null, filename);
    }
});
const upload = multer({ storage: storage });
const memUpload = multer({ storage: multer.memoryStorage() });

// Helper to trigger git sync after data changes
async function triggerGitSync(action) {
    try {
        const result = await gitSync.sync(action);
        if (result.success) {
            console.log(`Git sync completed for: ${action}`);
        }
    } catch (e) {
        console.error(`Git sync failed for ${action}:`, e.message);
    }
}

// --- API ROUTES ---

// 1. Upload and Convert
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const id = req.fileId;
    const generateScreenshots = req.body.generateScreenshots === 'true';
    const collectionId = req.body.collectionId || null;
    const folderId = req.body.folderId || null;
    db.addPresentation(id, req.file.filename, req.file.originalname, { collectionId, folderId });
    const outputDir = path.join(getStorageDir(), id);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    runConversion(id, req.file.path, outputDir, { generateScreenshots });
    triggerGitSync('upload presentation');
    res.json({ id: id, status: 'processing', filename: req.file.originalname, generateScreenshots });
});

function runConversion(id, inputPath, outputDir, options = {}) {
    db.updateStatus(id, 'processing');
    const pythonProcess = spawn(PYTHON_PATH, [
        '-m', 'src.ppt_to_learning.cli',
        '--input', inputPath,
        '--output', outputDir,
        '--verbose'
    ], { cwd: ROOT_DIR });

    pythonProcess.on('close', (code) => {
        db.updateStatus(id, code === 0 ? 'completed' : 'failed');

        // Extract metadata from output JSON
        if (code === 0) {
            try {
                const jsonDir = path.join(outputDir, 'json');
                const jsonFiles = fs.readdirSync(jsonDir).filter(f => f.endsWith('.json'));
                if (jsonFiles.length > 0) {
                    const jsonPath = path.join(jsonDir, jsonFiles[0]);
                    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                    if (data.metadata) {
                        db.updateMetadata(id, data.metadata);
                    }
                }
            } catch (e) {
                console.error(`Failed to extract metadata for ${id}:`, e.message);
            }
        }

        // Optionally generate screenshots after conversion completes
        if (code === 0 && options.generateScreenshots) {
            runScreenshotGeneration(id, inputPath, outputDir);
        }
    });
}

function runScreenshotGeneration(id, inputPath, outputDir) {
    const pythonProcess = spawn(PYTHON_PATH, [
        '-c',
        `
from pathlib import Path
from src.ppt_to_learning.extractors.png_generator import generate_slide_pngs, check_libreoffice

if not check_libreoffice():
    print("ERROR: LibreOffice not installed")
    exit(1)

pngs = generate_slide_pngs(
    Path("${inputPath.replace(/\\/g, '\\\\')}"),
    Path("${outputDir.replace(/\\/g, '\\\\')}"),
    dpi=150
)
print(f"Generated {len(pngs)} screenshots")
        `
    ], { cwd: ROOT_DIR });

    let output = '';
    pythonProcess.stdout.on('data', (data) => { output += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { output += data.toString(); });

    pythonProcess.on('close', (code) => {
        if (code === 0) {
            console.log(`Screenshots generated for ${id}: ${output.trim()}`);
        } else {
            console.error(`Screenshot generation failed for ${id}: ${output}`);
        }
    });
}

// 2. Reprocess
app.post('/api/reprocess/:id', (req, res) => {
    const id = req.params.id;
    const presentation = db.getPresentations().find(p => p.id === id);
    if (!presentation) return res.status(404).json({ error: 'Presentation not found' });
    runConversion(id, path.join(getSourcesDir(), presentation.filename), path.join(getStorageDir(), id));
    res.json({ id, status: 'processing' });
});

// 2b. Generate Screenshots
app.post('/api/generate-screenshots/:id', (req, res) => {
    const id = req.params.id;
    const presentation = db.getPresentations().find(p => p.id === id);
    if (!presentation) return res.status(404).json({ error: 'Presentation not found' });

    const sourcePath = path.join(getSourcesDir(), presentation.filename);
    const outputDir = path.join(getStorageDir(), id);

    if (!fs.existsSync(sourcePath)) {
        return res.status(404).json({ error: 'Source PPTX file not found' });
    }

    // Run screenshot generation in background
    const pythonProcess = spawn(PYTHON_PATH, [
        '-c',
        `
from pathlib import Path
from src.ppt_to_learning.extractors.png_generator import generate_slide_pngs, check_libreoffice

if not check_libreoffice():
    print("ERROR: LibreOffice not installed")
    exit(1)

pngs = generate_slide_pngs(
    Path("${sourcePath.replace(/\\/g, '\\\\')}"),
    Path("${outputDir.replace(/\\/g, '\\\\')}"),
    dpi=150
)
print(f"Generated {len(pngs)} screenshots")
        `
    ], { cwd: ROOT_DIR });

    let output = '';
    pythonProcess.stdout.on('data', (data) => { output += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { output += data.toString(); });

    pythonProcess.on('close', (code) => {
        if (code === 0) {
            console.log(`Screenshots generated for ${id}: ${output.trim()}`);
        } else {
            console.error(`Screenshot generation failed for ${id}: ${output}`);
        }
    });

    res.json({ id, status: 'generating', message: 'Screenshot generation started' });
});

// 2c. Check Screenshots Status
app.get('/api/screenshots/:id', (req, res) => {
    const id = req.params.id;
    const screenshotsDir = path.join(getStorageDir(), id, 'screenshots');

    if (!fs.existsSync(screenshotsDir)) {
        return res.json({ hasScreenshots: false, count: 0, screenshots: [] });
    }

    const files = fs.readdirSync(screenshotsDir)
        .filter(f => f.match(/^slide_\d+\.png$/))
        .sort();

    res.json({
        hasScreenshots: files.length > 0,
        count: files.length,
        screenshots: files.map(f => `/media/${id}/screenshots/${f}`)
    });
});

// 3. List
app.get('/api/presentations', (req, res) => {
    res.json(db.getPresentations().map(p => ({ ...p, resultId: path.parse(p.filename).name })));
});

// 3b. Delete Presentation
app.delete('/api/presentations/:id', async (req, res) => {
    const id = req.params.id;
    const presentation = db.getPresentations().find(p => p.id === id);
    if (!presentation) return res.status(404).json({ error: 'Presentation not found' });

    try {
        // Delete storage folder
        const storageDir = path.join(getStorageDir(), id);
        if (fs.existsSync(storageDir)) {
            fs.rmSync(storageDir, { recursive: true, force: true });
        }

        // Delete source file
        const sourceFile = path.join(getSourcesDir(), presentation.filename);
        if (fs.existsSync(sourceFile)) {
            fs.unlinkSync(sourceFile);
        }

        // Remove from database
        db.deletePresentation(id);

        // Trigger git sync
        triggerGitSync('delete presentation');

        res.json({ success: true, id });
    } catch (e) {
        console.error(`Failed to delete presentation ${id}:`, e);
        res.status(500).json({ error: 'Failed to delete presentation' });
    }
});

// 3c. Update Presentation Metadata
app.patch('/api/presentations/:id', (req, res) => {
    const id = req.params.id;
    const presentation = db.getPresentations().find(p => p.id === id);
    if (!presentation) return res.status(404).json({ error: 'Presentation not found' });

    const { originalName, collectionId, folderId, tagIds } = req.body;
    if (originalName) {
        db.updateOriginalName(id, originalName);
    }
    // Update organization fields if provided
    if (collectionId !== undefined || folderId !== undefined || tagIds !== undefined) {
        db.updatePresentationOrganization(id, { collectionId, folderId, tagIds });
    }

    res.json({ success: true, id });
});

// --- COLLECTIONS ---

app.get('/api/collections', (req, res) => {
    res.json(db.getCollections());
});

app.post('/api/collections', (req, res) => {
    const { name, description, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const collection = db.addCollection(name, description, color);
    res.json(collection);
});

app.patch('/api/collections/:id', (req, res) => {
    const { name, description, color } = req.body;
    const collection = db.updateCollection(req.params.id, { name, description, color });
    if (!collection) return res.status(404).json({ error: 'Collection not found' });
    res.json(collection);
});

app.delete('/api/collections/:id', (req, res) => {
    db.deleteCollection(req.params.id);
    res.json({ success: true });
});

// --- FOLDERS ---

app.get('/api/collections/:collId/folders', (req, res) => {
    res.json(db.getFolders(req.params.collId));
});

app.post('/api/collections/:collId/folders', (req, res) => {
    const { name, parentId } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const folder = db.addFolder(req.params.collId, name, parentId);
    res.json(folder);
});

app.patch('/api/folders/:id', (req, res) => {
    const { name, parentId, order } = req.body;
    const folder = db.updateFolder(req.params.id, { name, parentId, order });
    if (!folder) return res.status(404).json({ error: 'Folder not found' });
    res.json(folder);
});

app.delete('/api/folders/:id', (req, res) => {
    db.deleteFolder(req.params.id);
    res.json({ success: true });
});

// --- TAGS ---

app.get('/api/collections/:collId/tags', (req, res) => {
    res.json(db.getTags(req.params.collId));
});

app.post('/api/collections/:collId/tags', (req, res) => {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const tag = db.addTag(req.params.collId, name, color);
    res.json(tag);
});

app.patch('/api/tags/:id', (req, res) => {
    const { name, color } = req.body;
    const tag = db.updateTag(req.params.id, { name, color });
    if (!tag) return res.status(404).json({ error: 'Tag not found' });
    res.json(tag);
});

app.delete('/api/tags/:id', (req, res) => {
    db.deleteTag(req.params.id);
    res.json({ success: true });
});

// 4. View
app.get('/api/view/:id/:resultId', (req, res) => {
    const { id, resultId } = req.params;
    const filePath = path.join(getStorageDir(), id, 'json', `${resultId}.json`);
    if (fs.existsSync(filePath)) res.sendFile(filePath);
    else res.status(404).json({ error: 'File not found' });
});

// 5. Update (Save Edits)
app.put('/api/view/:id/:resultId', (req, res) => {
    const { id, resultId } = req.params;
    const filePath = path.join(getStorageDir(), id, 'json', `${resultId}.json`);

    try {
        fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
        triggerGitSync('update presentation');
        res.json({ status: 'saved' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to save edits' });
    }
});

// --- AI ROUTES ---

// 6. AI: Analyze Slide
app.post('/api/ai/analyze', async (req, res) => {
    try {
        const userKey = req.headers['x-gemini-key'];
        const { slide, prompt } = req.body;
        const report = await ai.analyzeSlide(slide, userKey, prompt);
        res.json({ report });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 7. AI: Fix with Screenshot
app.post('/api/ai/fix', memUpload.single('screenshot'), async (req, res) => {
    try {
        const userKey = req.headers['x-gemini-key'];
        const currentJson = JSON.parse(req.body.currentJson);
        const customPrompt = req.body.prompt;
        const suggestedContent = await ai.fixWithScreenshot(
            req.file.buffer,
            req.file.mimetype,
            currentJson,
            userKey,
            customPrompt
        );
        res.json({ suggestedContent });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// 8. AI: Semantic Conversion - Convert screenshot + raw extraction to semantic content
app.post('/api/ai/convert', memUpload.single('screenshot'), async (req, res) => {
    try {
        const userKey = req.headers['x-gemini-key'];
        const modelName = req.headers['x-gemini-model'] || req.body.model;
        const rawExtraction = JSON.parse(req.body.rawExtraction);

        const semanticContent = await ai.semanticConvert(
            req.file.buffer,
            req.file.mimetype,
            rawExtraction,
            userKey,
            modelName
        );

        res.json({ semanticContent });
    } catch (e) {
        console.error('Semantic conversion error:', e);
        res.status(500).json({ error: e.message });
    }
});

// 9. AI: Get available models
app.get('/api/ai/models', (req, res) => {
    res.json(ai.getAvailableModels());
});

// Status
app.get('/api/status/:id', (req, res) => {
    const id = req.params.id;
    const p = db.getPresentations().find(p => p.id === id);
    if (p) return res.json({ status: p.status, resultId: p.id });
    res.json({ status: 'not_found' });
});

app.get('/', (req, res) => {
    res.send('PPT to Learning API Server is running.');
});

// --- SETTINGS & GIT SYNC ---

// Get current settings
app.get('/api/settings', (req, res) => {
    const config = getConfig();
    const paths = getDataPaths();
    res.json({
        dataPath: config.dataPath,
        gitSync: config.gitSync,
        resolvedPaths: {
            basePath: paths.basePath,
            uploadsPath: paths.uploadsPath,
            storagePath: paths.storagePath,
            dataJsonPath: paths.dataJsonPath
        },
        isGitRepo: isGitRepo()
    });
});

// Update settings
app.post('/api/settings', (req, res) => {
    const { dataPath, gitSync: gitSyncSettings } = req.body;

    const updates = {};
    if (dataPath !== undefined) updates.dataPath = dataPath;
    if (gitSyncSettings) updates.gitSync = gitSyncSettings;

    const success = saveConfig(updates);
    if (success) {
        // Reinitialize data directories with new path
        initDataDirs();
        res.json({ success: true, config: getConfig() });
    } else {
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

// Get git status for data repo
app.get('/api/settings/git-status', async (req, res) => {
    try {
        const status = await gitSync.getStatus();
        res.json(status);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Initialize git repo in data directory
app.post('/api/settings/git-init', async (req, res) => {
    try {
        const config = getConfig();
        if (!config.dataPath) {
            return res.status(400).json({ error: 'No data path configured' });
        }
        const result = await gitSync.initRepo();
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Add git remote
app.post('/api/settings/git-remote', async (req, res) => {
    try {
        const { name, url } = req.body;
        if (!name || !url) {
            return res.status(400).json({ error: 'Remote name and URL required' });
        }
        const result = await gitSync.addRemote(name, url);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Manual git sync
app.post('/api/settings/git-sync', async (req, res) => {
    try {
        const { message } = req.body;
        const commitResult = await gitSync.commit(message || 'Manual sync');

        const config = getConfig();
        let pushResult = null;
        if (config.gitSync.autoPush) {
            pushResult = await gitSync.push();
        }

        res.json({ commit: commitResult, push: pushResult });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Git push
app.post('/api/settings/git-push', async (req, res) => {
    try {
        const result = await gitSync.push();
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Clone existing repo
app.post('/api/settings/git-clone', async (req, res) => {
    try {
        const { url, path: targetPath } = req.body;
        if (!url || !targetPath) {
            return res.status(400).json({ error: 'Repository URL and target path required' });
        }
        const result = await gitSync.cloneRepo(url, targetPath);
        if (result.success) {
            // Update config to use the cloned repo path
            saveConfig({ dataPath: targetPath });
            initDataDirs();
        }
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));