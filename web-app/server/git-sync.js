const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const { getConfig, getDataPaths, isGitRepo } = require('./config');

const execAsync = promisify(exec);

// Execute git command in data directory
async function gitExec(command, cwd) {
    const dataPath = cwd || getDataPaths().basePath;
    try {
        const { stdout, stderr } = await execAsync(`git ${command}`, { cwd: dataPath });
        return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
    } catch (err) {
        return { success: false, error: err.message, stderr: err.stderr };
    }
}

// Initialize git repo in data directory
async function initRepo(dataPath) {
    const targetPath = dataPath || getDataPaths().basePath;

    if (isGitRepo(targetPath)) {
        return { success: true, message: 'Repository already initialized' };
    }

    const result = await gitExec('init', targetPath);
    if (result.success) {
        // Create .gitignore for the data repo
        const fs = require('fs');
        const gitignorePath = path.join(targetPath, '.gitignore');
        if (!fs.existsSync(gitignorePath)) {
            fs.writeFileSync(gitignorePath, '# Temporary files\n*.tmp\n*.log\n.DS_Store\n');
        }
    }
    return result;
}

// Get git status
async function getStatus() {
    const config = getConfig();
    const dataPath = getDataPaths().basePath;

    if (!config.dataPath || !isGitRepo()) {
        return { enabled: false, reason: 'No data repository configured' };
    }

    const status = await gitExec('status --porcelain');
    const branch = await gitExec('branch --show-current');
    const remote = await gitExec('remote -v');

    return {
        enabled: config.gitSync.enabled,
        isRepo: true,
        branch: branch.stdout || 'main',
        hasRemote: remote.stdout.length > 0,
        hasChanges: status.stdout.length > 0,
        changes: status.stdout.split('\n').filter(l => l.trim())
    };
}

// Stage all changes
async function stageAll() {
    return await gitExec('add -A');
}

// Commit changes
async function commit(message) {
    const config = getConfig();
    const commitMsg = message || config.gitSync.commitMessage.replace('{action}', 'data update');

    // Stage all changes first
    const stageResult = await stageAll();
    if (!stageResult.success) {
        return stageResult;
    }

    // Check if there are changes to commit
    const status = await gitExec('status --porcelain');
    if (!status.stdout.trim()) {
        return { success: true, message: 'Nothing to commit' };
    }

    return await gitExec(`commit -m "${commitMsg}"`);
}

// Push to remote
async function push() {
    const config = getConfig();
    const remote = config.gitSync.remote || 'origin';
    const branch = config.gitSync.branch || 'main';

    return await gitExec(`push ${remote} ${branch}`);
}

// Full sync: commit and optionally push
async function sync(action = 'update') {
    const config = getConfig();

    if (!config.gitSync.enabled || !config.dataPath) {
        return { success: false, reason: 'Git sync not enabled' };
    }

    if (!isGitRepo()) {
        return { success: false, reason: 'Data directory is not a git repository' };
    }

    const results = { commit: null, push: null };

    if (config.gitSync.autoCommit) {
        const message = config.gitSync.commitMessage.replace('{action}', action);
        results.commit = await commit(message);

        if (results.commit.success && config.gitSync.autoPush) {
            results.push = await push();
        }
    }

    return { success: true, results };
}

// Add remote
async function addRemote(name, url) {
    // Check if remote exists
    const existing = await gitExec(`remote get-url ${name}`);
    if (existing.success) {
        // Update existing remote
        return await gitExec(`remote set-url ${name} ${url}`);
    }
    return await gitExec(`remote add ${name} ${url}`);
}

// Clone existing repo
async function cloneRepo(url, targetPath) {
    const fs = require('fs');

    // Ensure parent directory exists
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
    }

    try {
        const { stdout, stderr } = await execAsync(`git clone ${url} "${targetPath}"`);
        return { success: true, stdout, stderr };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

module.exports = {
    gitExec,
    initRepo,
    getStatus,
    stageAll,
    commit,
    push,
    sync,
    addRemote,
    cloneRepo
};
