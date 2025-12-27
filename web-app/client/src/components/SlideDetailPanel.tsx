import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Star, ExternalLink, Trash2, FileText, Loader2, ChevronDown, ChevronUp, Package, Sparkles, Plus } from 'lucide-react';
import clsx from 'clsx';
import { InlineText, InlineTagEditor } from './InlineEdit';
import type { Slide, Tag, ManagedPresentation, Pack } from '../api';
import { updateSlide, demoteSlide, getSlideContent } from '../api';
import { ContentRenderer, type ContentBlock } from './ContentRenderer';

interface SlideDetailPanelProps {
    slide: Slide | null;
    tags: Tag[];
    presentations: ManagedPresentation[];
    packs: Pack[];
    isOpen: boolean;
    onClose: () => void;
    onSlideUpdate: (slide: Slide) => void;
    onSlideRemove: (slideId: string) => void;
    onAddToPack: (slideId: string, packId: string) => void;
    onFindSimilar: (slide: Slide) => void;
    onCreateNewPack: (slideId: string) => void;
}

export const SlideDetailPanel: React.FC<SlideDetailPanelProps> = ({
    slide,
    tags,
    presentations,
    packs,
    isOpen,
    onClose,
    onSlideUpdate,
    onSlideRemove,
    onAddToPack,
    onFindSimilar,
    onCreateNewPack
}) => {
    const navigate = useNavigate();
    const [isRemoving, setIsRemoving] = useState(false);
    const [notes, setNotes] = useState('');
    const [isSavingNotes, setIsSavingNotes] = useState(false);
    const [content, setContent] = useState<ContentBlock[] | null>(null);
    const [contentLoading, setContentLoading] = useState(false);
    const [contentExpanded, setContentExpanded] = useState(true);
    const [packDropdownOpen, setPackDropdownOpen] = useState(false);

    // Update notes when slide changes
    useEffect(() => {
        if (slide) {
            setNotes(slide.notes || '');
        }
    }, [slide?.id]);

    // Fetch content when slide changes
    useEffect(() => {
        if (!slide) {
            setContent(null);
            return;
        }

        const fetchContent = async () => {
            setContentLoading(true);
            try {
                const data = await getSlideContent(slide.id);
                setContent(data.content || []);
            } catch (e) {
                console.error('Failed to fetch slide content:', e);
                setContent([]);
            } finally {
                setContentLoading(false);
            }
        };

        fetchContent();
    }, [slide?.id]);

    if (!slide) return null;

    const presentation = presentations.find(p => p.id === slide.sourceId);
    const presentationName = presentation?.originalName?.replace(/\.pptx?$/i, '') || 'Unknown Presentation';

    const handleStarToggle = async () => {
        try {
            const updated = await updateSlide(slide.id, { starred: !slide.starred });
            onSlideUpdate({ ...slide, ...updated });
        } catch (e) {
            console.error('Failed to toggle star:', e);
        }
    };

    const handleTitleSave = async (newTitle: string) => {
        const updated = await updateSlide(slide.id, { title: newTitle });
        onSlideUpdate({ ...slide, ...updated });
    };

    const handleTagsSave = async (tagIds: string[]) => {
        const updated = await updateSlide(slide.id, { tagIds });
        onSlideUpdate({ ...slide, ...updated });
    };

    const handleNotesSave = async () => {
        if (notes === slide.notes) return;
        setIsSavingNotes(true);
        try {
            const updated = await updateSlide(slide.id, { notes });
            onSlideUpdate({ ...slide, ...updated });
        } catch (e) {
            console.error('Failed to save notes:', e);
        } finally {
            setIsSavingNotes(false);
        }
    };

    const handleViewInPresentation = () => {
        navigate(`/viewer/new/${slide.sourceId}/${slide.sourceId}?slide=${slide.sourceSlideOrder}`);
    };

    const handleDemote = async () => {
        if (!confirm('Remove this slide from your library? The original slide in the presentation will not be affected.')) {
            return;
        }
        setIsRemoving(true);
        try {
            await demoteSlide(slide.id);
            onSlideRemove(slide.id);
            onClose();
        } catch (e) {
            console.error('Failed to demote slide:', e);
            alert('Failed to remove slide from library');
        } finally {
            setIsRemoving(false);
        }
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

            {/* Panel */}
            <div
                className={clsx(
                    "fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 transform transition-transform duration-300 flex flex-col",
                    isOpen ? "translate-x-0" : "translate-x-full"
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-bold text-gray-900">Slide Details</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleStarToggle}
                            className={clsx(
                                "p-2 rounded-full transition-colors",
                                slide.starred
                                    ? "text-yellow-500 bg-yellow-50 hover:bg-yellow-100"
                                    : "text-gray-400 hover:text-yellow-500 hover:bg-gray-100"
                            )}
                            title={slide.starred ? "Unstar" : "Star"}
                        >
                            <Star className={clsx("w-5 h-5", slide.starred && "fill-current")} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Thumbnail */}
                    <div className="aspect-[16/10] bg-gray-100 rounded-lg overflow-hidden">
                        {slide.screenshotUrl ? (
                            <img
                                src={slide.screenshotUrl}
                                alt={slide.title}
                                className="w-full h-full object-contain"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <FileText className="w-16 h-16" />
                            </div>
                        )}
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Find Similar */}
                        <button
                            onClick={() => {
                                onFindSimilar(slide);
                                onClose();
                            }}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                        >
                            <Sparkles className="w-4 h-4" />
                            Find Similar
                        </button>

                        {/* Add to Pack Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setPackDropdownOpen(!packDropdownOpen)}
                                className={clsx(
                                    "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                                    packDropdownOpen
                                        ? "bg-purple-600 text-white"
                                        : "text-gray-700 bg-gray-100 hover:bg-gray-200"
                                )}
                            >
                                <Package className="w-4 h-4" />
                                Add to Pack
                                <ChevronDown className={clsx("w-4 h-4 transition-transform", packDropdownOpen && "rotate-180")} />
                            </button>
                            {packDropdownOpen && (
                                <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                                    {packs.length > 0 ? (
                                        <>
                                            <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b">
                                                Existing Packs
                                            </div>
                                            {packs.map(pack => {
                                                const isInPack = pack.slideIds.includes(slide.id);
                                                return (
                                                    <button
                                                        key={pack.id}
                                                        onClick={() => {
                                                            onAddToPack(slide.id, pack.id);
                                                            setPackDropdownOpen(false);
                                                        }}
                                                        disabled={isInPack}
                                                        className={clsx(
                                                            "w-full px-3 py-2 text-left text-sm flex items-center gap-2",
                                                            isInPack
                                                                ? "text-gray-400 cursor-default"
                                                                : "text-gray-700 hover:bg-purple-50"
                                                        )}
                                                    >
                                                        <Package
                                                            className="w-4 h-4 flex-shrink-0"
                                                            style={{ color: pack.color }}
                                                        />
                                                        <span className="truncate">{pack.name}</span>
                                                        {isInPack && (
                                                            <span className="text-xs text-gray-400 ml-auto">Added</span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                            <div className="border-t my-1" />
                                        </>
                                    ) : null}
                                    <button
                                        onClick={() => {
                                            onCreateNewPack(slide.id);
                                            setPackDropdownOpen(false);
                                            onClose();
                                        }}
                                        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-purple-700 hover:bg-purple-50"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <span>Create New Pack</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Semantic Content */}
                    <div className="border rounded-lg overflow-hidden">
                        <button
                            onClick={() => setContentExpanded(!contentExpanded)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                            <span className="text-sm font-medium text-gray-700">Semantic Content</span>
                            <div className="flex items-center gap-2">
                                {contentLoading && (
                                    <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                                )}
                                {content && (
                                    <span className="text-xs text-gray-500">{content.length} blocks</span>
                                )}
                                {contentExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-gray-400" />
                                ) : (
                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                )}
                            </div>
                        </button>
                        {contentExpanded && (
                            <div className="p-4 bg-white max-h-[400px] overflow-y-auto">
                                {contentLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                                    </div>
                                ) : content && content.length > 0 ? (
                                    <div className="space-y-2">
                                        {content.map((block, idx) => (
                                            <ContentRenderer
                                                key={idx}
                                                block={block}
                                                conversionId={slide.sourceId}
                                                compact={true}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-400 italic text-center py-4">
                                        No semantic content available
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                            Title
                        </label>
                        <InlineText
                            value={slide.title}
                            placeholder="Enter slide title..."
                            onSave={handleTitleSave}
                            className="text-lg font-semibold"
                        />
                    </div>

                    {/* Source Presentation */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                            Source Presentation
                        </label>
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                            <span className="truncate">{presentationName}</span>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-500">Slide #{slide.sourceSlideOrder}</span>
                        </div>
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                            Tags
                        </label>
                        <InlineTagEditor
                            selectedTagIds={slide.tagIds || []}
                            availableTags={tags}
                            onSave={handleTagsSave}
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                            Notes
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            onBlur={handleNotesSave}
                            placeholder="Add notes about this slide..."
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[100px] text-sm"
                            disabled={isSavingNotes}
                        />
                        {isSavingNotes && (
                            <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Saving...
                            </div>
                        )}
                    </div>

                    {/* Metadata */}
                    <div className="text-xs text-gray-500 space-y-1">
                        <div>Layout: {slide.metadata?.layout || 'Unknown'}</div>
                        <div>Word count: {slide.metadata?.wordCount || 0}</div>
                        <div>Last modified: {new Date(slide.lastModified).toLocaleString()}</div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
                    <button
                        onClick={handleDemote}
                        disabled={isRemoving}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {isRemoving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Trash2 className="w-4 h-4" />
                        )}
                        Remove from Library
                    </button>
                    <button
                        onClick={handleViewInPresentation}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <ExternalLink className="w-4 h-4" />
                        View in Presentation
                    </button>
                </div>
            </div>
        </>
    );
};

export default SlideDetailPanel;
