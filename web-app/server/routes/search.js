const express = require('express');
const Fuse = require('fuse.js');
const db = require('../db');
const {
    generateEmbedding,
    generateQueryEmbedding,
    cosineSimilarity,
    buildEmbeddingText,
    EMBEDDING_MODEL
} = require('../services/embeddings');

const router = express.Router();

// Helper to get screenshot URL
const getScreenshotUrl = (sourceId, slideOrder) => {
    return `/media/${sourceId}/screenshots/slide_${String(slideOrder).padStart(4, '0')}.png`;
};

// --- FULL-TEXT FUZZY SEARCH ---
router.get('/search/slides', (req, res) => {
    const { q, collectionId, folderId, limit = 50 } = req.query;

    if (!q) {
        return res.json({ results: [], total: 0 });
    }

    // Get slides, optionally filtered by collection/folder
    const filters = {};
    if (collectionId) filters.collectionId = collectionId;
    if (folderId) filters.folderId = folderId;

    const slides = db.getSlides(filters);

    // Configure Fuse.js for fuzzy search
    const fuse = new Fuse(slides, {
        keys: [
            { name: 'title', weight: 2 },
            { name: 'notes', weight: 1 },
            { name: 'searchableText.title', weight: 2 },
            { name: 'searchableText.notes', weight: 1 },
            { name: 'searchableText.content', weight: 1.5 }
        ],
        threshold: 0.4,  // Fuzzy tolerance (0 = exact, 1 = match anything)
        includeScore: true,
        ignoreLocation: true,
        minMatchCharLength: 2
    });

    const results = fuse.search(q, { limit: parseInt(limit) });

    res.json({
        results: results.map(r => ({
            ...r.item,
            screenshotUrl: getScreenshotUrl(r.item.sourceId, r.item.sourceSlideOrder),
            searchScore: r.score
        })),
        total: results.length
    });
});

// --- SEMANTIC SIMILARITY SEARCH ---
router.post('/search/similar', async (req, res) => {
    const apiKey = req.headers['x-gemini-key'];
    if (!apiKey) {
        return res.status(401).json({ error: 'Gemini API key required (x-gemini-key header)' });
    }

    const { slideId, text, limit = 20 } = req.body;

    if (!slideId && !text) {
        return res.status(400).json({ error: 'slideId or text required' });
    }

    try {
        let queryEmbedding;

        if (slideId) {
            // Find similar to an existing slide
            const slide = db.getSlideById(slideId);
            if (!slide) {
                return res.status(404).json({ error: 'Slide not found' });
            }

            // Use cached embedding or generate new one
            if (slide.embedding) {
                queryEmbedding = slide.embedding;
            } else {
                const embeddingText = buildEmbeddingText(slide);
                queryEmbedding = await generateEmbedding(embeddingText, apiKey);

                // Cache the embedding
                db.updateSlide(slideId, {
                    embedding: queryEmbedding,
                    embeddingModel: EMBEDDING_MODEL,
                    embeddingGeneratedAt: new Date().toISOString()
                });
            }
        } else {
            // Free-text semantic search
            queryEmbedding = await generateQueryEmbedding(text, apiKey);
        }

        // Get all slides with embeddings
        const allSlides = db.getSlides();
        const slidesWithEmbeddings = allSlides.filter(s => s.embedding);

        // Calculate similarities
        const similarities = slidesWithEmbeddings
            .filter(s => s.id !== slideId) // Exclude the source slide
            .map(slide => ({
                slide: {
                    ...slide,
                    screenshotUrl: getScreenshotUrl(slide.sourceId, slide.sourceSlideOrder)
                },
                score: cosineSimilarity(queryEmbedding, slide.embedding)
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, parseInt(limit));

        res.json({ similar: similarities });
    } catch (e) {
        console.error('Similarity search error:', e);
        res.status(500).json({ error: e.message || 'Failed to perform similarity search' });
    }
});

// --- BATCH GENERATE EMBEDDINGS ---
router.post('/search/embeddings', async (req, res) => {
    const apiKey = req.headers['x-gemini-key'];
    if (!apiKey) {
        return res.status(401).json({ error: 'Gemini API key required (x-gemini-key header)' });
    }

    const { slideIds } = req.body;
    if (!slideIds || !Array.isArray(slideIds)) {
        return res.status(400).json({ error: 'slideIds array required' });
    }

    const updated = [];
    const failed = [];

    for (const slideId of slideIds) {
        try {
            const slide = db.getSlideById(slideId);
            if (!slide) {
                failed.push({ id: slideId, error: 'Not found' });
                continue;
            }

            const embeddingText = buildEmbeddingText(slide);
            const embedding = await generateEmbedding(embeddingText, apiKey);

            db.updateSlide(slideId, {
                embedding,
                embeddingModel: EMBEDDING_MODEL,
                embeddingGeneratedAt: new Date().toISOString()
            });

            updated.push(slideId);
        } catch (e) {
            console.error(`Failed to generate embedding for ${slideId}:`, e);
            failed.push({ id: slideId, error: e.message });
        }
    }

    res.json({ updated: updated.length, failed });
});

module.exports = router;
