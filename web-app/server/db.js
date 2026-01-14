const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getDataPaths, initDataDirs } = require('./config');

// Generate UUID
const uuid = () => crypto.randomUUID();

// Get DB file path (dynamic based on config)
const getDBFile = () => getDataPaths().dataJsonPath;
const getStorageDir = () => getDataPaths().storagePath;

// Initialize data directories on load
initDataDirs();

/**
 * NEW APPROACH: Read presentations from folder metadata files
 * Each presentation folder contains metadata.json with all info
 * This eliminates sync conflicts across computers
 */
const scanPresentationFolders = () => {
    const storageDir = getStorageDir();
    const presentations = [];

    if (!fs.existsSync(storageDir)) {
        return presentations;
    }

    const folders = fs.readdirSync(storageDir);
    for (const folderName of folders) {
        const folderPath = path.join(storageDir, folderName);
        if (!fs.statSync(folderPath).isDirectory()) continue;
        if (folderName.startsWith('.')) continue;

        const metadataFile = path.join(folderPath, 'metadata.json');

        if (fs.existsSync(metadataFile)) {
            try {
                const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
                presentations.push(metadata);
            } catch (e) {
                console.error(`Error reading metadata from ${folderName}:`, e.message);
            }
        } else {
            // Folder exists but no metadata - try to create it
            console.warn(`No metadata.json for ${folderName}, attempting to create...`);
            try {
                const created = createMetadataForFolder(folderName);
                if (created) {
                    presentations.push(created);
                }
            } catch (e) {
                console.error(`Failed to create metadata for ${folderName}:`, e.message);
            }
        }
    }

    return presentations;
};

/**
 * Create metadata.json for a folder that doesn't have one
 */
const createMetadataForFolder = (folderId) => {
    const folderPath = path.join(getStorageDir(), folderId);
    const jsonFile = path.join(folderPath, 'json', `${folderId}.json`);
    const metadataFile = path.join(folderPath, 'metadata.json');

    const metadata = {
        id: folderId,
        filename: `${folderId}.pptx`,
        originalName: 'Unknown',
        uploadedAt: new Date().toISOString(),
        status: 'completed',
        collectionId: null,
        folderId: null,
        tagIds: []
    };

    // Try to extract info from JSON file
    if (fs.existsSync(jsonFile)) {
        try {
            const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
            const extracted = data.metadata || {};

            if (extracted.source_file) {
                metadata.originalName = extracted.source_file;
            }
            if (extracted.processed_at) {
                metadata.uploadedAt = extracted.processed_at;
                metadata.lastProcessedAt = extracted.processed_at;
            }
            if (extracted.stats) {
                metadata.stats = extracted.stats;
            }
        } catch (e) {
            console.error(`Error reading JSON for ${folderId}:`, e.message);
        }
    }

    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
    return metadata;
};

/**
 * Write metadata to a presentation folder
 */
const writeFolderMetadata = (presentationId, metadata) => {
    const metadataFile = path.join(getStorageDir(), presentationId, 'metadata.json');
    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
};

/**
 * Read the full database (presentations from folders + collections/tags/slides from data.json)
 */
const readDB = () => {
    const DB_FILE = getDBFile();

    // Read presentations from folders
    const presentations = scanPresentationFolders();

    // Read other data from data.json (collections, folders, tags, slides)
    let otherData = {
        collections: [{
            id: '1dbf97e9-b978-41af-a473-64f3e1aaef60',
            name: 'Default',
            description: 'Default collection for imported presentations',
            color: '#6B7280',
            createdAt: new Date().toISOString()
        }],
        folders: [],
        tags: [],
        slides: [],
        packs: [],
        packFolders: []
    };

    if (fs.existsSync(DB_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
            otherData.collections = data.collections || otherData.collections;
            otherData.folders = data.folders || [];
            otherData.tags = data.tags || [];
            otherData.slides = data.slides || [];
            otherData.packs = data.packs || [];
            otherData.packFolders = data.packFolders || [];
        } catch (e) {
            console.error('Error reading data.json:', e.message);
        }
    }

    return {
        presentations,
        ...otherData
    };
};

/**
 * Write the database (write presentations to data.json for compatibility)
 */
const writeDB = (data) => {
    const DB_FILE = getDBFile();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

/**
 * Add a new presentation
 */
const addPresentation = (id, filename, originalName, options = {}) => {
    const metadata = {
        id,
        filename,
        originalName,
        uploadedAt: new Date().toISOString(),
        status: 'pending',
        collectionId: options.collectionId || null,
        folderId: options.folderId || null,
        tagIds: options.tagIds || []
    };

    // Write to folder
    writeFolderMetadata(id, metadata);

    // Also write to data.json for compatibility
    const db = readDB();
    db.presentations.push(metadata);
    writeDB(db);

    return metadata;
};

const getPresentations = () => {
    return readDB().presentations;
};

const updateStatus = (id, status) => {
    const presentations = scanPresentationFolders();
    const presentation = presentations.find(p => p.id === id);

    if (presentation) {
        presentation.status = status;
        presentation.lastProcessedAt = new Date().toISOString();
        writeFolderMetadata(id, presentation);

        // Update data.json for compatibility
        const db = readDB();
        const idx = db.presentations.findIndex(p => p.id === id);
        if (idx !== -1) {
            db.presentations[idx] = presentation;
            writeDB(db);
        }
    }
};

const updateMetadata = (id, metadata) => {
    const presentations = scanPresentationFolders();
    const presentation = presentations.find(p => p.id === id);

    if (presentation) {
        if (metadata.title) presentation.title = metadata.title;
        if (metadata.author) presentation.author = metadata.author;
        if (metadata.created) presentation.created = metadata.created;
        if (metadata.modified) presentation.modified = metadata.modified;
        if (metadata.stats) presentation.stats = metadata.stats;

        writeFolderMetadata(id, presentation);

        // Update data.json for compatibility
        const db = readDB();
        const idx = db.presentations.findIndex(p => p.id === id);
        if (idx !== -1) {
            db.presentations[idx] = presentation;
            writeDB(db);
        }
    }
};

const deletePresentation = (id) => {
    // Delete folder metadata
    const metadataFile = path.join(getStorageDir(), id, 'metadata.json');
    if (fs.existsSync(metadataFile)) {
        fs.unlinkSync(metadataFile);
    }

    // Update data.json
    const db = readDB();
    db.presentations = db.presentations.filter(p => p.id !== id);
    writeDB(db);
};

const updateOriginalName = (id, originalName) => {
    const presentations = scanPresentationFolders();
    const presentation = presentations.find(p => p.id === id);

    if (presentation) {
        presentation.originalName = originalName;
        writeFolderMetadata(id, presentation);

        const db = readDB();
        const idx = db.presentations.findIndex(p => p.id === id);
        if (idx !== -1) {
            db.presentations[idx] = presentation;
            writeDB(db);
        }
    }
};

const updatePresentationOrganization = (id, { collectionId, folderId, tagIds, description }) => {
    const presentations = scanPresentationFolders();
    const presentation = presentations.find(p => p.id === id);

    if (presentation) {
        if (collectionId !== undefined) presentation.collectionId = collectionId;
        if (folderId !== undefined) presentation.folderId = folderId;
        if (tagIds !== undefined) presentation.tagIds = tagIds;
        if (description !== undefined) presentation.description = description;

        writeFolderMetadata(id, presentation);

        const db = readDB();
        const idx = db.presentations.findIndex(p => p.id === id);
        if (idx !== -1) {
            db.presentations[idx] = presentation;
            writeDB(db);
        }

        return presentation;
    }
    return null;
};

// Import all other functions from original db.js (collections, folders, tags, slides, packs)
// These don't change - they still use data.json
const getCollections = () => readDB().collections;
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
    db.collections = db.collections.filter(c => c.id !== id);
    db.folders = db.folders.filter(f => f.collectionId !== id);
    db.tags = db.tags.filter(t => t.collectionId !== id);

    // Clear collection reference from presentations (update folder metadata)
    db.presentations.forEach(p => {
        if (p.collectionId === id) {
            p.collectionId = null;
            p.folderId = null;
            p.tagIds = [];
            writeFolderMetadata(p.id, p);
        }
    });

    writeDB(db);
};

// Re-export all the rest of the functions unchanged
// For brevity, importing from original db.js for folders, tags, slides, packs
const originalDb = require('./db');

module.exports = {
    // Presentations (new folder-based)
    addPresentation,
    getPresentations,
    updateStatus,
    updateMetadata,
    deletePresentation,
    updateOriginalName,
    updatePresentationOrganization,
    // Utility
    scanPresentationFolders,
    writeFolderMetadata,
    // Collections (from data.json)
    getCollections,
    addCollection,
    updateCollection,
    deleteCollection,
    // Everything else from original db
    getFolders: originalDb.getFolders,
    addFolder: originalDb.addFolder,
    updateFolder: originalDb.updateFolder,
    deleteFolder: originalDb.deleteFolder,
    getTags: originalDb.getTags,
    addTag: originalDb.addTag,
    updateTag: originalDb.updateTag,
    deleteTag: originalDb.deleteTag,
    getSlides: originalDb.getSlides,
    getSlideById: originalDb.getSlideById,
    addSlide: originalDb.addSlide,
    updateSlide: originalDb.updateSlide,
    deleteSlide: originalDb.deleteSlide,
    promoteSlide: originalDb.promoteSlide,
    promoteBulkSlides: originalDb.promoteBulkSlides,
    demoteSlide: originalDb.demoteSlide,
    bulkTagSlides: originalDb.bulkTagSlides,
    syncSlideOrganization: originalDb.syncSlideOrganization,
    getPacks: originalDb.getPacks,
    getPackById: originalDb.getPackById,
    addPack: originalDb.addPack,
    updatePack: originalDb.updatePack,
    deletePack: originalDb.deletePack,
    getPackFolders: originalDb.getPackFolders,
    getPackFolderById: originalDb.getPackFolderById,
    addPackFolder: originalDb.addPackFolder,
    updatePackFolder: originalDb.updatePackFolder,
    deletePackFolder: originalDb.deletePackFolder
};
