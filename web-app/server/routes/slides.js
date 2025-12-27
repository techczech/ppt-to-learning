const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { getDataPaths } = require('../config');
const { buildSearchableText } = require('../utils/textExtractor');

const router = express.Router();

// Git sync helper (will be set by main app)
let triggerGitSync = async () => {};
router.setGitSync = (fn) => { triggerGitSync = fn; };

// Helper: Get slide content from source presentation JSON
const getSlideContentFromSource = (sourceId, slideOrder) => {
    const storagePath = getDataPaths().storagePath;
    const jsonPath = path.join(storagePath, sourceId, 'json', `${sourceId}.json`);

    if (!fs.existsSync(jsonPath)) {
        return null;
    }

    try {
        const presentationJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        // Flatten sections to find slide by order
        let slideIndex = 0;
        for (const section of (presentationJson.sections || [])) {
            for (const slide of (section.slides || [])) {
                slideIndex++;
                if (slideIndex === slideOrder) {
                    return {
                        ...slide,
                        sectionTitle: section.title
                    };
                }
            }
        }
        return null;
    } catch (e) {
        console.error(`Error reading slide content: ${e.message}`);
        return null;
    }
};

// Helper: Get edited slide content path
const getEditedSlidePath = (sourceId, slideOrder) => {
    const storagePath = getDataPaths().storagePath;
    return path.join(storagePath, sourceId, 'slides', `slide-${slideOrder}.json`);
};

// Helper: Get screenshot URL for a slide
const getScreenshotUrl = (sourceId, slideOrder) => {
    const storagePath = getDataPaths().storagePath;
    const screenshotPath = path.join(storagePath, sourceId, 'screenshots', `slide_${String(slideOrder).padStart(4, '0')}.png`);
    if (fs.existsSync(screenshotPath)) {
        return `/media/${sourceId}/screenshots/slide_${String(slideOrder).padStart(4, '0')}.png`;
    }
    return null;
};

// --- LIST SLIDES ---
router.get('/slides', (req, res) => {
    const { sourceId, collectionId, folderId, tagId, starred, search } = req.query;
    const filters = {};

    if (sourceId) filters.sourceId = sourceId;
    if (collectionId) filters.collectionId = collectionId;
    if (folderId) filters.folderId = folderId;
    if (tagId) filters.tagId = tagId;
    if (starred === 'true') filters.starred = true;
    if (starred === 'false') filters.starred = false;
    if (search) filters.search = search;

    const slides = db.getSlides(filters);

    // Enrich with screenshot URLs
    const enrichedSlides = slides.map(slide => ({
        ...slide,
        screenshotUrl: getScreenshotUrl(slide.sourceId, slide.sourceSlideOrder)
    }));

    res.json(enrichedSlides);
});

// --- GET SINGLE SLIDE ---
router.get('/slides/:id', (req, res) => {
    const slide = db.getSlideById(req.params.id);
    if (!slide) {
        return res.status(404).json({ error: 'Slide not found' });
    }

    // Enrich with screenshot URL
    const enrichedSlide = {
        ...slide,
        screenshotUrl: getScreenshotUrl(slide.sourceId, slide.sourceSlideOrder)
    };

    res.json(enrichedSlide);
});

// --- GET SLIDE CONTENT ---
router.get('/slides/:id/content', (req, res) => {
    const slide = db.getSlideById(req.params.id);
    if (!slide) {
        return res.status(404).json({ error: 'Slide not found' });
    }

    // Check if edited version exists
    if (slide.contentPath) {
        const editedPath = path.join(getDataPaths().storagePath, slide.contentPath);
        if (fs.existsSync(editedPath)) {
            try {
                const content = JSON.parse(fs.readFileSync(editedPath, 'utf8'));
                return res.json(content);
            } catch (e) {
                console.error(`Error reading edited slide: ${e.message}`);
            }
        }
    }

    // Fall back to source content
    const content = getSlideContentFromSource(slide.sourceId, slide.sourceSlideOrder);
    if (!content) {
        return res.status(404).json({ error: 'Slide content not found' });
    }

    res.json(content);
});

// --- SAVE SLIDE CONTENT ---
router.put('/slides/:id/content', (req, res) => {
    const slide = db.getSlideById(req.params.id);
    if (!slide) {
        return res.status(404).json({ error: 'Slide not found' });
    }

    const storagePath = getDataPaths().storagePath;
    const slidesDir = path.join(storagePath, slide.sourceId, 'slides');

    // Ensure slides directory exists
    if (!fs.existsSync(slidesDir)) {
        fs.mkdirSync(slidesDir, { recursive: true });
    }

    const slideFilename = `slide-${slide.sourceSlideOrder}.json`;
    const slidePath = path.join(slidesDir, slideFilename);
    const contentPath = `${slide.sourceId}/slides/${slideFilename}`;

    try {
        fs.writeFileSync(slidePath, JSON.stringify(req.body, null, 2));
        const updatedSlide = db.updateSlide(slide.id, { contentPath });
        triggerGitSync('save slide content');
        res.json(updatedSlide);
    } catch (e) {
        console.error(`Error saving slide content: ${e.message}`);
        res.status(500).json({ error: 'Failed to save slide content' });
    }
});

// --- UPDATE SLIDE METADATA ---
router.patch('/slides/:id', (req, res) => {
    const slide = db.getSlideById(req.params.id);
    if (!slide) {
        return res.status(404).json({ error: 'Slide not found' });
    }

    const { title, tagIds, starred, notes, metadata, collectionId, folderId } = req.body;
    const updates = {};

    if (title !== undefined) updates.title = title;
    if (tagIds !== undefined) updates.tagIds = tagIds;
    if (starred !== undefined) updates.starred = starred;
    if (notes !== undefined) updates.notes = notes;
    if (metadata !== undefined) updates.metadata = metadata;
    if (collectionId !== undefined) updates.collectionId = collectionId || null;
    if (folderId !== undefined) updates.folderId = folderId || null;

    const updatedSlide = db.updateSlide(slide.id, updates);
    triggerGitSync('update slide');
    res.json(updatedSlide);
});

// --- DELETE SLIDE ---
router.delete('/slides/:id', (req, res) => {
    const slide = db.getSlideById(req.params.id);
    if (!slide) {
        return res.status(404).json({ error: 'Slide not found' });
    }

    // Optionally delete edited content file
    if (slide.contentPath) {
        const editedPath = path.join(getDataPaths().storagePath, slide.contentPath);
        if (fs.existsSync(editedPath)) {
            try {
                fs.unlinkSync(editedPath);
            } catch (e) {
                console.error(`Error deleting edited slide file: ${e.message}`);
            }
        }
    }

    db.deleteSlide(slide.id);
    triggerGitSync('delete slide');
    res.json({ success: true, id: slide.id });
});

// --- PROMOTE SLIDES ---
router.post('/slides/promote', (req, res) => {
    const { sourceId, slides: slidesData } = req.body;

    if (!sourceId || !slidesData || !Array.isArray(slidesData)) {
        return res.status(400).json({ error: 'sourceId and slides array required' });
    }

    // Verify source exists
    const presentations = db.getPresentations();
    const source = presentations.find(p => p.id === sourceId);
    if (!source) {
        return res.status(404).json({ error: 'Source presentation not found' });
    }

    // Promote slides
    const promotedSlides = db.promoteBulkSlides(sourceId, slidesData);

    // Extract searchable text for each promoted slide
    const enrichedSlides = promotedSlides.map(slide => {
        // Get slide content from source presentation
        const slideContent = getSlideContentFromSource(slide.sourceId, slide.sourceSlideOrder);

        if (slideContent) {
            // Build searchable text
            const searchableText = buildSearchableText({
                title: slide.title,
                notes: slide.notes || '',
                content: slideContent.content || []
            });

            // Update slide with searchable text
            db.updateSlide(slide.id, { searchableText });
            slide.searchableText = searchableText;
        }

        return {
            ...slide,
            screenshotUrl: getScreenshotUrl(slide.sourceId, slide.sourceSlideOrder)
        };
    });

    triggerGitSync('promote slides');
    res.json(enrichedSlides);
});

// --- DEMOTE SLIDE ---
router.post('/slides/:id/demote', (req, res) => {
    const slide = db.getSlideById(req.params.id);
    if (!slide) {
        return res.status(404).json({ error: 'Slide not found' });
    }

    // Optionally delete edited content file
    if (slide.contentPath) {
        const editedPath = path.join(getDataPaths().storagePath, slide.contentPath);
        if (fs.existsSync(editedPath)) {
            try {
                fs.unlinkSync(editedPath);
            } catch (e) {
                console.error(`Error deleting edited slide file: ${e.message}`);
            }
        }
    }

    db.demoteSlide(slide.id);
    triggerGitSync('demote slide');
    res.json({ success: true, id: slide.id });
});

// --- BULK TAG SLIDES ---
router.post('/slides/bulk-tag', (req, res) => {
    const { slideIds, tagId, action } = req.body;

    if (!slideIds || !Array.isArray(slideIds) || !tagId || !['add', 'remove'].includes(action)) {
        return res.status(400).json({ error: 'slideIds array, tagId, and action (add/remove) required' });
    }

    db.bulkTagSlides(slideIds, tagId, action);
    triggerGitSync('bulk tag slides');
    res.json({ success: true });
});

// --- SYNC SLIDE ORGANIZATION ---
// Backfill collectionId/folderId for existing slides from their source presentations
router.post('/slides/sync-organization', (req, res) => {
    const result = db.syncSlideOrganization();
    if (result.updated > 0) {
        triggerGitSync('sync slide organization');
    }
    res.json(result);
});

// --- SYNC SEARCHABLE TEXT ---
// Backfill searchableText for existing slides that don't have it
router.post('/slides/sync-searchable-text', (req, res) => {
    const slides = db.getSlides();
    let updated = 0;

    for (const slide of slides) {
        // Skip if already has searchable text with content
        if (slide.searchableText?.content) {
            continue;
        }

        // Get slide content from source presentation
        const slideContent = getSlideContentFromSource(slide.sourceId, slide.sourceSlideOrder);

        if (slideContent) {
            const searchableText = buildSearchableText({
                title: slide.title,
                notes: slide.notes || '',
                content: slideContent.content || []
            });

            db.updateSlide(slide.id, { searchableText });
            updated++;
        }
    }

    if (updated > 0) {
        triggerGitSync('sync searchable text');
    }

    res.json({ updated, total: slides.length });
});

module.exports = router;
