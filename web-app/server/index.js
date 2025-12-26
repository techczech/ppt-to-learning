const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const ai = require('./ai');
require('dotenv').config();

const app = express();
const PORT = 3001;

// Paths
const ROOT_DIR = path.resolve(__dirname, '../../');
const PYTHON_PATH = path.join(ROOT_DIR, '.venv/bin/python3');
const CLI_PATH = path.join(ROOT_DIR, 'src/ppt_to_learning/cli.py');

// Directories
const SOURCES_DIR = path.join(__dirname, 'uploads', 'sources');
const STORAGE_DIR = path.join(__dirname, 'storage');

// Ensure directories exist
if (!fs.existsSync(SOURCES_DIR)) fs.mkdirSync(SOURCES_DIR, { recursive: true });
if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow larger payloads for JSON edits

// Serve static media (including screenshots)
app.use('/media', express.static(STORAGE_DIR));
// Screenshots are served via /media/{id}/screenshots/slide_XXXX.png

// Configure Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, SOURCES_DIR),
    filename: (req, file, cb) => {
        const id = uuidv4();
        const filename = `${id}${path.extname(file.originalname)}`;
        req.fileId = id;
        cb(null, filename);
    }
});
const upload = multer({ storage: storage });
const memUpload = multer({ storage: multer.memoryStorage() });

// --- API ROUTES ---

// 1. Upload and Convert
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const id = req.fileId;
    const generateScreenshots = req.body.generateScreenshots === 'true';
    const collectionId = req.body.collectionId || null;
    const folderId = req.body.folderId || null;
    db.addPresentation(id, req.file.filename, req.file.originalname, { collectionId, folderId });
    const outputDir = path.join(STORAGE_DIR, id);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    runConversion(id, req.file.path, outputDir, { generateScreenshots });
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
    runConversion(id, path.join(SOURCES_DIR, presentation.filename), path.join(STORAGE_DIR, id));
    res.json({ id, status: 'processing' });
});

// 2b. Generate Screenshots
app.post('/api/generate-screenshots/:id', (req, res) => {
    const id = req.params.id;
    const presentation = db.getPresentations().find(p => p.id === id);
    if (!presentation) return res.status(404).json({ error: 'Presentation not found' });

    const sourcePath = path.join(SOURCES_DIR, presentation.filename);
    const outputDir = path.join(STORAGE_DIR, id);

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
    const screenshotsDir = path.join(STORAGE_DIR, id, 'screenshots');

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
app.delete('/api/presentations/:id', (req, res) => {
    const id = req.params.id;
    const presentation = db.getPresentations().find(p => p.id === id);
    if (!presentation) return res.status(404).json({ error: 'Presentation not found' });

    try {
        // Delete storage folder
        const storageDir = path.join(STORAGE_DIR, id);
        if (fs.existsSync(storageDir)) {
            fs.rmSync(storageDir, { recursive: true, force: true });
        }

        // Delete source file
        const sourceFile = path.join(SOURCES_DIR, presentation.filename);
        if (fs.existsSync(sourceFile)) {
            fs.unlinkSync(sourceFile);
        }

        // Remove from database
        db.deletePresentation(id);

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
    const filePath = path.join(STORAGE_DIR, id, 'json', `${resultId}.json`);
    if (fs.existsSync(filePath)) res.sendFile(filePath);
    else res.status(404).json({ error: 'File not found' });
});

// 5. Update (Save Edits)
app.put('/api/view/:id/:resultId', (req, res) => {
    const { id, resultId } = req.params;
    const filePath = path.join(STORAGE_DIR, id, 'json', `${resultId}.json`);

    try {
        fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
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

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));