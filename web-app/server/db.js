const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.json');

// Initialize DB if not exists
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ presentations: [] }, null, 2));
}

const readDB = () => {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return { presentations: [] };
    }
};

const writeDB = (data) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

const addPresentation = (id, filename, originalName) => {
    const db = readDB();
    const newEntry = {
        id,
        filename, // Stored filename
        originalName, // Display name
        uploadedAt: new Date().toISOString(),
        status: 'pending'
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

module.exports = {
    addPresentation,
    getPresentations,
    updateStatus
};
