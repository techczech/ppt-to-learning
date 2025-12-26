const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { getDataPaths } = require('../config');
const { runConversion, runScreenshotGeneration, ROOT_DIR, PYTHON_PATH } = require('../services/extraction');
const { spawn } = require('child_process');

const router = express.Router();

// Helper functions
const getSourcesDir = () => path.join(getDataPaths().uploadsPath, 'sources');
const getStorageDir = () => getDataPaths().storagePath;

// Multer configuration
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
const upload = multer({ storage });

// Git sync helper (will be passed from main app)
let triggerGitSync = async () => {};
router.setGitSync = (fn) => { triggerGitSync = fn; };

// --- ROUTES ---

// Upload and Convert
router.post('/upload', upload.single('file'), (req, res) => {
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
    res.json({ id, status: 'processing', filename: req.file.originalname, generateScreenshots });
});

// Reprocess
router.post('/reprocess/:id', (req, res) => {
    const { id } = req.params;
    const presentation = db.getPresentations().find(p => p.id === id);
    if (!presentation) return res.status(404).json({ error: 'Presentation not found' });

    runConversion(id, path.join(getSourcesDir(), presentation.filename), path.join(getStorageDir(), id));
    res.json({ id, status: 'processing' });
});

// Generate Screenshots
router.post('/generate-screenshots/:id', (req, res) => {
    const { id } = req.params;
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

// Check Screenshots Status
router.get('/screenshots/:id', (req, res) => {
    const { id } = req.params;
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

// List Presentations
router.get('/presentations', (req, res) => {
    res.json(db.getPresentations().map(p => ({ ...p, resultId: path.parse(p.filename).name })));
});

// Delete Presentation
router.delete('/presentations/:id', async (req, res) => {
    const { id } = req.params;
    const presentation = db.getPresentations().find(p => p.id === id);
    if (!presentation) return res.status(404).json({ error: 'Presentation not found' });

    try {
        const storageDir = path.join(getStorageDir(), id);
        if (fs.existsSync(storageDir)) {
            fs.rmSync(storageDir, { recursive: true, force: true });
        }

        const sourceFile = path.join(getSourcesDir(), presentation.filename);
        if (fs.existsSync(sourceFile)) {
            fs.unlinkSync(sourceFile);
        }

        db.deletePresentation(id);
        triggerGitSync('delete presentation');
        res.json({ success: true, id });
    } catch (e) {
        console.error(`Failed to delete presentation ${id}:`, e);
        res.status(500).json({ error: 'Failed to delete presentation' });
    }
});

// Update Presentation Metadata
router.patch('/presentations/:id', (req, res) => {
    const { id } = req.params;
    const presentation = db.getPresentations().find(p => p.id === id);
    if (!presentation) return res.status(404).json({ error: 'Presentation not found' });

    const { originalName, collectionId, folderId, tagIds } = req.body;
    if (originalName) {
        db.updateOriginalName(id, originalName);
    }
    if (collectionId !== undefined || folderId !== undefined || tagIds !== undefined) {
        db.updatePresentationOrganization(id, { collectionId, folderId, tagIds });
    }

    res.json({ success: true, id });
});

// View Presentation JSON
router.get('/view/:id/:resultId', (req, res) => {
    const { id, resultId } = req.params;
    const filePath = path.join(getStorageDir(), id, 'json', `${resultId}.json`);
    if (fs.existsSync(filePath)) res.sendFile(filePath);
    else res.status(404).json({ error: 'File not found' });
});

// Save Presentation Edits
router.put('/view/:id/:resultId', (req, res) => {
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

// Status Check
router.get('/status/:id', (req, res) => {
    const { id } = req.params;
    const p = db.getPresentations().find(p => p.id === id);
    if (p) return res.json({ status: p.status, resultId: p.id });
    res.json({ status: 'not_found' });
});

module.exports = router;
