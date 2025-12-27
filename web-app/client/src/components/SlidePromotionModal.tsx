import React, { useState, useEffect } from 'react';
import { X, Check, Library, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { SlideGrid } from './SlideCard';
import {
    getPresentationSlides,
    promoteSlides,
    type PresentationSlidesResponse,
    type SlidePromoteData
} from '../api';

interface SlidePromotionModalProps {
    isOpen: boolean;
    onClose: () => void;
    presentationId: string;
    presentationName: string;
    onPromoted: () => void;
}

export const SlidePromotionModal: React.FC<SlidePromotionModalProps> = ({
    isOpen,
    onClose,
    presentationId,
    presentationName,
    onPromoted
}) => {
    const [loading, setLoading] = useState(true);
    const [promoting, setPromoting] = useState(false);
    const [data, setData] = useState<PresentationSlidesResponse | null>(null);
    const [selectedSlides, setSelectedSlides] = useState<Set<number>>(new Set());
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && presentationId) {
            loadSlides();
        }
    }, [isOpen, presentationId]);

    const loadSlides = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await getPresentationSlides(presentationId);
            setData(response);
            // Pre-select slides that are not already promoted
            const notPromoted = response.slides
                .filter(s => !s.promoted)
                .map(s => s.slideOrder);
            setSelectedSlides(new Set(notPromoted));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load slides');
        } finally {
            setLoading(false);
        }
    };

    const toggleSlide = (slideOrder: number) => {
        const slide = data?.slides.find(s => s.slideOrder === slideOrder);
        if (slide?.promoted) return; // Can't toggle already promoted slides

        const newSelected = new Set(selectedSlides);
        if (newSelected.has(slideOrder)) {
            newSelected.delete(slideOrder);
        } else {
            newSelected.add(slideOrder);
        }
        setSelectedSlides(newSelected);
    };

    const selectAll = () => {
        if (!data) return;
        const allNotPromoted = data.slides
            .filter(s => !s.promoted)
            .map(s => s.slideOrder);
        setSelectedSlides(new Set(allNotPromoted));
    };

    const selectNone = () => {
        setSelectedSlides(new Set());
    };

    const handlePromote = async () => {
        if (!data || selectedSlides.size === 0) return;

        setPromoting(true);
        setError(null);

        try {
            const slidesToPromote: SlidePromoteData[] = data.slides
                .filter(s => selectedSlides.has(s.slideOrder))
                .map(s => ({
                    slideOrder: s.slideOrder,
                    title: s.title,
                    layout: s.layout,
                    hasScreenshot: s.hasScreenshot,
                    contentTypes: s.contentTypes,
                    wordCount: s.wordCount
                }));

            await promoteSlides(presentationId, slidesToPromote);
            onPromoted();
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to promote slides');
        } finally {
            setPromoting(false);
        }
    };

    if (!isOpen) return null;

    const notPromotedCount = data?.slides.filter(s => !s.promoted).length || 0;
    const selectedCount = selectedSlides.size;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
                {/* Backdrop */}
                <div
                    className="fixed inset-0 bg-black/50 transition-opacity"
                    onClick={onClose}
                />

                {/* Modal */}
                <div className="relative w-full max-w-6xl bg-white rounded-xl shadow-2xl">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                                <Library className="w-5 h-5 text-blue-600" />
                                Promote Slides to Library
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">
                                {presentationName}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Selection controls */}
                    {!loading && data && (
                        <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-b">
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-gray-600">
                                    {selectedCount} of {notPromotedCount} slides selected
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={selectAll}
                                        className="text-sm text-blue-600 hover:text-blue-800"
                                    >
                                        Select all
                                    </button>
                                    <span className="text-gray-300">|</span>
                                    <button
                                        onClick={selectNone}
                                        className="text-sm text-blue-600 hover:text-blue-800"
                                    >
                                        Select none
                                    </button>
                                </div>
                            </div>
                            {data.promotedCount > 0 && (
                                <span className="text-sm text-green-600">
                                    {data.promotedCount} slides already in library
                                </span>
                            )}
                        </div>
                    )}

                    {/* Content */}
                    <div className="p-6 max-h-[60vh] overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                            </div>
                        ) : error ? (
                            <div className="text-center py-12 text-red-600">
                                {error}
                            </div>
                        ) : data ? (
                            <SlideGrid
                                slides={data.slides}
                                selectedIds={selectedSlides as Set<string | number>}
                                onSelectSlide={(id) => toggleSlide(id as number)}
                                selectionMode={true}
                                compact={true}
                                emptyMessage="No slides in this presentation"
                            />
                        ) : null}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
                        <div className="text-sm text-gray-500">
                            Promoted slides can be individually tagged, starred, and edited.
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePromote}
                                disabled={promoting || selectedCount === 0}
                                className={clsx(
                                    "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
                                    selectedCount > 0 && !promoting
                                        ? "bg-blue-600 text-white hover:bg-blue-700"
                                        : "bg-gray-200 text-gray-500 cursor-not-allowed"
                                )}
                            >
                                {promoting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Promoting...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Promote {selectedCount} Slide{selectedCount !== 1 ? 's' : ''}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SlidePromotionModal;
