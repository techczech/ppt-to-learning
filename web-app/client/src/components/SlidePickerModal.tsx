import React, { useState, useMemo } from 'react';
import { X, Search, FileText, CheckSquare, Square } from 'lucide-react';
import clsx from 'clsx';
import type { Slide } from '../api';

interface SlidePickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    slides: Slide[];
    excludeSlideIds: string[]; // Slides already in pack
    onSlidesSelected: (slideIds: string[]) => void;
}

export const SlidePickerModal: React.FC<SlidePickerModalProps> = ({
    isOpen,
    onClose,
    slides,
    excludeSlideIds,
    onSlidesSelected
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Filter slides: exclude already in pack, apply search
    const availableSlides = useMemo(() => {
        const excludeSet = new Set(excludeSlideIds);
        return slides.filter(s => {
            if (excludeSet.has(s.id)) return false;
            if (!searchQuery.trim()) return true;
            const query = searchQuery.toLowerCase();
            return (
                s.title?.toLowerCase().includes(query) ||
                s.notes?.toLowerCase().includes(query)
            );
        });
    }, [slides, excludeSlideIds, searchQuery]);

    const toggleSlide = (slideId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(slideId)) {
                next.delete(slideId);
            } else {
                next.add(slideId);
            }
            return next;
        });
    };

    const handleAdd = () => {
        onSlidesSelected(Array.from(selectedIds));
        setSelectedIds(new Set());
        setSearchQuery('');
        onClose();
    };

    const handleClose = () => {
        setSelectedIds(new Set());
        setSearchQuery('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
                {/* Backdrop */}
                <div
                    className="fixed inset-0 bg-black/50 transition-opacity"
                    onClick={handleClose}
                />

                {/* Modal */}
                <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl max-h-[80vh] flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b">
                        <h2 className="text-lg font-semibold text-gray-900">
                            Add Slides to Pack
                        </h2>
                        <button
                            onClick={handleClose}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="px-6 py-3 border-b">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search slides..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                    </div>

                    {/* Slides Grid */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {availableSlides.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">
                                {slides.length === excludeSlideIds.length
                                    ? 'All slides are already in this pack'
                                    : 'No slides match your search'}
                            </div>
                        ) : (
                            <div className="grid grid-cols-4 gap-3">
                                {availableSlides.map(slide => {
                                    const isSelected = selectedIds.has(slide.id);
                                    return (
                                        <button
                                            key={slide.id}
                                            onClick={() => toggleSlide(slide.id)}
                                            className={clsx(
                                                "relative aspect-[16/10] rounded-lg overflow-hidden border-2 transition-all",
                                                isSelected
                                                    ? "border-purple-500 ring-2 ring-purple-200"
                                                    : "border-gray-200 hover:border-gray-300"
                                            )}
                                        >
                                            {slide.screenshotUrl ? (
                                                <img
                                                    src={slide.screenshotUrl}
                                                    alt={slide.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                                                    <FileText className="w-6 h-6" />
                                                </div>
                                            )}
                                            {/* Selection indicator */}
                                            <div className="absolute top-1 right-1">
                                                {isSelected ? (
                                                    <CheckSquare className="w-5 h-5 text-purple-600 bg-white rounded" />
                                                ) : (
                                                    <Square className="w-5 h-5 text-gray-400 bg-white/80 rounded" />
                                                )}
                                            </div>
                                            {/* Title overlay */}
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                                                <p className="text-xs text-white truncate">
                                                    {slide.title || 'Untitled'}
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
                        <span className="text-sm text-gray-600">
                            {selectedIds.size} slide{selectedIds.size !== 1 ? 's' : ''} selected
                        </span>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleClose}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAdd}
                                disabled={selectedIds.size === 0}
                                className={clsx(
                                    "px-4 py-2 rounded-lg font-medium transition-colors",
                                    selectedIds.size === 0
                                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                        : "bg-purple-600 text-white hover:bg-purple-700"
                                )}
                            >
                                Add Selected
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SlidePickerModal;
