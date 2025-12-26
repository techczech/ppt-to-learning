#!/usr/bin/env node

/**
 * Migration script to move legacy presentations from output/czech/
 * to the new web-app/server/storage/ structure.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// UUID v4 generator using built-in crypto
function uuidv4() {
    return crypto.randomUUID();
}

// Paths
const LEGACY_JSON_DIR = path.join(__dirname, '..', 'output', 'czech', 'json');
const LEGACY_MEDIA_DIR = path.join(__dirname, '..', 'output', 'czech', 'media');
const STORAGE_DIR = path.join(__dirname, '..', 'web-app', 'server', 'storage');
const DATA_FILE = path.join(__dirname, '..', 'web-app', 'server', 'data.json');

// Helper to copy directory recursively
function copyDirRecursive(src, dest) {
    if (!fs.existsSync(src)) {
        console.log(`  Warning: Source media directory not found: ${src}`);
        return false;
    }

    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
    return true;
}

// Read current database
function readDB() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return { presentations: [] };
    }
}

// Write database
function writeDB(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Extract title from presentation JSON
function extractTitle(jsonData) {
    try {
        if (jsonData.sections && jsonData.sections[0] && jsonData.sections[0].slides && jsonData.sections[0].slides[0]) {
            const title = jsonData.sections[0].slides[0].title;
            if (title) {
                // Clean up vertical tabs and truncate if too long
                return title.replace(/\u000b/g, ' ').trim().substring(0, 100);
            }
        }
    } catch (e) {}
    return null;
}

// Update media paths in JSON content
function updateMediaPaths(obj, oldId, newId) {
    if (typeof obj === 'string') {
        // Replace media paths
        return obj.replace(new RegExp(`media/${escapeRegex(oldId)}/`, 'g'), `media/${newId}/`);
    }
    if (Array.isArray(obj)) {
        return obj.map(item => updateMediaPaths(item, oldId, newId));
    }
    if (obj && typeof obj === 'object') {
        const result = {};
        for (const key in obj) {
            result[key] = updateMediaPaths(obj[key], oldId, newId);
        }
        return result;
    }
    return obj;
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Main migration function
async function migrate() {
    console.log('=== Legacy Presentation Migration ===\n');

    // Check if legacy directory exists
    if (!fs.existsSync(LEGACY_JSON_DIR)) {
        console.error(`Error: Legacy JSON directory not found: ${LEGACY_JSON_DIR}`);
        process.exit(1);
    }

    // Get all JSON files
    const jsonFiles = fs.readdirSync(LEGACY_JSON_DIR)
        .filter(f => f.endsWith('.json'));

    console.log(`Found ${jsonFiles.length} legacy presentations to migrate.\n`);

    if (jsonFiles.length === 0) {
        console.log('No files to migrate.');
        return;
    }

    const db = readDB();
    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const jsonFile of jsonFiles) {
        const oldId = path.basename(jsonFile, '.json');
        const newId = uuidv4();

        console.log(`Processing: ${oldId}`);
        console.log(`  New ID: ${newId}`);

        try {
            // Read original JSON
            const jsonPath = path.join(LEGACY_JSON_DIR, jsonFile);
            const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

            // Extract title
            const title = extractTitle(jsonData);
            console.log(`  Title: ${title || '(none)'}`);

            // Update JSON content
            const updatedJson = updateMediaPaths(jsonData, oldId, newId);
            updatedJson.metadata.id = newId;
            updatedJson.metadata.source_file = `${newId}.pptx`;

            // Create new storage directories
            const newStorageDir = path.join(STORAGE_DIR, newId);
            const newJsonDir = path.join(newStorageDir, 'json');
            const newMediaDir = path.join(newStorageDir, 'media');

            fs.mkdirSync(newJsonDir, { recursive: true });
            fs.mkdirSync(newMediaDir, { recursive: true });

            // Write updated JSON
            const newJsonPath = path.join(newJsonDir, `${newId}.json`);
            fs.writeFileSync(newJsonPath, JSON.stringify(updatedJson, null, 2));
            console.log(`  JSON written: ${newJsonPath}`);

            // Copy media folder
            const oldMediaDir = path.join(LEGACY_MEDIA_DIR, oldId);
            if (fs.existsSync(oldMediaDir)) {
                copyDirRecursive(oldMediaDir, path.join(newMediaDir, newId));
                const mediaFiles = fs.readdirSync(path.join(newMediaDir, newId)).length;
                console.log(`  Media copied: ${mediaFiles} files`);
            } else {
                console.log(`  Media: (no media folder)`);
            }

            // Add to database
            const stats = jsonData.metadata.stats || {};
            db.presentations.push({
                id: newId,
                filename: `${newId}.pptx`,
                originalName: `${oldId}.pptx`,
                uploadedAt: new Date().toISOString(),
                status: 'completed',
                lastProcessedAt: jsonData.metadata.processed_at || new Date().toISOString(),
                title: title || undefined,
                stats: stats,
                migratedFrom: 'legacy'
            });

            console.log(`  Added to database`);
            migrated++;

        } catch (e) {
            console.error(`  Error: ${e.message}`);
            errors++;
        }

        console.log('');
    }

    // Save database
    writeDB(db);

    console.log('=== Migration Complete ===');
    console.log(`  Migrated: ${migrated}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Errors: ${errors}`);
    console.log(`\nDatabase updated: ${DATA_FILE}`);
}

// Run migration
migrate().catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
});
