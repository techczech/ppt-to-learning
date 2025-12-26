const express = require('express');
const multer = require('multer');
const ai = require('../ai');

const router = express.Router();
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

// Get Available Models
router.get('/ai/models', (req, res) => {
    res.json(ai.getAvailableModels());
});

module.exports = router;
