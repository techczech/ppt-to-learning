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

// Get All Slides from Presentation (for promotion UI)
router.get('/presentations/:id/slides', (req, res) => {
    const { id } = req.params;
    const presentation = db.getPresentations().find(p => p.id === id);
    if (!presentation) return res.status(404).json({ error: 'Presentation not found' });

    const jsonPath = path.join(getStorageDir(), id, 'json', `${id}.json`);
    if (!fs.existsSync(jsonPath)) {
        return res.status(404).json({ error: 'Presentation JSON not found' });
    }

    try {
        const presentationJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const promotedSlides = db.getSlides({ sourceId: id });

        // Flatten sections to get all slides with metadata
        const slides = [];
        let slideOrder = 0;

        for (const section of (presentationJson.sections || [])) {
            for (const slide of (section.slides || [])) {
                slideOrder++;
                const promoted = promotedSlides.find(s => s.sourceSlideOrder === slideOrder);

                // Get screenshot URL
                const screenshotPath = path.join(getStorageDir(), id, 'screenshots', `slide_${String(slideOrder).padStart(4, '0')}.png`);
                const hasScreenshot = fs.existsSync(screenshotPath);

                // Extract content types
                const contentTypes = [...new Set((slide.content || []).map(c => c.type))];

                // Calculate word count
                const wordCount = (slide.content || []).reduce((count, block) => {
                    if (block.text) count += block.text.split(/\s+/).length;
                    if (block.items) count += block.items.join(' ').split(/\s+/).length;
                    return count;
                }, 0);

                slides.push({
                    slideOrder,
                    title: slide.title || `Slide ${slideOrder}`,
                    layout: slide.layout || '',
                    sectionTitle: section.title,
                    hasScreenshot,
                    screenshotUrl: hasScreenshot ? `/media/${id}/screenshots/slide_${String(slideOrder).padStart(4, '0')}.png` : null,
                    contentTypes,
                    wordCount,
                    promoted: !!promoted,
                    promotedSlideId: promoted ? promoted.id : null
                });
            }
        }

        res.json({
            sourceId: id,
            originalName: presentation.originalName,
            totalSlides: slides.length,
            promotedCount: promotedSlides.length,
            slides
        });
    } catch (e) {
        console.error(`Error reading presentation slides: ${e.message}`);
        res.status(500).json({ error: 'Failed to read presentation slides' });
    }
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
