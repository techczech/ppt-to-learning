const express = require('express');
const { getConfig, saveConfig, getDataPaths, initDataDirs, isGitRepo } = require('../config');
const gitSync = require('../git-sync');

const router = express.Router();

// Get current settings
router.get('/settings', (req, res) => {
    const config = getConfig();
    const paths = getDataPaths();
    res.json({
        dataPath: config.dataPath,
        gitSync: config.gitSync,
        resolvedPaths: {
            basePath: paths.basePath,
            uploadsPath: paths.uploadsPath,
            storagePath: paths.storagePath,
            dataJsonPath: paths.dataJsonPath
        },
        isGitRepo: isGitRepo()
    });
});

// Update settings
router.post('/settings', (req, res) => {
    const { dataPath, gitSync: gitSyncSettings } = req.body;

    const updates = {};
    if (dataPath !== undefined) updates.dataPath = dataPath;
    if (gitSyncSettings) updates.gitSync = gitSyncSettings;

    const success = saveConfig(updates);
    if (success) {
        initDataDirs();
        res.json({ success: true, config: getConfig() });
    } else {
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

// Get git status for data repo
router.get('/settings/git-status', async (req, res) => {
    try {
        const status = await gitSync.getStatus();
        res.json(status);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Initialize git repo in data directory
router.post('/settings/git-init', async (req, res) => {
    try {
        const config = getConfig();
        if (!config.dataPath) {
            return res.status(400).json({ error: 'No data path configured' });
        }
        const result = await gitSync.initRepo();
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Add git remote
router.post('/settings/git-remote', async (req, res) => {
    try {
        const { name, url } = req.body;
        if (!name || !url) {
            return res.status(400).json({ error: 'Remote name and URL required' });
        }
        const result = await gitSync.addRemote(name, url);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Manual git sync
router.post('/settings/git-sync', async (req, res) => {
    try {
        const { message } = req.body;
        const commitResult = await gitSync.commit(message || 'Manual sync');

        const config = getConfig();
        let pushResult = null;
        if (config.gitSync.autoPush) {
            pushResult = await gitSync.push();
        }

        res.json({ commit: commitResult, push: pushResult });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Git push
router.post('/settings/git-push', async (req, res) => {
    try {
        const result = await gitSync.push();
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Clone existing repo
router.post('/settings/git-clone', async (req, res) => {
    try {
        const { url, path: targetPath } = req.body;
        if (!url || !targetPath) {
            return res.status(400).json({ error: 'Repository URL and target path required' });
        }
        const result = await gitSync.cloneRepo(url, targetPath);
        if (result.success) {
            saveConfig({ dataPath: targetPath });
            initDataDirs();
        }
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Restart server (uses shell to wait for port to be free, then starts new server)
router.post('/settings/restart', (req, res) => {
    const { exec } = require('child_process');
    const path = require('path');

    res.json({ success: true, message: 'Server restarting...' });

    const serverDir = path.join(__dirname, '..');
    const port = process.env.PORT || 3001;

    // Use a shell command that:
    // 1. Waits for the port to be free (old server died)
    // 2. Then starts the new server
    const restartScript = `
        sleep 2
        while lsof -i:${port} >/dev/null 2>&1; do sleep 0.5; done
        cd "${serverDir}" && nohup node index.js > /tmp/ppt-server.log 2>&1 &
    `;

    // Spawn the restart script detached
    const child = exec(`bash -c '${restartScript}'`, {
        detached: true,
        stdio: 'ignore'
    });
    child.unref();

    // Exit after a brief delay to send the response
    setTimeout(() => {
        console.log('Server restart requested via API - exiting');
        process.exit(0);
    }, 500);
});

module.exports = router;
