const express = require('express');
const db = require('../db');

const router = express.Router();

// --- COLLECTIONS ---

router.get('/collections', (req, res) => {
    res.json(db.getCollections());
});

router.post('/collections', (req, res) => {
    const { name, description, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const collection = db.addCollection(name, description, color);
    res.json(collection);
});

router.patch('/collections/:id', (req, res) => {
    const { name, description, color } = req.body;
    const collection = db.updateCollection(req.params.id, { name, description, color });
    if (!collection) return res.status(404).json({ error: 'Collection not found' });
    res.json(collection);
});

router.delete('/collections/:id', (req, res) => {
    db.deleteCollection(req.params.id);
    res.json({ success: true });
});

// --- FOLDERS ---

router.get('/collections/:collId/folders', (req, res) => {
    res.json(db.getFolders(req.params.collId));
});

router.post('/collections/:collId/folders', (req, res) => {
    const { name, parentId } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const folder = db.addFolder(req.params.collId, name, parentId);
    res.json(folder);
});

router.patch('/folders/:id', (req, res) => {
    const { name, parentId, order } = req.body;
    const folder = db.updateFolder(req.params.id, { name, parentId, order });
    if (!folder) return res.status(404).json({ error: 'Folder not found' });
    res.json(folder);
});

router.delete('/folders/:id', (req, res) => {
    db.deleteFolder(req.params.id);
    res.json({ success: true });
});

// --- TAGS ---

router.get('/collections/:collId/tags', (req, res) => {
    res.json(db.getTags(req.params.collId));
});

router.post('/collections/:collId/tags', (req, res) => {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const tag = db.addTag(req.params.collId, name, color);
    res.json(tag);
});

router.patch('/tags/:id', (req, res) => {
    const { name, color } = req.body;
    const tag = db.updateTag(req.params.id, { name, color });
    if (!tag) return res.status(404).json({ error: 'Tag not found' });
    res.json(tag);
});

router.delete('/tags/:id', (req, res) => {
    db.deleteTag(req.params.id);
    res.json({ success: true });
});

module.exports = router;
