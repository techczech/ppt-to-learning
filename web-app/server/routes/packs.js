const express = require('express');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const db = require('../db');
const { getDataPaths } = require('../config');

const router = express.Router();

// Git sync helper
let triggerGitSync = async () => {};
router.setGitSync = (fn) => { triggerGitSync = fn; };

// Helper to get screenshot URL
const getScreenshotUrl = (sourceId, slideOrder) => {
    return `/media/${sourceId}/screenshots/slide_${String(slideOrder).padStart(4, '0')}.png`;
};

// Helper to extract slide content from presentation JSON
const getSlideContentFromSource = (sourceId, slideOrder) => {
    const storagePath = getDataPaths().storagePath;
    const jsonPath = path.join(storagePath, sourceId, 'json', `${sourceId}.json`);

    if (!fs.existsSync(jsonPath)) {
        return null;
    }

    try {
        const presentationJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
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

// --- LIST PACKS ---
router.get('/packs', (req, res) => {
    const packs = db.getPacks();
    res.json(packs);
});

// --- GET PACK WITH SLIDES ---
router.get('/packs/:id', (req, res) => {
    const pack = db.getPackById(req.params.id);
    if (!pack) {
        return res.status(404).json({ error: 'Pack not found' });
    }

    // Get slides for this pack
    const slides = pack.slideIds
        .map(id => db.getSlideById(id))
        .filter(Boolean)
        .map(slide => ({
            ...slide,
            screenshotUrl: getScreenshotUrl(slide.sourceId, slide.sourceSlideOrder)
        }));

    res.json({ pack, slides });
});

// --- CREATE PACK ---
router.post('/packs', (req, res) => {
    const { name, slideIds, description, color, folderId } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Pack name required' });
    }

    const pack = db.addPack(name, slideIds || [], description || '', color, folderId || null);
    triggerGitSync('create pack');
    res.json(pack);
});

// --- UPDATE PACK ---
router.patch('/packs/:id', (req, res) => {
    const pack = db.getPackById(req.params.id);
    if (!pack) {
        return res.status(404).json({ error: 'Pack not found' });
    }

    const { name, slideIds, description, color, folderId } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (slideIds !== undefined) updates.slideIds = slideIds;
    if (description !== undefined) updates.description = description;
    if (color !== undefined) updates.color = color;
    if (folderId !== undefined) updates.folderId = folderId;

    const updatedPack = db.updatePack(pack.id, updates);
    triggerGitSync('update pack');
    res.json(updatedPack);
});

// --- DELETE PACK ---
router.delete('/packs/:id', (req, res) => {
    const pack = db.getPackById(req.params.id);
    if (!pack) {
        return res.status(404).json({ error: 'Pack not found' });
    }

    db.deletePack(pack.id);
    triggerGitSync('delete pack');
    res.json({ success: true, id: pack.id });
});

// --- EXPORT PACK AS ZIP ---
router.get('/packs/:id/export', (req, res) => {
    const pack = db.getPackById(req.params.id);
    if (!pack) {
        return res.status(404).json({ error: 'Pack not found' });
    }

    const slides = pack.slideIds
        .map(id => db.getSlideById(id))
        .filter(Boolean);

    if (slides.length === 0) {
        return res.status(400).json({ error: 'Pack has no slides' });
    }

    // Set up ZIP response
    const safeName = pack.name.replace(/[^a-z0-9_\-\s]/gi, '').trim() || 'pack';
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.zip"`);

    const archive = archiver('zip', { zlib: { level: 5 } });
    archive.pipe(res);

    // Add manifest
    const manifest = {
        name: pack.name,
        description: pack.description,
        exportedAt: new Date().toISOString(),
        slideCount: slides.length,
        slides: slides.map(s => ({
            id: s.id,
            title: s.title,
            sourceId: s.sourceId,
            sourceSlideOrder: s.sourceSlideOrder,
            notes: s.notes,
            tagIds: s.tagIds
        }))
    };
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    const storagePath = getDataPaths().storagePath;

    // Add each slide's content and screenshot
    for (const slide of slides) {
        const slideNum = String(slide.sourceSlideOrder).padStart(4, '0');

        // Get slide content (edited or original)
        let slideContent;
        if (slide.contentPath) {
            const editedPath = path.join(storagePath, slide.contentPath);
            if (fs.existsSync(editedPath)) {
                try {
                    slideContent = JSON.parse(fs.readFileSync(editedPath, 'utf8'));
                } catch (e) {
                    console.error(`Error reading edited slide: ${e.message}`);
                }
            }
        }
        if (!slideContent) {
            slideContent = getSlideContentFromSource(slide.sourceId, slide.sourceSlideOrder);
        }

        if (slideContent) {
            // Add slide metadata
            const slideData = {
                ...slideContent,
                metadata: {
                    id: slide.id,
                    title: slide.title,
                    notes: slide.notes,
                    tagIds: slide.tagIds,
                    starred: slide.starred
                }
            };
            archive.append(JSON.stringify(slideData, null, 2), {
                name: `slides/${slideNum}-${slide.id}.json`
            });
        }

        // Add screenshot
        const screenshotPath = path.join(
            storagePath,
            slide.sourceId,
            'screenshots',
            `slide_${slideNum}.png`
        );
        if (fs.existsSync(screenshotPath)) {
            archive.file(screenshotPath, {
                name: `screenshots/${slideNum}-${slide.id}.png`
            });
        }

        // Add related media (images from slide content)
        if (slideContent?.content) {
            for (const block of slideContent.content) {
                if (block.type === 'image' && block.src) {
                    const mediaPath = path.join(storagePath, slide.sourceId, 'media', path.basename(block.src));
                    if (fs.existsSync(mediaPath)) {
                        archive.file(mediaPath, {
                            name: `media/${slideNum}/${path.basename(block.src)}`
                        });
                    }
                }
            }
        }
    }

    archive.finalize();
});

// =====================
// PACK FOLDERS
// =====================

// --- LIST PACK FOLDERS ---
router.get('/pack-folders', (req, res) => {
    const folders = db.getPackFolders();
    res.json(folders);
});

// --- GET PACK FOLDER ---
router.get('/pack-folders/:id', (req, res) => {
    const folder = db.getPackFolderById(req.params.id);
    if (!folder) {
        return res.status(404).json({ error: 'Pack folder not found' });
    }
    res.json(folder);
});

// --- CREATE PACK FOLDER ---
router.post('/pack-folders', (req, res) => {
    const { name, color, parentId } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Folder name required' });
    }

    const folder = db.addPackFolder(name, color || '#6366F1', parentId || null);
    triggerGitSync('create pack folder');
    res.json(folder);
});

// --- UPDATE PACK FOLDER ---
router.patch('/pack-folders/:id', (req, res) => {
    const folder = db.getPackFolderById(req.params.id);
    if (!folder) {
        return res.status(404).json({ error: 'Pack folder not found' });
    }

    const { name, color, parentId } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (color !== undefined) updates.color = color;
    if (parentId !== undefined) updates.parentId = parentId;

    const updatedFolder = db.updatePackFolder(folder.id, updates);
    triggerGitSync('update pack folder');
    res.json(updatedFolder);
});

// --- DELETE PACK FOLDER ---
router.delete('/pack-folders/:id', (req, res) => {
    const folder = db.getPackFolderById(req.params.id);
    if (!folder) {
        return res.status(404).json({ error: 'Pack folder not found' });
    }

    // Move packs in this folder to no folder
    const packs = db.getPacks().filter(p => p.folderId === folder.id);
    for (const pack of packs) {
        db.updatePack(pack.id, { folderId: null });
    }

    db.deletePackFolder(folder.id);
    triggerGitSync('delete pack folder');
    res.json({ success: true, id: folder.id });
});

module.exports = router;
