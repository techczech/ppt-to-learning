import React, { useState, useEffect } from 'react';
import { Key, Save, X, CheckCircle, AlertCircle } from 'lucide-react';
import { getStoredApiKey, setStoredApiKey } from '../api';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
    const [key, setKey] = useState('');
    const [status, setStatus] = useState<'idle' | 'saved'>('idle');

    useEffect(() => {
        if (isOpen) {
            setKey(getStoredApiKey());
            setStatus('idle');
        }
    }, [isOpen]);

    const handleSave = () => {
        setStoredApiKey(key);
        setStatus('saved');
        setTimeout(() => {
            onClose();
        }, 1000);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <h3 className="font-bold text-gray-800 flex items-center">
                        <Key className="w-5 h-5 mr-2 text-blue-600" />
                        Bring Your Own Key
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-8">
                    <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                        Enter your **Gemini API Key** to enable AI features like slide analysis and visual correction. 
                        Your key is stored safely in your browser's local storage.
                    </p>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Gemini API Key</label>
                            <input 
                                type="password" 
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-mono text-sm"
                                placeholder="sk-..."
                                value={key}
                                onChange={(e) => setKey(e.target.value)}
                            />
                        </div>
                        
                        <button 
                            onClick={handleSave}
                            className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95"
                        >
                            {status === 'saved' ? (
                                <>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Key Saved!
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    Save Key
                                </>
                            )}
                        </button>
                    </div>
                    
                    <div className="mt-6 flex items-start p-3 bg-amber-50 rounded-lg border border-amber-100">
                        <AlertCircle className="w-4 h-4 text-amber-500 mr-2 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-amber-700 leading-tight">
                            Don't have a key? Get one for free at the <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline font-bold">Google AI Studio</a>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
