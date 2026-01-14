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
                presentations: [],
                slides: []
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
        if (!db.slides) db.slides = [];  // Phase 2: Slide library
        return db;
    } catch (e) {
        return { collections: [], folders: [], tags: [], presentations: [], slides: [] };
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

// Update presentation with collection/folder/tags/description
const updatePresentationOrganization = (id, { collectionId, folderId, tagIds, description }) => {
    const db = readDB();
    const idx = db.presentations.findIndex(p => p.id === id);
    if (idx !== -1) {
        if (collectionId !== undefined) db.presentations[idx].collectionId = collectionId;
        if (folderId !== undefined) db.presentations[idx].folderId = folderId;
        if (tagIds !== undefined) db.presentations[idx].tagIds = tagIds;
        if (description !== undefined) db.presentations[idx].description = description;
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
    // Remove tag from all slides
    db.slides.forEach(s => {
        if (s.tagIds && s.tagIds.includes(id)) {
            s.tagIds = s.tagIds.filter(tid => tid !== id);
        }
    });
    writeDB(db);
};

// ==================== SLIDES (Phase 2) ====================

const getSlides = (filters = {}) => {
    const db = readDB();
    let slides = db.slides;

    // Filter by sourceId
    if (filters.sourceId) {
        slides = slides.filter(s => s.sourceId === filters.sourceId);
    }

    // Filter by collectionId
    if (filters.collectionId) {
        slides = slides.filter(s => s.collectionId === filters.collectionId);
    }

    // Filter by folderId
    if (filters.folderId) {
        slides = slides.filter(s => s.folderId === filters.folderId);
    }

    // Filter by tagId
    if (filters.tagId) {
        slides = slides.filter(s => s.tagIds && s.tagIds.includes(filters.tagId));
    }

    // Filter by starred
    if (filters.starred !== undefined) {
        slides = slides.filter(s => s.starred === filters.starred);
    }

    // Search in title/notes
    if (filters.search) {
        const query = filters.search.toLowerCase();
        slides = slides.filter(s =>
            (s.title && s.title.toLowerCase().includes(query)) ||
            (s.notes && s.notes.toLowerCase().includes(query))
        );
    }

    return slides;
};

const getSlideById = (id) => {
    const db = readDB();
    return db.slides.find(s => s.id === id) || null;
};

const addSlide = (sourceId, sourceSlideOrder, metadata = {}) => {
    const db = readDB();
    // Inherit tags, collection, and folder from source presentation
    const sourcePresentation = db.presentations.find(p => p.id === sourceId);
    const inheritedTags = sourcePresentation?.tagIds || [];
    const inheritedCollectionId = sourcePresentation?.collectionId || null;
    const inheritedFolderId = sourcePresentation?.folderId || null;

    const newSlide = {
        id: uuid(),
        sourceId,
        sourceSlideOrder,
        title: metadata.title || `Slide ${sourceSlideOrder}`,
        status: 'promoted',
        lastModified: new Date().toISOString(),
        contentPath: null,  // null = use source JSON
        collectionId: inheritedCollectionId,
        folderId: inheritedFolderId,
        tagIds: [...inheritedTags],
        starred: false,
        notes: '',
        metadata: {
            layout: metadata.layout || '',
            hasScreenshot: metadata.hasScreenshot || false,
            contentTypes: metadata.contentTypes || [],
            wordCount: metadata.wordCount || 0
        }
    };
    db.slides.push(newSlide);
    writeDB(db);
    return newSlide;
};

const updateSlide = (id, updates) => {
    const db = readDB();
    const idx = db.slides.findIndex(s => s.id === id);
    if (idx !== -1) {
        const slide = db.slides[idx];
        if (updates.title !== undefined) slide.title = updates.title;
        if (updates.tagIds !== undefined) slide.tagIds = updates.tagIds;
        if (updates.starred !== undefined) slide.starred = updates.starred;
        if (updates.notes !== undefined) slide.notes = updates.notes;
        if (updates.contentPath !== undefined) slide.contentPath = updates.contentPath;
        if (updates.collectionId !== undefined) slide.collectionId = updates.collectionId;
        if (updates.folderId !== undefined) slide.folderId = updates.folderId;
        if (updates.searchableText !== undefined) slide.searchableText = updates.searchableText;
        if (updates.embedding !== undefined) slide.embedding = updates.embedding;
        if (updates.embeddingModel !== undefined) slide.embeddingModel = updates.embeddingModel;
        if (updates.embeddingGeneratedAt !== undefined) slide.embeddingGeneratedAt = updates.embeddingGeneratedAt;
        if (updates.metadata !== undefined) {
            slide.metadata = { ...slide.metadata, ...updates.metadata };
        }
        slide.lastModified = new Date().toISOString();
        writeDB(db);
        return slide;
    }
    return null;
};

const deleteSlide = (id) => {
    const db = readDB();
    db.slides = db.slides.filter(s => s.id !== id);
    writeDB(db);
};

// Promote a single slide from a source presentation
const promoteSlide = (sourceId, sourceSlideOrder, metadata = {}) => {
    // Check if already promoted
    const db = readDB();
    const existing = db.slides.find(s =>
        s.sourceId === sourceId && s.sourceSlideOrder === sourceSlideOrder
    );
    if (existing) {
        return existing;  // Already promoted
    }
    return addSlide(sourceId, sourceSlideOrder, metadata);
};

// Promote multiple slides at once
const promoteBulkSlides = (sourceId, slidesData) => {
    const db = readDB();
    const results = [];

    // Inherit tags, collection, and folder from source presentation
    const sourcePresentation = db.presentations.find(p => p.id === sourceId);
    const inheritedTags = sourcePresentation?.tagIds || [];
    const inheritedCollectionId = sourcePresentation?.collectionId || null;
    const inheritedFolderId = sourcePresentation?.folderId || null;

    for (const slideData of slidesData) {
        const { slideOrder, ...metadata } = slideData;
        // Check if already promoted
        const existing = db.slides.find(s =>
            s.sourceId === sourceId && s.sourceSlideOrder === slideOrder
        );
        if (existing) {
            results.push(existing);
        } else {
            const newSlide = {
                id: uuid(),
                sourceId,
                sourceSlideOrder: slideOrder,
                title: metadata.title || `Slide ${slideOrder}`,
                status: 'promoted',
                lastModified: new Date().toISOString(),
                contentPath: null,
                collectionId: inheritedCollectionId,
                folderId: inheritedFolderId,
                tagIds: [...inheritedTags],
                starred: false,
                notes: '',
                metadata: {
                    layout: metadata.layout || '',
                    hasScreenshot: metadata.hasScreenshot || false,
                    contentTypes: metadata.contentTypes || [],
                    wordCount: metadata.wordCount || 0
                }
            };
            db.slides.push(newSlide);
            results.push(newSlide);
        }
    }

    writeDB(db);
    return results;
};

// Demote a slide (remove from library, doesn't affect source)
const demoteSlide = (id) => {
    deleteSlide(id);
};

// Bulk add/remove tag from slides
const bulkTagSlides = (slideIds, tagId, action) => {
    const db = readDB();
    slideIds.forEach(slideId => {
        const slide = db.slides.find(s => s.id === slideId);
        if (slide) {
            if (!slide.tagIds) slide.tagIds = [];
            if (action === 'add' && !slide.tagIds.includes(tagId)) {
                slide.tagIds.push(tagId);
            } else if (action === 'remove') {
                slide.tagIds = slide.tagIds.filter(tid => tid !== tagId);
            }
            slide.lastModified = new Date().toISOString();
        }
    });
    writeDB(db);
};

// Sync organization for existing slides (migration)
const syncSlideOrganization = () => {
    const db = readDB();
    let updated = 0;

    db.slides.forEach(slide => {
        const presentation = db.presentations.find(p => p.id === slide.sourceId);
        if (presentation) {
            const newCollectionId = presentation.collectionId || null;
            const newFolderId = presentation.folderId || null;

            if (slide.collectionId !== newCollectionId || slide.folderId !== newFolderId) {
                slide.collectionId = newCollectionId;
                slide.folderId = newFolderId;
                slide.lastModified = new Date().toISOString();
                updated++;
            }
        }
    });

    if (updated > 0) {
        writeDB(db);
    }
    return { updated, total: db.slides.length };
};

// ==================== PACKS ====================

const getPacks = () => {
    const db = readDB();
    // Ensure all packs have folderId for backwards compatibility
    return (db.packs || []).map(p => ({ folderId: null, ...p }));
};

const getPackById = (id) => {
    const db = readDB();
    const pack = (db.packs || []).find(p => p.id === id);
    // Ensure folderId exists for backwards compatibility
    return pack ? { folderId: null, ...pack } : null;
};

const addPack = (name, slideIds = [], description = '', color = '#8B5CF6', folderId = null) => {
    const db = readDB();
    if (!db.packs) db.packs = [];

    const newPack = {
        id: uuid(),
        name,
        description,
        color,
        slideIds,
        folderId,
        createdAt: new Date().toISOString(),
        lastModifiedAt: new Date().toISOString()
    };

    db.packs.push(newPack);
    writeDB(db);
    return newPack;
};

const updatePack = (id, updates) => {
    const db = readDB();
    if (!db.packs) return null;

    const idx = db.packs.findIndex(p => p.id === id);
    if (idx === -1) return null;

    const pack = db.packs[idx];
    if (updates.name !== undefined) pack.name = updates.name;
    if (updates.description !== undefined) pack.description = updates.description;
    if (updates.color !== undefined) pack.color = updates.color;
    if (updates.slideIds !== undefined) pack.slideIds = updates.slideIds;
    if (updates.folderId !== undefined) pack.folderId = updates.folderId || null;
    pack.lastModifiedAt = new Date().toISOString();

    writeDB(db);
    return pack;
};

const deletePack = (id) => {
    const db = readDB();
    if (!db.packs) return;
    db.packs = db.packs.filter(p => p.id !== id);
    writeDB(db);
};

// ==================== PACK FOLDERS ====================

const getPackFolders = () => {
    const db = readDB();
    return db.packFolders || [];
};

const getPackFolderById = (id) => {
    const db = readDB();
    return (db.packFolders || []).find(f => f.id === id) || null;
};

const addPackFolder = (name, color = '#6366F1', parentId = null) => {
    const db = readDB();
    if (!db.packFolders) db.packFolders = [];

    const newFolder = {
        id: uuid(),
        name,
        color,
        parentId,
        createdAt: new Date().toISOString()
    };

    db.packFolders.push(newFolder);
    writeDB(db);
    return newFolder;
};

const updatePackFolder = (id, updates) => {
    const db = readDB();
    if (!db.packFolders) return null;

    const idx = db.packFolders.findIndex(f => f.id === id);
    if (idx === -1) return null;

    const folder = db.packFolders[idx];
    if (updates.name !== undefined) folder.name = updates.name;
    if (updates.color !== undefined) folder.color = updates.color;
    if (updates.parentId !== undefined) folder.parentId = updates.parentId || null;

    writeDB(db);
    return folder;
};

const deletePackFolder = (id) => {
    const db = readDB();
    if (!db.packFolders) return;

    // Remove the folder
    db.packFolders = db.packFolders.filter(f => f.id !== id);

    // Update packs that were in this folder to have no folder
    if (db.packs) {
        db.packs = db.packs.map(p => p.folderId === id ? { ...p, folderId: null } : p);
    }

    // Move child folders to root
    db.packFolders = db.packFolders.map(f => f.parentId === id ? { ...f, parentId: null } : f);

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
    deleteTag,
    // Slides (Phase 2)
    getSlides,
    getSlideById,
    addSlide,
    updateSlide,
    deleteSlide,
    promoteSlide,
    promoteBulkSlides,
    demoteSlide,
    bulkTagSlides,
    syncSlideOrganization,
    // Packs
    getPacks,
    getPackById,
    addPack,
    updatePack,
    deletePack,
    // Pack Folders
    getPackFolders,
    getPackFolderById,
    addPackFolder,
    updatePackFolder,
    deletePackFolder
};
