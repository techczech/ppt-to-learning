import React, { useState, useEffect } from 'react';
import { X, Package, Loader2, Plus, FileText, Folder } from 'lucide-react';
import clsx from 'clsx';
import { updatePack, type Pack, type Slide, type PackFolder } from '../api';

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

interface EditPackModalProps {
    isOpen: boolean;
    onClose: () => void;
    pack: Pack | null;
    slides: Slide[];
    packFolders: PackFolder[];
    onPackUpdated: (pack: Pack) => void;
    onOpenSlidePicker: () => void;
    slidesToAdd?: string[]; // Slide IDs to add (from SlidePickerModal)
    onSlidesAdded?: () => void; // Called after slidesToAdd are processed
}

export const EditPackModal: React.FC<EditPackModalProps> = ({
    isOpen,
    onClose,
    pack,
    slides,
    packFolders,
    onPackUpdated,
    onOpenSlidePicker,
    slidesToAdd,
    onSlidesAdded
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState(PACK_COLORS[0]);
    const [folderId, setFolderId] = useState<string | null>(null);
    const [slideIds, setSlideIds] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initialize form when pack changes
    useEffect(() => {
        if (pack) {
            setName(pack.name);
            setDescription(pack.description || '');
            setColor(pack.color || PACK_COLORS[0]);
            setFolderId(pack.folderId || null);
            setSlideIds([...pack.slideIds]);
            setError(null);
        }
    }, [pack]);

    // Handle adding slides from SlidePickerModal
    useEffect(() => {
        if (slidesToAdd && slidesToAdd.length > 0) {
            setSlideIds(ids => [...new Set([...ids, ...slidesToAdd])]);
            onSlidesAdded?.();
        }
    }, [slidesToAdd, onSlidesAdded]);

    // Get slides in pack
    const packSlides = slideIds
        .map(id => slides.find(s => s.id === id))
        .filter((s): s is Slide => s !== undefined);

    const handleRemoveSlide = (slideId: string) => {
        setSlideIds(ids => ids.filter(id => id !== slideId));
    };

    const handleSave = async () => {
        if (!pack) return;

        if (!name.trim()) {
            setError('Pack name is required');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const updatedPack = await updatePack(pack.id, {
                name: name.trim(),
                description: description.trim(),
                color,
                folderId,
                slideIds
            });

            onPackUpdated(updatedPack);
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to update pack');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen || !pack) return null;

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
                                Edit Pack
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
                        {/* Slides in Pack */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Slides ({slideIds.length})
                                </label>
                                <button
                                    onClick={onOpenSlidePicker}
                                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Add Slides
                                </button>
                            </div>
                            {packSlides.length > 0 ? (
                                <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto p-2 bg-gray-50 rounded-lg">
                                    {packSlides.map(slide => (
                                        <div
                                            key={slide.id}
                                            className="relative group aspect-[16/10] bg-gray-200 rounded overflow-hidden"
                                        >
                                            {slide.screenshotUrl ? (
                                                <img
                                                    src={slide.screenshotUrl}
                                                    alt={slide.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                    <FileText className="w-4 h-4" />
                                                </div>
                                            )}
                                            <button
                                                onClick={() => handleRemoveSlide(slide.id)}
                                                className="absolute inset-0 bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Remove from pack (slide stays in library)"
                                            >
                                                <span className="text-[10px] font-medium">Remove</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 bg-gray-50 rounded-lg text-center text-sm text-gray-400">
                                    No slides in this pack. Click "Add Slides" to add some.
                                </div>
                            )}
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

                        {/* Folder */}
                        {packFolders.length > 0 && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    <span className="flex items-center gap-1.5">
                                        <Folder className="w-4 h-4" />
                                        Folder (optional)
                                    </span>
                                </label>
                                <select
                                    value={folderId || ''}
                                    onChange={(e) => setFolderId(e.target.value || null)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                                >
                                    <option value="">No folder</option>
                                    {packFolders.map(folder => (
                                        <option key={folder.id} value={folder.id}>
                                            {folder.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

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
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditPackModal;
