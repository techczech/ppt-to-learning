const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { getDataPaths, initDataDirs } = require('./config');
const gitSync = require('./git-sync');

// Import routes
const presentationsRouter = require('./routes/presentations');
const collectionsRouter = require('./routes/collections');
const aiRouter = require('./routes/ai');
const settingsRouter = require('./routes/settings');
const slidesRouter = require('./routes/slides');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize data directories
initDataDirs();
const sourcesDir = path.join(getDataPaths().uploadsPath, 'sources');
if (!fs.existsSync(sourcesDir)) fs.mkdirSync(sourcesDir, { recursive: true });

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static media (screenshots, images)
app.use('/media', (req, res, next) => {
    express.static(getDataPaths().storagePath)(req, res, next);
});

// Git sync helper
async function triggerGitSync(action) {
    try {
        const result = await gitSync.sync(action);
        if (result.success) {
            console.log(`Git sync completed for: ${action}`);
        }
    } catch (e) {
        console.error(`Git sync failed for ${action}:`, e.message);
    }
}

// Pass git sync to routers
presentationsRouter.setGitSync(triggerGitSync);
collectionsRouter.setGitSync(triggerGitSync);
slidesRouter.setGitSync(triggerGitSync);

// Mount routes
app.use('/api', presentationsRouter);
app.use('/api', collectionsRouter);
app.use('/api', aiRouter);
app.use('/api', settingsRouter);
app.use('/api', slidesRouter);

// Root endpoint
app.get('/', (req, res) => {
    res.send('PPT to Learning API Server is running.');
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
