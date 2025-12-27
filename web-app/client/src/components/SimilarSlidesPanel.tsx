import React, { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, Presentation, Plus } from 'lucide-react';
import clsx from 'clsx';
import {
    findSimilarSlides,
    addToCart,
    isInCart,
    type Slide,
    type SimilarSlide
} from '../api';

interface SimilarSlidesPanelProps {
    slide: Slide | null;
    isOpen: boolean;
    onClose: () => void;
    onSlideClick: (slide: Slide) => void;
    onCartChange: () => void;
}

export const SimilarSlidesPanel: React.FC<SimilarSlidesPanelProps> = ({
    slide,
    isOpen,
    onClose,
    onSlideClick,
    onCartChange
}) => {
    const [similarSlides, setSimilarSlides] = useState<SimilarSlide[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && slide) {
            loadSimilarSlides();
        }
    }, [isOpen, slide?.id]);

    const loadSimilarSlides = async () => {
        if (!slide) return;

        setLoading(true);
        setError(null);
        setSimilarSlides([]);

        try {
            const result = await findSimilarSlides(slide.id, 10);
            setSimilarSlides(result.similar);
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to find similar slides';
            if (message.includes('API key')) {
                setError('Gemini API key required for semantic search. Check settings.');
            } else {
                setError(message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleAddToCart = (slideToAdd: Slide) => {
        addToCart(slideToAdd.id);
        onCartChange();
    };

    const getScreenshotUrl = (s: Slide) => {
        return s.screenshotUrl ||
            `/media/${s.sourceId}/screenshots/slide_${String(s.sourceSlideOrder).padStart(4, '0')}.png`;
    };

    const formatScore = (score: number) => {
        return `${Math.round(score * 100)}%`;
    };

    if (!slide) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className={clsx(
                    "fixed inset-0 bg-black/30 z-40 transition-opacity",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Panel */}
            <div
                className={clsx(
                    "fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 transform transition-transform duration-300 flex flex-col",
                    isOpen ? "translate-x-0" : "translate-x-full"
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                        <h2 className="text-lg font-bold text-gray-900">
                            Similar Slides
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Source slide */}
                <div className="p-4 bg-gray-50 border-b">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                        Finding slides similar to
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-20 h-14 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                            <img
                                src={getScreenshotUrl(slide)}
                                alt={slide.title}
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate">
                                {slide.title}
                            </div>
                            <div className="text-sm text-gray-500">
                                Slide #{slide.sourceSlideOrder}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                            <Loader2 className="w-8 h-8 animate-spin text-purple-600 mb-3" />
                            <p>Finding similar slides...</p>
                            <p className="text-sm text-gray-400 mt-1">
                                Using semantic embeddings
                            </p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-12">
                            <p className="text-red-600 mb-3">{error}</p>
                            <button
                                onClick={loadSimilarSlides}
                                className="text-sm text-blue-600 hover:text-blue-800"
                            >
                                Try again
                            </button>
                        </div>
                    ) : similarSlides.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>No similar slides found</p>
                            <p className="text-sm mt-1">
                                Try generating embeddings for more slides
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {similarSlides.map(({ slide: simSlide, score }) => {
                                const inCart = isInCart(simSlide.id);

                                return (
                                    <div
                                        key={simSlide.id}
                                        className="group flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                                        onClick={() => onSlideClick(simSlide)}
                                    >
                                        <div className="w-24 h-16 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                                            <img
                                                src={getScreenshotUrl(simSlide)}
                                                alt={simSlide.title}
                                                className="w-full h-full object-contain"
                                            />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-gray-900 truncate">
                                                {simSlide.title}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                Slide #{simSlide.sourceSlideOrder}
                                            </div>
                                            <div className="mt-1 flex items-center gap-2">
                                                <span
                                                    className={clsx(
                                                        "text-xs font-medium px-2 py-0.5 rounded-full",
                                                        score > 0.8
                                                            ? "bg-green-100 text-green-700"
                                                            : score > 0.6
                                                                ? "bg-yellow-100 text-yellow-700"
                                                                : "bg-gray-100 text-gray-600"
                                                    )}
                                                >
                                                    {formatScore(score)} match
                                                </span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleAddToCart(simSlide);
                                            }}
                                            disabled={inCart}
                                            className={clsx(
                                                "p-2 rounded-lg transition-colors",
                                                inCart
                                                    ? "bg-green-100 text-green-600 cursor-default"
                                                    : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                            )}
                                            title={inCart ? "In cart" : "Add to cart"}
                                        >
                                            {inCart ? (
                                                <Presentation className="w-4 h-4" />
                                            ) : (
                                                <Plus className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {similarSlides.length > 0 && (
                    <div className="p-4 border-t bg-gray-50 text-center text-sm text-gray-500">
                        Similarity based on semantic content analysis
                    </div>
                )}
            </div>
        </>
    );
};

export default SimilarSlidesPanel;
