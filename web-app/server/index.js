const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const ai = require('./ai');
require('dotenv').config();

const app = express();
const PORT = 3001;

// Paths
const ROOT_DIR = path.resolve(__dirname, '../../');
const PYTHON_PATH = path.join(ROOT_DIR, '.venv/bin/python3');
const CLI_PATH = path.join(ROOT_DIR, 'src/ppt_to_learning/cli.py');

// Directories
const SOURCES_DIR = path.join(__dirname, 'uploads', 'sources');
const STORAGE_DIR = path.join(__dirname, 'storage');

// Legacy Paths
const LEGACY_BASE_DIR = path.join(ROOT_DIR, 'output/czech');
const LEGACY_JSON_DIR = path.join(LEGACY_BASE_DIR, 'json');
const LEGACY_MEDIA_DIR = path.join(LEGACY_BASE_DIR, 'media');

// Ensure directories exist
if (!fs.existsSync(SOURCES_DIR)) fs.mkdirSync(SOURCES_DIR, { recursive: true });
if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow larger payloads for JSON edits

// Serve static media
app.use('/media', express.static(STORAGE_DIR));
app.use('/legacy-media', express.static(LEGACY_MEDIA_DIR));

// Configure Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, SOURCES_DIR),
    filename: (req, file, cb) => {
        const id = uuidv4();
        const filename = `${id}${path.extname(file.originalname)}`;
        req.fileId = id;
        cb(null, filename);
    }
});
const upload = multer({ storage: storage });
const memUpload = multer({ storage: multer.memoryStorage() });

// --- API ROUTES ---

// 1. Upload and Convert
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const id = req.fileId;
    db.addPresentation(id, req.file.filename, req.file.originalname);
    const outputDir = path.join(STORAGE_DIR, id);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    
    runConversion(id, req.file.path, outputDir);
    res.json({ id: id, status: 'processing', filename: req.file.originalname });
});

function runConversion(id, inputPath, outputDir) {
    db.updateStatus(id, 'processing');
    const pythonProcess = spawn(PYTHON_PATH, [
        '-m', 'src.ppt_to_learning.cli',
        '--input', inputPath,
        '--output', outputDir,
        '--verbose'
    ], { cwd: ROOT_DIR });

    pythonProcess.on('close', (code) => {
        db.updateStatus(id, code === 0 ? 'completed' : 'failed');
    });
}

// 2. Reprocess
app.post('/api/reprocess/:id', (req, res) => {
    const id = req.params.id;
    const presentation = db.getPresentations().find(p => p.id === id);
    if (!presentation) return res.status(404).json({ error: 'Presentation not found' });
    runConversion(id, path.join(SOURCES_DIR, presentation.filename), path.join(STORAGE_DIR, id));
    res.json({ id, status: 'processing' });
});

// 3. List
app.get('/api/presentations', (req, res) => {
    res.json(db.getPresentations().map(p => ({ ...p, resultId: path.parse(p.filename).name })));
});

// 4. View
app.get('/api/view/:id/:resultId', (req, res) => {
    const { id, resultId } = req.params;
    let filePath = path.join(id === 'legacy' ? LEGACY_JSON_DIR : path.join(STORAGE_DIR, id, 'json'), `${resultId}.json`);
    if (fs.existsSync(filePath)) res.sendFile(filePath);
    else res.status(404).json({ error: 'File not found' });
});

// 5. Update (Save Edits)
app.put('/api/view/:id/:resultId', (req, res) => {
    const { id, resultId } = req.params;
    const dir = id === 'legacy' ? LEGACY_JSON_DIR : path.join(STORAGE_DIR, id, 'json');
    const filePath = path.join(dir, `${resultId}.json`);
    
    try {
        fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
        res.json({ status: 'saved' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to save edits' });
    }
});

// --- AI ROUTES ---

// 6. AI: Analyze Slide
app.post('/api/ai/analyze', async (req, res) => {
    try {
        const userKey = req.headers['x-gemini-key'];
        const { slide, prompt } = req.body;
        const report = await ai.analyzeSlide(slide, userKey, prompt);
        res.json({ report });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 7. AI: Fix with Screenshot
app.post('/api/ai/fix', memUpload.single('screenshot'), async (req, res) => {
    try {
        const userKey = req.headers['x-gemini-key'];
        const currentJson = JSON.parse(req.body.currentJson);
        const customPrompt = req.body.prompt;
        const suggestedContent = await ai.fixWithScreenshot(
            req.file.buffer, 
            req.file.mimetype,
            currentJson,
            userKey,
            customPrompt
        );
        res.json({ suggestedContent });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Status and Legacy list remains...
app.get('/api/status/:id', (req, res) => {
    const id = req.params.id;
    const p = db.getPresentations().find(p => p.id === id);
    if (p) return res.json({ status: p.status, resultId: p.id });
    res.json({ status: 'not_found' });
});

app.get('/api/legacy/list', (req, res) => {
    if (!fs.existsSync(LEGACY_JSON_DIR)) return res.json([]);
    res.json(fs.readdirSync(LEGACY_JSON_DIR).filter(f => f.endsWith('.json')).map(f => ({ id: path.parse(f).name, filename: f })));
});

app.get('/api/legacy/view/:id', (req, res) => {
    const filePath = path.join(LEGACY_JSON_DIR, `${req.params.id}.json`);
    if (fs.existsSync(filePath)) res.sendFile(filePath);
    else res.status(404).json({ error: 'File not found' });
});

app.get('/', (req, res) => {
    res.send('PPT to Learning API Server is running.');
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));