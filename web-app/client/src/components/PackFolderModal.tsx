import React, { useState, useEffect } from 'react';
import { X, Folder, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import type { PackFolder } from '../api';

const FOLDER_COLORS = [
    '#6366F1', // Indigo
    '#8B5CF6', // Purple
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#EC4899', // Pink
    '#14B8A6', // Teal
];

interface PackFolderModalProps {
    isOpen: boolean;
    onClose: () => void;
    folder: PackFolder | null; // null = create mode, object = edit mode
    folders: PackFolder[]; // For parent folder selection
    onSave: (data: { name: string; color: string; parentId: string | null }) => Promise<void>;
}

export const PackFolderModal: React.FC<PackFolderModalProps> = ({
    isOpen,
    onClose,
    folder,
    folders,
    onSave
}) => {
    const [name, setName] = useState('');
    const [color, setColor] = useState(FOLDER_COLORS[0]);
    const [parentId, setParentId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isEditMode = folder !== null;

    // Initialize form when folder changes or modal opens
    useEffect(() => {
        if (isOpen) {
            if (folder) {
                setName(folder.name);
                setColor(folder.color || FOLDER_COLORS[0]);
                setParentId(folder.parentId);
            } else {
                setName('');
                setColor(FOLDER_COLORS[0]);
                setParentId(null);
            }
            setError(null);
        }
    }, [folder, isOpen]);

    // Get available parent folders (exclude self and children in edit mode)
    const availableParentFolders = folders.filter(f => {
        if (!isEditMode) return true;
        // Can't be parent of itself
        if (f.id === folder?.id) return false;
        // Can't select a child folder as parent (would create cycle)
        if (f.parentId === folder?.id) return false;
        return true;
    });

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Folder name is required');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            await onSave({
                name: name.trim(),
                color,
                parentId
            });
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save folder');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
                {/* Backdrop */}
                <div
                    className="fixed inset-0 bg-black/50 transition-opacity"
                    onClick={onClose}
                />

                {/* Modal */}
                <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b">
                        <div className="flex items-center gap-2">
                            <Folder className="w-5 h-5 text-indigo-600" />
                            <h2 className="text-lg font-semibold text-gray-900">
                                {isEditMode ? 'Edit Folder' : 'New Pack Folder'}
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-4">
                        {/* Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Folder Name *
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="My Folder"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                autoFocus
                            />
                        </div>

                        {/* Parent Folder */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Parent Folder (optional)
                            </label>
                            <select
                                value={parentId || ''}
                                onChange={(e) => setParentId(e.target.value || null)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                            >
                                <option value="">None (root level)</option>
                                {availableParentFolders.map(f => (
                                    <option key={f.id} value={f.id}>
                                        {f.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Color */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Color
                            </label>
                            <div className="flex items-center gap-2">
                                {FOLDER_COLORS.map((c) => (
                                    <button
                                        key={c}
                                        onClick={() => setColor(c)}
                                        className={clsx(
                                            "w-8 h-8 rounded-full transition-all",
                                            color === c
                                                ? "ring-2 ring-offset-2 ring-gray-400 scale-110"
                                                : "hover:scale-105"
                                        )}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || !name.trim()}
                            className={clsx(
                                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
                                saving || !name.trim()
                                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                            )}
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Folder className="w-4 h-4" />
                                    {isEditMode ? 'Save Changes' : 'Create Folder'}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PackFolderModal;
