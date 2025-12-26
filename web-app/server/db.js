const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getDataPaths, initDataDirs } = require('./config');

// Generate UUID
const uuid = () => crypto.randomUUID();

// Get DB file path (dynamic based on config)
const getDBFile = () => getDataPaths().dataJsonPath;

// Initialize data directories on load
initDataDirs();

const readDB = () => {
    const DB_FILE = getDBFile();
    try {
        if (!fs.existsSync(DB_FILE)) {
            // Create default DB structure
            const defaultDB = {
                collections: [{
                    id: '1dbf97e9-b978-41af-a473-64f3e1aaef60',
                    name: 'Default',
                    description: 'Default collection for imported presentations',
                    color: '#6B7280',
                    createdAt: new Date().toISOString()
                }],
                folders: [],
                tags: [],
                presentations: []
            };
            fs.writeFileSync(DB_FILE, JSON.stringify(defaultDB, null, 2));
            return defaultDB;
        }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        const db = JSON.parse(data);
        // Ensure all arrays exist (migration compatibility)
        if (!db.collections) db.collections = [];
        if (!db.folders) db.folders = [];
        if (!db.tags) db.tags = [];
        if (!db.presentations) db.presentations = [];
        return db;
    } catch (e) {
        return { collections: [], folders: [], tags: [], presentations: [] };
    }
};

const writeDB = (data) => {
    const DB_FILE = getDBFile();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

const addPresentation = (id, filename, originalName, options = {}) => {
    const db = readDB();
    const newEntry = {
        id,
        filename, // Stored filename
        originalName, // Display name
        uploadedAt: new Date().toISOString(),
        status: 'pending',
        collectionId: options.collectionId || null,
        folderId: options.folderId || null,
        tagIds: options.tagIds || []
    };
    db.presentations.push(newEntry);
    writeDB(db);
    return newEntry;
};

const getPresentations = () => {
    return readDB().presentations;
};

const updateStatus = (id, status) => {
    const db = readDB();
    const idx = db.presentations.findIndex(p => p.id === id);
    if (idx !== -1) {
        db.presentations[idx].status = status;
        db.presentations[idx].lastProcessedAt = new Date().toISOString();
        writeDB(db);
    }
};

const updateMetadata = (id, metadata) => {
    const db = readDB();
    const idx = db.presentations.findIndex(p => p.id === id);
    if (idx !== -1) {
        // Update with extracted metadata
        if (metadata.title) db.presentations[idx].title = metadata.title;
        if (metadata.author) db.presentations[idx].author = metadata.author;
        if (metadata.created) db.presentations[idx].created = metadata.created;
        if (metadata.modified) db.presentations[idx].modified = metadata.modified;
        if (metadata.stats) db.presentations[idx].stats = metadata.stats;
        writeDB(db);
    }
};

const deletePresentation = (id) => {
    const db = readDB();
    db.presentations = db.presentations.filter(p => p.id !== id);
    writeDB(db);
};

const updateOriginalName = (id, originalName) => {
    const db = readDB();
    const idx = db.presentations.findIndex(p => p.id === id);
    if (idx !== -1) {
        db.presentations[idx].originalName = originalName;
        writeDB(db);
    }
};

// Update presentation with collection/folder/tags
const updatePresentationOrganization = (id, { collectionId, folderId, tagIds }) => {
    const db = readDB();
    const idx = db.presentations.findIndex(p => p.id === id);
    if (idx !== -1) {
        if (collectionId !== undefined) db.presentations[idx].collectionId = collectionId;
        if (folderId !== undefined) db.presentations[idx].folderId = folderId;
        if (tagIds !== undefined) db.presentations[idx].tagIds = tagIds;
        writeDB(db);
        return db.presentations[idx];
    }
    return null;
};

// ==================== COLLECTIONS ====================

const getCollections = () => {
    return readDB().collections;
};

const addCollection = (name, description = '', color = '#3B82F6') => {
    const db = readDB();
    const newCollection = {
        id: uuid(),
        name,
        description,
        color,
        createdAt: new Date().toISOString()
    };
    db.collections.push(newCollection);
    writeDB(db);
    return newCollection;
};

const updateCollection = (id, updates) => {
    const db = readDB();
    const idx = db.collections.findIndex(c => c.id === id);
    if (idx !== -1) {
        if (updates.name !== undefined) db.collections[idx].name = updates.name;
        if (updates.description !== undefined) db.collections[idx].description = updates.description;
        if (updates.color !== undefined) db.collections[idx].color = updates.color;
        writeDB(db);
        return db.collections[idx];
    }
    return null;
};

const deleteCollection = (id) => {
    const db = readDB();
    // Remove collection
    db.collections = db.collections.filter(c => c.id !== id);
    // Remove all folders in this collection
    db.folders = db.folders.filter(f => f.collectionId !== id);
    // Remove all tags in this collection
    db.tags = db.tags.filter(t => t.collectionId !== id);
    // Clear collection reference from presentations (don't delete them)
    db.presentations.forEach(p => {
        if (p.collectionId === id) {
            p.collectionId = null;
            p.folderId = null;
            p.tagIds = [];
        }
    });
    writeDB(db);
};

// ==================== FOLDERS ====================

const getFolders = (collectionId = null) => {
    const db = readDB();
    if (collectionId) {
        return db.folders.filter(f => f.collectionId === collectionId);
    }
    return db.folders;
};

const addFolder = (collectionId, name, parentId = null) => {
    const db = readDB();
    // Determine order (add at end)
    const siblings = db.folders.filter(f =>
        f.collectionId === collectionId && f.parentId === parentId
    );
    const newFolder = {
        id: uuid(),
        collectionId,
        parentId,
        name,
        order: siblings.length
    };
    db.folders.push(newFolder);
    writeDB(db);
    return newFolder;
};

const updateFolder = (id, updates) => {
    const db = readDB();
    const idx = db.folders.findIndex(f => f.id === id);
    if (idx !== -1) {
        if (updates.name !== undefined) db.folders[idx].name = updates.name;
        if (updates.parentId !== undefined) db.folders[idx].parentId = updates.parentId;
        if (updates.order !== undefined) db.folders[idx].order = updates.order;
        writeDB(db);
        return db.folders[idx];
    }
    return null;
};

const deleteFolder = (id) => {
    const db = readDB();
    // Get all descendant folder IDs (recursive)
    const getDescendants = (folderId) => {
        const children = db.folders.filter(f => f.parentId === folderId);
        let descendants = [folderId];
        children.forEach(c => {
            descendants = descendants.concat(getDescendants(c.id));
        });
        return descendants;
    };
    const folderIds = getDescendants(id);

    // Remove all folders
    db.folders = db.folders.filter(f => !folderIds.includes(f.id));

    // Clear folder reference from presentations (move to collection root)
    db.presentations.forEach(p => {
        if (folderIds.includes(p.folderId)) {
            p.folderId = null;
        }
    });
    writeDB(db);
};

// ==================== TAGS ====================

const getTags = (collectionId = null) => {
    const db = readDB();
    if (collectionId) {
        return db.tags.filter(t => t.collectionId === collectionId);
    }
    return db.tags;
};

const addTag = (collectionId, name, color = '#10B981') => {
    const db = readDB();
    const newTag = {
        id: uuid(),
        collectionId,
        name,
        color
    };
    db.tags.push(newTag);
    writeDB(db);
    return newTag;
};

const updateTag = (id, updates) => {
    const db = readDB();
    const idx = db.tags.findIndex(t => t.id === id);
    if (idx !== -1) {
        if (updates.name !== undefined) db.tags[idx].name = updates.name;
        if (updates.color !== undefined) db.tags[idx].color = updates.color;
        writeDB(db);
        return db.tags[idx];
    }
    return null;
};

const deleteTag = (id) => {
    const db = readDB();
    db.tags = db.tags.filter(t => t.id !== id);
    // Remove tag from all presentations
    db.presentations.forEach(p => {
        if (p.tagIds && p.tagIds.includes(id)) {
            p.tagIds = p.tagIds.filter(tid => tid !== id);
        }
    });
    writeDB(db);
};

module.exports = {
    // Presentations
    addPresentation,
    getPresentations,
    updateStatus,
    updateMetadata,
    deletePresentation,
    updateOriginalName,
    updatePresentationOrganization,
    // Collections
    getCollections,
    addCollection,
    updateCollection,
    deleteCollection,
    // Folders
    getFolders,
    addFolder,
    updateFolder,
    deleteFolder,
    // Tags
    getTags,
    addTag,
    updateTag,
    deleteTag
};
