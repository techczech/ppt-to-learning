import React, { useState } from 'react';
import { X, Check, XCircle, Edit3, Wand2 } from 'lucide-react';
import { ContentRenderer, type ContentBlock } from './ContentRenderer';

interface GeminiPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    originalContent: ContentBlock[];
    aiContent: ContentBlock[];
    aiTitle?: string;
    conversionId: string;
    onAccept: (content: ContentBlock[], title?: string) => void;
    onReject: () => void;
}

export const GeminiPreviewModal: React.FC<GeminiPreviewModalProps> = ({
    isOpen,
    onClose,
    originalContent,
    aiContent,
    aiTitle,
    conversionId,
    onAccept,
    onReject
}) => {
    const [editMode, setEditMode] = useState(false);
    const [editedJson, setEditedJson] = useState('');
    const [jsonError, setJsonError] = useState<string | null>(null);

    // Initialize JSON when entering edit mode
    const handleEditClick = () => {
        setEditedJson(JSON.stringify({ content: aiContent, title: aiTitle }, null, 2));
        setJsonError(null);
        setEditMode(true);
    };

    const handleApplyEdited = () => {
        try {
            const parsed = JSON.parse(editedJson);
            if (!Array.isArray(parsed.content)) {
                throw new Error('JSON must have a "content" array');
            }
            onAccept(parsed.content, parsed.title);
        } catch (err) {
            setJsonError(err instanceof Error ? err.message : 'Invalid JSON');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-4 flex items-center justify-center pointer-events-none">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col pointer-events-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
                        <div className="flex items-center gap-3">
                            <Wand2 className="w-6 h-6 text-indigo-600" />
                            <h2 className="text-xl font-bold text-gray-900">
                                Review Gemini Conversion
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden flex">
                        {editMode ? (
                            /* JSON Edit Mode */
                            <div className="flex-1 p-6 flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-medium text-gray-600">
                                        Edit AI-generated content (JSON)
                                    </h3>
                                    {jsonError && (
                                        <span className="text-sm text-red-600">{jsonError}</span>
                                    )}
                                </div>
                                <textarea
                                    value={editedJson}
                                    onChange={(e) => {
                                        setEditedJson(e.target.value);
                                        try {
                                            JSON.parse(e.target.value);
                                            setJsonError(null);
                                        } catch (err) {
                                            setJsonError(err instanceof Error ? err.message : 'Invalid JSON');
                                        }
                                    }}
                                    className="flex-1 w-full bg-gray-900 text-green-400 p-4 rounded-xl text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    spellCheck={false}
                                />
                            </div>
                        ) : (
                            /* Side-by-side comparison */
                            <>
                                {/* Original */}
                                <div className="flex-1 border-r overflow-y-auto">
                                    <div className="sticky top-0 bg-gray-100 px-6 py-3 border-b">
                                        <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide">
                                            Original Content
                                        </h3>
                                    </div>
                                    <div className="p-6 space-y-4">
                                        {originalContent.length === 0 ? (
                                            <p className="text-gray-400 italic">No content</p>
                                        ) : (
                                            originalContent.map((block, idx) => (
                                                <ContentRenderer
                                                    key={idx}
                                                    block={block}
                                                    conversionId={conversionId}
                                                    compact={true}
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* AI Generated */}
                                <div className="flex-1 overflow-y-auto bg-indigo-50/30">
                                    <div className="sticky top-0 bg-indigo-100 px-6 py-3 border-b border-indigo-200">
                                        <h3 className="text-sm font-bold text-indigo-700 uppercase tracking-wide flex items-center gap-2">
                                            <Wand2 className="w-4 h-4" />
                                            AI Generated
                                        </h3>
                                    </div>
                                    <div className="p-6 space-y-4">
                                        {aiTitle && (
                                            <div className="mb-4 p-3 bg-indigo-100 rounded-lg">
                                                <span className="text-xs text-indigo-600 font-medium">New Title: </span>
                                                <span className="text-indigo-900 font-semibold">{aiTitle}</span>
                                            </div>
                                        )}
                                        {aiContent.length === 0 ? (
                                            <p className="text-gray-400 italic">No content generated</p>
                                        ) : (
                                            aiContent.map((block, idx) => (
                                                <ContentRenderer
                                                    key={idx}
                                                    block={block}
                                                    conversionId={conversionId}
                                                    compact={true}
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between gap-4 px-6 py-4 border-t bg-gray-50">
                        <div className="text-sm text-gray-500">
                            {editMode ? 'Modify the JSON and apply your changes' : 'Compare the results and choose an action'}
                        </div>
                        <div className="flex items-center gap-3">
                            {editMode ? (
                                <>
                                    <button
                                        onClick={() => setEditMode(false)}
                                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                                    >
                                        Back to Preview
                                    </button>
                                    <button
                                        onClick={handleApplyEdited}
                                        disabled={!!jsonError}
                                        className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Check className="w-4 h-4" />
                                        Apply Edited
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => {
                                            onReject();
                                            onClose();
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        Reject
                                    </button>
                                    <button
                                        onClick={handleEditClick}
                                        className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                        Edit JSON
                                    </button>
                                    <button
                                        onClick={() => {
                                            onAccept(aiContent, aiTitle);
                                            onClose();
                                        }}
                                        className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
                                    >
                                        <Check className="w-4 h-4" />
                                        Accept
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GeminiPreviewModal;
