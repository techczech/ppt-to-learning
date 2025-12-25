import React, { useState, useEffect } from 'react';
import { Key, Save, X, CheckCircle, MessageSquare, Terminal } from 'lucide-react';
import { 
    getStoredApiKey, setStoredApiKey, 
    getStoredPrompt, setStoredPrompt, 
    DEFAULT_PROMPTS 
} from '../api';
import clsx from 'clsx';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type Tab = 'api' | 'prompts';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<Tab>('api');
    const [apiKey, setApiKey] = useState('');
    const [analyzePrompt, setAnalyzePrompt] = useState('');
    const [fixPrompt, setFixPrompt] = useState('');
    const [status, setStatus] = useState<'idle' | 'saved'>('idle');

    useEffect(() => {
        if (isOpen) {
            setApiKey(getStoredApiKey());
            setAnalyzePrompt(getStoredPrompt('analyze'));
            setFixPrompt(getStoredPrompt('fix'));
            setStatus('idle');
        }
    }, [isOpen]);

    const handleSave = () => {
        setStoredApiKey(apiKey);
        setStoredPrompt('analyze', analyzePrompt);
        setStoredPrompt('fix', fixPrompt);
        setStatus('saved');
        setTimeout(() => {
            onClose();
        }, 800);
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
                        API Configuration
                    </button>
                    <button 
                        onClick={() => setActiveTab('prompts')}
                        className={clsx(
                            "px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2",
                            activeTab === 'prompts' ? "border-blue-600 text-blue-600" : "border-transparent text-gray-400 hover:text-gray-600"
                        )}
                    >
                        AI Prompts
                    </button>
                </div>
                
                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    {activeTab === 'api' ? (
                        <div className="space-y-6">
                            <div>
                                <h4 className="text-sm font-bold text-gray-800 mb-2">Gemini 1.5 Flash Key</h4>
                                <p className="text-xs text-gray-500 mb-4">Provided keys are stored only in your local browser storage.</p>
                                <input 
                                    type="password" 
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-mono text-sm"
                                    placeholder="Enter Sk-..."
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                />
                            </div>
                        </div>
                    ) : (
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
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end">
                    <button 
                        onClick={handleSave}
                        className="flex items-center px-8 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all active:scale-95"
                    >
                        {status === 'saved' ? (
                            <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Confirmed
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
