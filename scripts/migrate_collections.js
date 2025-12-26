/**
 * Migration script for Collections, Folders, and Tags
 *
 * This script:
 * 1. Creates a "Default" collection for existing presentations without one
 * 2. Ensures all presentations have collectionId, folderId, and tagIds fields
 *
 * Run from project root: node scripts/migrate_collections.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_FILE = path.join(__dirname, '../web-app/server/data.json');

const uuid = () => crypto.randomUUID();

function migrate() {
    console.log('Starting collections migration...\n');

    // Read current database
    if (!fs.existsSync(DB_FILE)) {
        console.error('Database file not found:', DB_FILE);
        process.exit(1);
    }

    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

    // Ensure arrays exist
    if (!db.collections) db.collections = [];
    if (!db.folders) db.folders = [];
    if (!db.tags) db.tags = [];
    if (!db.presentations) db.presentations = [];

    console.log(`Found ${db.presentations.length} presentations`);
    console.log(`Found ${db.collections.length} existing collections`);

    // Find presentations without a collection
    const uncategorized = db.presentations.filter(p => !p.collectionId);
    console.log(`Found ${uncategorized.length} presentations without a collection\n`);

    // Create "Default" collection if needed
    let defaultCollection = db.collections.find(c => c.name === 'Default');

    if (uncategorized.length > 0 && !defaultCollection) {
        defaultCollection = {
            id: uuid(),
            name: 'Default',
            description: 'Default collection for imported presentations',
            color: '#6B7280', // Gray
            createdAt: new Date().toISOString()
        };
        db.collections.push(defaultCollection);
        console.log(`Created "Default" collection: ${defaultCollection.id}`);
    }

    // Update all presentations
    let updated = 0;
    for (const p of db.presentations) {
        let changed = false;

        // Set collectionId if missing
        if (!p.collectionId && defaultCollection) {
            p.collectionId = defaultCollection.id;
            changed = true;
        }

        // Ensure folderId exists (can be null)
        if (p.folderId === undefined) {
            p.folderId = null;
            changed = true;
        }

        // Ensure tagIds exists
        if (!p.tagIds) {
            p.tagIds = [];
            changed = true;
        }

        if (changed) {
            updated++;
        }
    }

    console.log(`Updated ${updated} presentations with organization fields`);

    // Save database
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    console.log('\nMigration complete!');
    console.log(`\nFinal stats:`);
    console.log(`  Collections: ${db.collections.length}`);
    console.log(`  Folders: ${db.folders.length}`);
    console.log(`  Tags: ${db.tags.length}`);
    console.log(`  Presentations: ${db.presentations.length}`);
}

migrate();
