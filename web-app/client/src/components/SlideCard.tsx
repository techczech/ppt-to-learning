import React from 'react';
import { Star, Check, FileText, Image, List, Table2, Puzzle } from 'lucide-react';
import clsx from 'clsx';
import type { Slide, PresentationSlide, Tag } from '../api';
import { TagListDisplay } from './TagPills';

// Content type icon mapping
const ContentTypeIcon: React.FC<{ type: string; className?: string }> = ({ type, className }) => {
    switch (type) {
        case 'heading':
        case 'paragraph':
            return <FileText className={className} />;
        case 'image':
            return <Image className={className} />;
        case 'list':
            return <List className={className} />;
        case 'table':
            return <Table2 className={className} />;
        case 'smart_art':
            return <Puzzle className={className} />;
        default:
            return <FileText className={className} />;
    }
};

interface SlideCardProps {
    slide: Slide | PresentationSlide;
    tags?: Tag[];
    selected?: boolean;
    onSelect?: () => void;
    onClick?: () => void;
    onStarToggle?: () => void;
    showCheckbox?: boolean;
    compact?: boolean;
}

export const SlideCard: React.FC<SlideCardProps> = ({
    slide,
    tags = [],
    selected = false,
    onSelect,
    onClick,
    onStarToggle,
    showCheckbox = false,
    compact = false
}) => {
    // Handle both Slide and PresentationSlide types
    const isPromotedSlide = 'id' in slide && 'status' in slide;
    const screenshotUrl = 'screenshotUrl' in slide ? slide.screenshotUrl : null;
    const title = slide.title;
    const slideOrder = 'sourceSlideOrder' in slide ? slide.sourceSlideOrder : slide.slideOrder;
    const starred = isPromotedSlide ? (slide as Slide).starred : false;
    const tagIds = isPromotedSlide ? (slide as Slide).tagIds : [];
    const contentTypes = isPromotedSlide
        ? (slide as Slide).metadata?.contentTypes || []
        : (slide as PresentationSlide).contentTypes || [];
    const isPromoted = isPromotedSlide || ('promoted' in slide && slide.promoted);

    return (
        <div
            className={clsx(
                "group relative bg-white border rounded-lg overflow-hidden transition-all",
                "hover:shadow-md hover:border-blue-300",
                selected && "ring-2 ring-blue-500 border-blue-500",
                onClick && "cursor-pointer"
            )}
            onClick={onClick}
        >
            {/* Thumbnail */}
            <div className={clsx(
                "relative bg-gray-100",
                compact ? "aspect-[4/3]" : "aspect-[16/10]"
            )}>
                {screenshotUrl ? (
                    <img
                        src={screenshotUrl}
                        alt={title}
                        className="w-full h-full object-contain"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <FileText className="w-12 h-12" />
                    </div>
                )}

                {/* Checkbox overlay */}
                {showCheckbox && (
                    <div
                        className={clsx(
                            "absolute top-2 left-2 w-6 h-6 rounded border-2 flex items-center justify-center transition-all",
                            selected
                                ? "bg-blue-500 border-blue-500 text-white"
                                : "bg-white/80 border-gray-300 group-hover:border-blue-400"
                        )}
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelect?.();
                        }}
                    >
                        {selected && <Check className="w-4 h-4" />}
                    </div>
                )}

                {/* Star button */}
                {isPromotedSlide && onStarToggle && (
                    <button
                        className={clsx(
                            "absolute top-2 right-2 p-1.5 rounded-full transition-all",
                            starred
                                ? "text-yellow-500 bg-yellow-50"
                                : "text-gray-400 bg-white/80 opacity-0 group-hover:opacity-100"
                        )}
                        onClick={(e) => {
                            e.stopPropagation();
                            onStarToggle();
                        }}
                    >
                        <Star className={clsx("w-4 h-4", starred && "fill-current")} />
                    </button>
                )}

                {/* Promoted badge */}
                {isPromoted && !isPromotedSlide && (
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
                        In Library
                    </div>
                )}

                {/* Slide number */}
                <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded">
                    #{slideOrder}
                </div>
            </div>

            {/* Content */}
            <div className={clsx("p-3", compact && "p-2")}>
                <h3 className={clsx(
                    "font-medium text-gray-900 truncate",
                    compact ? "text-sm" : "text-base"
                )}>
                    {title}
                </h3>

                {/* Content type icons */}
                {contentTypes.length > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                        {[...new Set(contentTypes)].slice(0, 5).map((type, i) => (
                            <ContentTypeIcon
                                key={i}
                                type={type}
                                className="w-3.5 h-3.5 text-gray-400"
                            />
                        ))}
                    </div>
                )}

                {/* Tags */}
                {tagIds.length > 0 && tags.length > 0 && (
                    <div className="mt-2">
                        <TagListDisplay tags={tags} tagIds={tagIds} size="sm" />
                    </div>
                )}
            </div>
        </div>
    );
};

interface SlideGridProps {
    slides: (Slide | PresentationSlide)[];
    tags?: Tag[];
    selectedIds?: Set<string | number>;
    onSelectSlide?: (id: string | number) => void;
    onClickSlide?: (slide: Slide | PresentationSlide) => void;
    onStarToggle?: (slide: Slide) => void;
    selectionMode?: boolean;
    compact?: boolean;
    emptyMessage?: string;
}

export const SlideGrid: React.FC<SlideGridProps> = ({
    slides,
    tags = [],
    selectedIds = new Set(),
    onSelectSlide,
    onClickSlide,
    onStarToggle,
    selectionMode = false,
    compact = false,
    emptyMessage = "No slides found"
}) => {
    if (slides.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mb-3 opacity-50" />
                <p>{emptyMessage}</p>
            </div>
        );
    }

    const getSlideKey = (slide: Slide | PresentationSlide) => {
        if ('id' in slide) return slide.id;
        return slide.slideOrder;
    };

    return (
        <div className={clsx(
            "grid gap-4",
            compact
                ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        )}>
            {slides.map((slide) => {
                const key = getSlideKey(slide);
                return (
                    <SlideCard
                        key={key}
                        slide={slide}
                        tags={tags}
                        selected={selectedIds.has(key)}
                        onSelect={onSelectSlide ? () => onSelectSlide(key) : undefined}
                        onClick={onClickSlide ? () => onClickSlide(slide) : undefined}
                        onStarToggle={
                            onStarToggle && 'id' in slide
                                ? () => onStarToggle(slide as Slide)
                                : undefined
                        }
                        showCheckbox={selectionMode}
                        compact={compact}
                    />
                );
            })}
        </div>
    );
};

export default SlideCard;
