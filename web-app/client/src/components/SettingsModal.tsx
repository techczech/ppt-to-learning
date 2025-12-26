import React, { useState, useEffect } from 'react';
import { Save, X, CheckCircle, Terminal, Cpu, FolderGit2, GitBranch, RefreshCw, AlertCircle } from 'lucide-react';
import {
    getStoredApiKey, setStoredApiKey,
    getStoredPrompt, setStoredPrompt,
    getStoredModel, setStoredModel,
    getAvailableModels,
    DEFAULT_PROMPTS,
    type ModelsResponse,
    type AppSettings,
    type GitStatus,
    getSettings,
    updateSettings,
    getGitStatus,
    initGitRepo,
    addGitRemote,
    manualGitSync
} from '../api';
import clsx from 'clsx';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type Tab = 'api' | 'prompts' | 'data';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<Tab>('api');
    const [apiKey, setApiKey] = useState('');
    const [selectedModel, setSelectedModel] = useState('');
    const [modelsData, setModelsData] = useState<ModelsResponse | null>(null);
    const [analyzePrompt, setAnalyzePrompt] = useState('');
    const [fixPrompt, setFixPrompt] = useState('');
    const [status, setStatus] = useState<'idle' | 'saved' | 'saving' | 'error'>('idle');

    // Data & Git settings
    const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
    const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
    const [dataPath, setDataPath] = useState('');
    const [gitEnabled, setGitEnabled] = useState(false);
    const [autoCommit, setAutoCommit] = useState(true);
    const [autoPush, setAutoPush] = useState(false);
    const [remoteUrl, setRemoteUrl] = useState('');
    const [syncing, setSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState('');

    useEffect(() => {
        if (isOpen) {
            setApiKey(getStoredApiKey());
            setSelectedModel(getStoredModel());
            setAnalyzePrompt(getStoredPrompt('analyze'));
            setFixPrompt(getStoredPrompt('fix'));
            setStatus('idle');

            // Fetch available models
            getAvailableModels().then(data => {
                setModelsData(data);
                // Set default if no model selected
                if (!getStoredModel() && data.default) {
                    setSelectedModel(data.default);
                }
            }).catch(console.error);

            // Fetch app settings
            loadSettings();
        }
    }, [isOpen]);

    const loadSettings = async () => {
        try {
            const settings = await getSettings();
            setAppSettings(settings);
            setDataPath(settings.dataPath || '');
            setGitEnabled(settings.gitSync.enabled);
            setAutoCommit(settings.gitSync.autoCommit);
            setAutoPush(settings.gitSync.autoPush);

            // Load git status if git sync is configured
            if (settings.dataPath) {
                const status = await getGitStatus();
                setGitStatus(status);
            }
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    };

    const handleSave = async () => {
        setStatus('saving');

        // Save local settings
        setStoredApiKey(apiKey);
        setStoredModel(selectedModel);
        setStoredPrompt('analyze', analyzePrompt);
        setStoredPrompt('fix', fixPrompt);

        // Save server settings if data tab was modified
        try {
            await updateSettings({
                dataPath: dataPath || null,
                gitSync: {
                    enabled: gitEnabled,
                    autoCommit,
                    autoPush
                }
            });
            setStatus('saved');
            setTimeout(() => {
                onClose();
            }, 800);
        } catch (e) {
            console.error('Failed to save settings:', e);
            setStatus('error');
        }
    };

    const handleInitRepo = async () => {
        try {
            await initGitRepo();
            await loadSettings();
        } catch (e) {
            console.error('Failed to init repo:', e);
        }
    };

    const handleAddRemote = async () => {
        if (!remoteUrl) return;
        try {
            await addGitRemote('origin', remoteUrl);
            setRemoteUrl('');
            await loadSettings();
        } catch (e) {
            console.error('Failed to add remote:', e);
        }
    };

    const handleManualSync = async () => {
        setSyncing(true);
        setSyncMessage('');
        try {
            const result = await manualGitSync('Manual sync from settings');
            if (result.commit?.success) {
                setSyncMessage(result.commit.message || 'Changes committed');
            } else if (result.commit?.message === 'Nothing to commit') {
                setSyncMessage('No changes to commit');
            }
            await loadSettings();
        } catch (e) {
            setSyncMessage('Sync failed');
            console.error('Sync failed:', e);
        } finally {
            setSyncing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center space-x-2">
                        <div className="bg-blue-600 p-2 rounded-lg text-white">
                            <Terminal className="w-5 h-5" />
                        </div>
                        <h3 className="font-black text-gray-800 uppercase tracking-tighter text-xl">System Settings</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 px-6">
                    <button
                        onClick={() => setActiveTab('api')}
                        className={clsx(
                            "px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2",
                            activeTab === 'api' ? "border-blue-600 text-blue-600" : "border-transparent text-gray-400 hover:text-gray-600"
                        )}
                    >
                        API
                    </button>
                    <button
                        onClick={() => setActiveTab('prompts')}
                        className={clsx(
                            "px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2",
                            activeTab === 'prompts' ? "border-blue-600 text-blue-600" : "border-transparent text-gray-400 hover:text-gray-600"
                        )}
                    >
                        Prompts
                    </button>
                    <button
                        onClick={() => setActiveTab('data')}
                        className={clsx(
                            "px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2",
                            activeTab === 'data' ? "border-blue-600 text-blue-600" : "border-transparent text-gray-400 hover:text-gray-600"
                        )}
                    >
                        Data & Sync
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    {activeTab === 'api' ? (
                        <div className="space-y-8">
                            <div>
                                <h4 className="text-sm font-bold text-gray-800 mb-2">Gemini API Key</h4>
                                <p className="text-xs text-gray-500 mb-4">Provided keys are stored only in your local browser storage.</p>
                                <input
                                    type="password"
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-mono text-sm"
                                    placeholder="Enter your Gemini API key..."
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                />
                            </div>

                            <div>
                                <h4 className="text-sm font-bold text-gray-800 mb-2 flex items-center">
                                    <Cpu className="w-4 h-4 mr-2" />
                                    Model Selection
                                </h4>
                                <p className="text-xs text-gray-500 mb-4">Choose which Gemini model to use for AI features.</p>
                                {modelsData ? (
                                    <div className="space-y-2">
                                        {Object.entries(modelsData.models).map(([modelId, info]) => (
                                            <label
                                                key={modelId}
                                                className={clsx(
                                                    "flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all",
                                                    selectedModel === modelId
                                                        ? "border-blue-500 bg-blue-50"
                                                        : "border-gray-200 hover:border-gray-300 bg-gray-50"
                                                )}
                                            >
                                                <input
                                                    type="radio"
                                                    name="model"
                                                    value={modelId}
                                                    checked={selectedModel === modelId}
                                                    onChange={(e) => setSelectedModel(e.target.value)}
                                                    className="sr-only"
                                                />
                                                <div className="flex-1">
                                                    <div className="flex items-center">
                                                        <span className="font-bold text-gray-800">{info.name}</span>
                                                        {modelId === modelsData.default && (
                                                            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full uppercase">Default</span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-gray-500">{info.description}</span>
                                                </div>
                                                <div className={clsx(
                                                    "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                                                    selectedModel === modelId ? "border-blue-500 bg-blue-500" : "border-gray-300"
                                                )}>
                                                    {selectedModel === modelId && (
                                                        <div className="w-2 h-2 bg-white rounded-full" />
                                                    )}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-400 italic">Loading models...</div>
                                )}
                            </div>
                        </div>
                    ) : activeTab === 'prompts' ? (
                        <div className="space-y-8">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-gray-800">Interpret Slide Prompt</h4>
                                    <button
                                        onClick={() => setAnalyzePrompt(DEFAULT_PROMPTS.analyze)}
                                        className="text-[10px] font-bold text-blue-600 hover:underline"
                                    >Reset to Default</button>
                                </div>
                                <p className="text-[10px] text-gray-400 leading-tight">Used when clicking "AI Interpret". Use <code className="bg-gray-100 px-1 rounded">{"{{SLIDE_DATA}}"}</code> as placeholder.</p>
                                <textarea
                                    className="w-full h-32 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={analyzePrompt}
                                    onChange={(e) => setAnalyzePrompt(e.target.value)}
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-gray-800">Visual Fix Prompt</h4>
                                    <button
                                        onClick={() => setFixPrompt(DEFAULT_PROMPTS.fix)}
                                        className="text-[10px] font-bold text-blue-600 hover:underline"
                                    >Reset to Default</button>
                                </div>
                                <p className="text-[10px] text-gray-400 leading-tight">Used when fixing via screenshot. Use <code className="bg-gray-100 px-1 rounded">{"{{CURRENT_JSON}}"}</code> as placeholder.</p>
                                <textarea
                                    className="w-full h-32 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={fixPrompt}
                                    onChange={(e) => setFixPrompt(e.target.value)}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {/* Data Path */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-800 mb-2 flex items-center">
                                    <FolderGit2 className="w-4 h-4 mr-2" />
                                    Data Repository Path
                                </h4>
                                <p className="text-xs text-gray-500 mb-4">
                                    Store presentation data in a separate directory (e.g., a private git repo).
                                    Leave empty to use the default location within the server folder.
                                </p>
                                <input
                                    type="text"
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-mono text-sm"
                                    placeholder="/path/to/your/private-data-repo"
                                    value={dataPath}
                                    onChange={(e) => setDataPath(e.target.value)}
                                />
                                {appSettings?.resolvedPaths && (
                                    <div className="mt-3 p-3 bg-gray-50 rounded-xl text-xs text-gray-500 font-mono">
                                        <div>Current: {appSettings.resolvedPaths.basePath}</div>
                                    </div>
                                )}
                            </div>

                            {/* Git Sync Settings */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-800 mb-2 flex items-center">
                                    <GitBranch className="w-4 h-4 mr-2" />
                                    Git Sync
                                </h4>
                                <p className="text-xs text-gray-500 mb-4">
                                    Automatically commit changes to keep your data backed up in git.
                                </p>

                                {/* Git Status */}
                                {gitStatus && (
                                    <div className={clsx(
                                        "mb-4 p-4 rounded-xl border",
                                        gitStatus.isRepo ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"
                                    )}>
                                        {gitStatus.isRepo ? (
                                            <div className="space-y-2">
                                                <div className="flex items-center text-green-700 text-sm font-medium">
                                                    <CheckCircle className="w-4 h-4 mr-2" />
                                                    Git repository initialized
                                                </div>
                                                <div className="text-xs text-green-600">
                                                    Branch: <span className="font-mono">{gitStatus.branch}</span>
                                                    {gitStatus.hasRemote && <span className="ml-2">(has remote)</span>}
                                                </div>
                                                {gitStatus.hasChanges && (
                                                    <div className="text-xs text-amber-600">
                                                        {gitStatus.changes?.length} uncommitted changes
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center text-yellow-700 text-sm">
                                                    <AlertCircle className="w-4 h-4 mr-2" />
                                                    {gitStatus.reason || 'Not a git repository'}
                                                </div>
                                                {dataPath && (
                                                    <button
                                                        onClick={handleInitRepo}
                                                        className="px-3 py-1.5 bg-yellow-600 text-white text-xs font-bold rounded-lg hover:bg-yellow-700"
                                                    >
                                                        Initialize Git
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Toggle switches */}
                                <div className="space-y-4">
                                    <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                        <div>
                                            <div className="text-sm font-medium text-gray-800">Enable Git Sync</div>
                                            <div className="text-xs text-gray-500">Automatically track changes with git</div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={gitEnabled}
                                            onChange={(e) => setGitEnabled(e.target.checked)}
                                            className="w-5 h-5 rounded text-blue-600"
                                        />
                                    </label>

                                    <label className={clsx(
                                        "flex items-center justify-between p-4 bg-gray-50 rounded-xl",
                                        !gitEnabled && "opacity-50"
                                    )}>
                                        <div>
                                            <div className="text-sm font-medium text-gray-800">Auto-commit</div>
                                            <div className="text-xs text-gray-500">Commit after uploads and changes</div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={autoCommit}
                                            onChange={(e) => setAutoCommit(e.target.checked)}
                                            disabled={!gitEnabled}
                                            className="w-5 h-5 rounded text-blue-600"
                                        />
                                    </label>

                                    <label className={clsx(
                                        "flex items-center justify-between p-4 bg-gray-50 rounded-xl",
                                        !gitEnabled && "opacity-50"
                                    )}>
                                        <div>
                                            <div className="text-sm font-medium text-gray-800">Auto-push</div>
                                            <div className="text-xs text-gray-500">Push to remote after each commit</div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={autoPush}
                                            onChange={(e) => setAutoPush(e.target.checked)}
                                            disabled={!gitEnabled}
                                            className="w-5 h-5 rounded text-blue-600"
                                        />
                                    </label>
                                </div>

                                {/* Add Remote */}
                                {gitStatus?.isRepo && !gitStatus.hasRemote && (
                                    <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                                        <div className="text-sm font-medium text-gray-800 mb-2">Add Remote</div>
                                        <div className="flex space-x-2">
                                            <input
                                                type="text"
                                                placeholder="git@github.com:user/repo.git"
                                                value={remoteUrl}
                                                onChange={(e) => setRemoteUrl(e.target.value)}
                                                className="flex-1 px-3 py-2 border rounded-lg font-mono text-xs"
                                            />
                                            <button
                                                onClick={handleAddRemote}
                                                className="px-4 py-2 bg-gray-800 text-white text-xs font-bold rounded-lg hover:bg-gray-900"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Manual Sync */}
                                {gitStatus?.isRepo && gitEnabled && (
                                    <div className="mt-4">
                                        <button
                                            onClick={handleManualSync}
                                            disabled={syncing}
                                            className={clsx(
                                                "flex items-center px-4 py-3 rounded-xl text-sm font-bold transition-all",
                                                syncing
                                                    ? "bg-gray-200 text-gray-500"
                                                    : "bg-gray-800 text-white hover:bg-gray-900"
                                            )}
                                        >
                                            <RefreshCw className={clsx("w-4 h-4 mr-2", syncing && "animate-spin")} />
                                            {syncing ? 'Syncing...' : 'Sync Now'}
                                        </button>
                                        {syncMessage && (
                                            <div className="mt-2 text-xs text-gray-500">{syncMessage}</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={status === 'saving'}
                        className={clsx(
                            "flex items-center px-8 py-3 rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-xl transition-all active:scale-95",
                            status === 'error'
                                ? "bg-red-600 text-white shadow-red-200"
                                : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200"
                        )}
                    >
                        {status === 'saved' ? (
                            <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Confirmed
                            </>
                        ) : status === 'saving' ? (
                            <>
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : status === 'error' ? (
                            <>
                                <AlertCircle className="w-4 h-4 mr-2" />
                                Error
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                Apply Changes
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
