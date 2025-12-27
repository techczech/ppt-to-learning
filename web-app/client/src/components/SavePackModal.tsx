import React, { useState } from 'react';
import { X, Package, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { createPack, clearCart, type Pack } from '../api';

const PACK_COLORS = [
    '#8B5CF6', // Purple
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#EC4899', // Pink
    '#6366F1', // Indigo
    '#14B8A6', // Teal
];

interface SavePackModalProps {
    isOpen: boolean;
    onClose: () => void;
    slideIds: string[];
    onPackCreated: (pack: Pack) => void;
}

export const SavePackModal: React.FC<SavePackModalProps> = ({
    isOpen,
    onClose,
    slideIds,
    onPackCreated
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState(PACK_COLORS[0]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [clearCartAfterSave, setClearCartAfterSave] = useState(true);

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Pack name is required');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const pack = await createPack(name.trim(), slideIds, {
                description: description.trim(),
                color
            });

            if (clearCartAfterSave) {
                clearCart();
            }

            onPackCreated(pack);
            onClose();

            // Reset form
            setName('');
            setDescription('');
            setColor(PACK_COLORS[0]);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to create pack');
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
                            <Package className="w-5 h-5 text-purple-600" />
                            <h2 className="text-lg font-semibold text-gray-900">
                                Save as Pack
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
                        <div className="text-sm text-gray-500">
                            {slideIds.length} slide{slideIds.length !== 1 ? 's' : ''} will be saved to this pack.
                        </div>

                        {/* Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Pack Name *
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="My Slide Pack"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                autoFocus
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description (optional)
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="What is this pack about?"
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                            />
                        </div>

                        {/* Color */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Color
                            </label>
                            <div className="flex items-center gap-2">
                                {PACK_COLORS.map((c) => (
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

                        {/* Clear cart option */}
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={clearCartAfterSave}
                                onChange={(e) => setClearCartAfterSave(e.target.checked)}
                                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                            />
                            <span className="text-sm text-gray-600">
                                Clear cart after saving
                            </span>
                        </label>

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
                                    : "bg-purple-600 text-white hover:bg-purple-700"
                            )}
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Package className="w-4 h-4" />
                                    Create Pack
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SavePackModal;
