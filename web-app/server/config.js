const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, 'app-config.json');

const defaultConfig = {
    // Data storage path (relative to server dir or absolute)
    dataPath: null, // null = use default (./uploads, ./storage, ./data.json)

    // Git sync settings
    gitSync: {
        enabled: false,
        autoCommit: true,
        autoPush: false,
        commitMessage: 'Auto-save: {action}',
        remote: 'origin',
        branch: 'main'
    }
};

let config = { ...defaultConfig };

// Load config from file
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            const loaded = JSON.parse(data);
            config = { ...defaultConfig, ...loaded, gitSync: { ...defaultConfig.gitSync, ...loaded.gitSync } };
        }
    } catch (err) {
        console.error('Failed to load config:', err.message);
    }
    return config;
}

// Save config to file
function saveConfig(newConfig) {
    try {
        config = { ...config, ...newConfig, gitSync: { ...config.gitSync, ...newConfig.gitSync } };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        return true;
    } catch (err) {
        console.error('Failed to save config:', err.message);
        return false;
    }
}

// Get current config
function getConfig() {
    return config;
}

// Get resolved data paths
function getDataPaths() {
    const basePath = config.dataPath ? path.resolve(config.dataPath) : __dirname;

    return {
        basePath,
        uploadsPath: path.join(basePath, config.dataPath ? 'uploads' : 'uploads'),
        storagePath: path.join(basePath, config.dataPath ? 'storage' : 'storage'),
        dataJsonPath: path.join(basePath, config.dataPath ? 'data.json' : 'data.json')
    };
}

// Initialize data directories
function initDataDirs() {
    const paths = getDataPaths();

    // Create directories if they don't exist
    if (!fs.existsSync(paths.uploadsPath)) {
        fs.mkdirSync(paths.uploadsPath, { recursive: true });
    }
    if (!fs.existsSync(paths.storagePath)) {
        fs.mkdirSync(paths.storagePath, { recursive: true });
    }

    // Create empty data.json if it doesn't exist
    if (!fs.existsSync(paths.dataJsonPath)) {
        fs.writeFileSync(paths.dataJsonPath, JSON.stringify({
            presentations: [],
            collections: [
                {
                    id: '1dbf97e9-b978-41af-a473-64f3e1aaef60',
                    name: 'Default',
                    description: 'Default collection for imported presentations',
                    color: '#6B7280',
                    createdAt: new Date().toISOString()
                }
            ],
            folders: [],
            tags: []
        }, null, 2));
    }

    return paths;
}

// Check if data path is a git repo
function isGitRepo(dirPath) {
    const gitDir = path.join(dirPath || getDataPaths().basePath, '.git');
    return fs.existsSync(gitDir);
}

// Load config on module init
loadConfig();

module.exports = {
    loadConfig,
    saveConfig,
    getConfig,
    getDataPaths,
    initDataDirs,
    isGitRepo
};
