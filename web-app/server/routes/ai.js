const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ai = require('../ai');
const { getDataPaths } = require('../config');

const router = express.Router();
const getStorageDir = () => getDataPaths().storagePath;
const memUpload = multer({ storage: multer.memoryStorage() });

// Upload handler for semantic conversion (supports multiple context screenshots)
const convertUpload = memUpload.fields([
    { name: 'screenshot', maxCount: 1 },
    { name: 'contextScreenshots', maxCount: 6 } // Max 3 before + 3 after
]);

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
router.post('/ai/convert', convertUpload, async (req, res) => {
    try {
        const userKey = req.headers['x-gemini-key'];
        const modelName = req.headers['x-gemini-model'] || req.body.model;
        const rawExtraction = JSON.parse(req.body.rawExtraction);
        const includeMedia = req.body.includeMedia === 'true';
        const conversionId = req.body.conversionId;
        const additionalPrompt = req.body.additionalPrompt || '';
        const preserveVisuals = req.body.preserveVisuals === 'true';
        const generateImages = req.body.generateImages === 'true';
        const useLucideIcons = req.body.useLucideIcons === 'true';

        // Parse context slides metadata
        const contextSlides = req.body.contextSlides
            ? JSON.parse(req.body.contextSlides)
            : null;
        const contextScreenshotsMeta = req.body.contextScreenshotsMeta
            ? JSON.parse(req.body.contextScreenshotsMeta)
            : [];

        // Get main screenshot
        const mainScreenshot = req.files['screenshot']?.[0];
        if (!mainScreenshot) {
            return res.status(400).json({ error: 'Missing screenshot' });
        }

        // Process context screenshots
        const contextScreenshotFiles = req.files['contextScreenshots'] || [];
        const contextScreenshotsData = contextScreenshotFiles.map((file, idx) => ({
            ...contextScreenshotsMeta[idx],
            buffer: file.buffer,
            mimeType: file.mimetype
        }));

        if (contextSlides) {
            console.log(`[AI] Context slides: ${contextSlides.before?.length || 0} before, ${contextSlides.after?.length || 0} after`);
        }
        if (contextScreenshotsData.length > 0) {
            console.log(`[AI] Context screenshots: ${contextScreenshotsData.length}`);
        }

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
            mainScreenshot.buffer,
            mainScreenshot.mimetype,
            rawExtraction,
            userKey,
            modelName,
            mediaFiles,
            additionalPrompt,
            preserveVisuals,
            generateImages,
            conversionId ? path.join(getStorageDir(), conversionId) : null,
            useLucideIcons,
            contextSlides,
            contextScreenshotsData
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
