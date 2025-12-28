const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ai = require('../ai');
const { getDataPaths } = require('../config');

const router = express.Router();
const getStorageDir = () => getDataPaths().storagePath;
const memUpload = multer({ storage: multer.memoryStorage() });

// Analyze Slide
router.post('/ai/analyze', async (req, res) => {
    try {
        const userKey = req.headers['x-gemini-key'];
        const { slide, prompt } = req.body;
        const report = await ai.analyzeSlide(slide, userKey, prompt);
        res.json({ report });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Fix with Screenshot
router.post('/ai/fix', memUpload.single('screenshot'), async (req, res) => {
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

// Semantic Conversion
router.post('/ai/convert', memUpload.single('screenshot'), async (req, res) => {
    try {
        const userKey = req.headers['x-gemini-key'];
        const modelName = req.headers['x-gemini-model'] || req.body.model;
        const rawExtraction = JSON.parse(req.body.rawExtraction);
        const includeMedia = req.body.includeMedia === 'true';
        const conversionId = req.body.conversionId;

        // Load media files if requested
        let mediaFiles = [];
        if (includeMedia && conversionId) {
            const imageList = ai.extractImageList(rawExtraction);
            const storageDir = path.join(getStorageDir(), conversionId);

            for (const img of imageList) {
                const mediaPath = path.join(storageDir, img.src);
                if (fs.existsSync(mediaPath)) {
                    try {
                        const buffer = fs.readFileSync(mediaPath);
                        const ext = path.extname(img.src).toLowerCase();
                        const mimeType = ext === '.png' ? 'image/png' :
                                         ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                                         ext === '.gif' ? 'image/gif' :
                                         ext === '.webp' ? 'image/webp' : 'image/png';
                        mediaFiles.push({ path: img.src, buffer, mimeType });
                    } catch (err) {
                        console.log(`[AI] Could not load media file: ${img.src}`);
                    }
                }
            }
            console.log(`[AI] Loaded ${mediaFiles.length} of ${imageList.length} media files for conversion`);
        }

        const semanticContent = await ai.semanticConvert(
            req.file.buffer,
            req.file.mimetype,
            rawExtraction,
            userKey,
            modelName,
            mediaFiles
        );

        res.json({ semanticContent });
    } catch (e) {
        console.error('Semantic conversion error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Get Available Models
router.get('/ai/models', (req, res) => {
    res.json(ai.getAvailableModels());
});

module.exports = router;
