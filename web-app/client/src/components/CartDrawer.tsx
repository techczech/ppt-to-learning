import React, { useState, useEffect } from 'react';
import {
    Presentation,
    X,
    Trash2,
    Save,
    GripVertical
} from 'lucide-react';
import clsx from 'clsx';
import {
    getCart,
    removeFromCart,
    clearCart,
    setCart,
    getSlideById,
    type Slide
} from '../api';

interface CartDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onSaveAsPack: (slideIds: string[]) => void;
    cartVersion: number; // Increment to trigger refresh
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
    isOpen,
    onClose,
    onSaveAsPack,
    cartVersion
}) => {
    const [cartSlides, setCartSlides] = useState<Slide[]>([]);
    const [loading, setLoading] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadCartSlides();
        }
    }, [isOpen, cartVersion]);

    const loadCartSlides = async () => {
        setLoading(true);
        try {
            const cartIds = getCart();
            const slides = await Promise.all(
                cartIds.map(id => getSlideById(id).catch(() => null))
            );
            setCartSlides(slides.filter((s): s is Slide => s !== null));
        } catch (e) {
            console.error('Failed to load cart slides:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = (slideId: string) => {
        removeFromCart(slideId);
        setCartSlides(prev => prev.filter(s => s.id !== slideId));
    };

    const handleClear = () => {
        if (confirm('Clear all slides from cart?')) {
            clearCart();
            setCartSlides([]);
        }
    };

    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        const newSlides = [...cartSlides];
        const [removed] = newSlides.splice(draggedIndex, 1);
        newSlides.splice(index, 0, removed);
        setCartSlides(newSlides);
        setDraggedIndex(index);

        // Update localStorage order
        setCart(newSlides.map(s => s.id));
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    const getScreenshotUrl = (slide: Slide) => {
        return slide.screenshotUrl ||
            `/media/${slide.sourceId}/screenshots/slide_${String(slide.sourceSlideOrder).padStart(4, '0')}.png`;
    };

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

            {/* Drawer */}
            <div
                className={clsx(
                    "fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 flex flex-col",
                    isOpen ? "translate-x-0" : "translate-x-full"
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-2">
                        <Presentation className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-bold text-gray-900">
                            Slide Selection
                        </h2>
                        <span className="text-sm text-gray-500">
                            ({cartSlides.length})
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : cartSlides.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Presentation className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>Your cart is empty</p>
                            <p className="text-sm mt-1">
                                Add slides from the library to build a pack
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {cartSlides.map((slide, index) => (
                                <div
                                    key={slide.id}
                                    draggable
                                    onDragStart={() => handleDragStart(index)}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDragEnd={handleDragEnd}
                                    className={clsx(
                                        "flex items-center gap-3 p-2 bg-gray-50 rounded-lg group cursor-move",
                                        draggedIndex === index && "opacity-50"
                                    )}
                                >
                                    <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />

                                    <div className="w-16 h-12 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                                        <img
                                            src={getScreenshotUrl(slide)}
                                            alt={slide.title}
                                            className="w-full h-full object-contain"
                                        />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-900 truncate">
                                            {slide.title}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            Slide #{slide.sourceSlideOrder}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleRemove(slide.id)}
                                        className="p-1.5 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {cartSlides.length > 0 && (
                    <div className="p-4 border-t bg-gray-50 space-y-3">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => onSaveAsPack(cartSlides.map(s => s.id))}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Save className="w-4 h-4" />
                                Save as Pack
                            </button>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleClear}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 text-sm rounded-lg transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                Clear Cart
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

// Floating cart button component
interface CartButtonProps {
    count: number;
    onClick: () => void;
}

export const CartButton: React.FC<CartButtonProps> = ({ count, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={clsx(
                "fixed bottom-6 right-6 z-30 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all",
                count > 0
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-100 text-gray-400 hover:bg-gray-200"
            )}
        >
            <Presentation className="w-5 h-5" />
            {count > 0 && (
                <span className="font-medium">{count}</span>
            )}
        </button>
    );
};

export default CartDrawer;
