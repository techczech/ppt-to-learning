import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Library,
    Search,
    Star,
    Tag,
    Filter,
    Loader2,
    RefreshCw,
    ArrowLeft,
    Layers
} from 'lucide-react';
import clsx from 'clsx';
import { SlideGrid } from '../components/SlideCard';
import { TagPill } from '../components/TagPills';
import {
    getSlides,
    updateSlide,
    getTags,
    getManagedPresentations,
    type Slide,
    type Tag as TagType,
    type ManagedPresentation
} from '../api';

const SlideLibrary: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Data state
    const [slides, setSlides] = useState<Slide[]>([]);
    const [tags, setTags] = useState<TagType[]>([]);
    const [presentations, setPresentations] = useState<ManagedPresentation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter state
    const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
    const [selectedTagId, setSelectedTagId] = useState<string | null>(searchParams.get('tag'));
    const [selectedSourceId, setSelectedSourceId] = useState<string | null>(searchParams.get('source'));
    const [showStarredOnly, setShowStarredOnly] = useState(searchParams.get('starred') === 'true');
    const [showFilters, setShowFilters] = useState(false);

    // Load data
    useEffect(() => {
        loadData();
    }, []);

    // Update URL params when filters change
    useEffect(() => {
        const params = new URLSearchParams();
        if (searchQuery) params.set('search', searchQuery);
        if (selectedTagId) params.set('tag', selectedTagId);
        if (selectedSourceId) params.set('source', selectedSourceId);
        if (showStarredOnly) params.set('starred', 'true');
        setSearchParams(params, { replace: true });
    }, [searchQuery, selectedTagId, selectedSourceId, showStarredOnly]);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [slidesData, tagsData, presentationsData] = await Promise.all([
                getSlides(),
                loadAllTags(),
                getManagedPresentations()
            ]);
            setSlides(slidesData);
            setTags(tagsData);
            setPresentations(presentationsData);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load slides');
        } finally {
            setLoading(false);
        }
    };

    // Load tags from all collections
    const loadAllTags = async (): Promise<TagType[]> => {
        // Get all unique tags - in a real app you might have a dedicated endpoint
        const collectionsRes = await fetch('/api/collections');
        const collections = await collectionsRes.json();
        const allTags: TagType[] = [];
        for (const coll of collections) {
            const collTags = await getTags(coll.id);
            allTags.push(...collTags);
        }
        return allTags;
    };

    // Filter slides
    const filteredSlides = useMemo(() => {
        let result = [...slides];

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(s =>
                s.title.toLowerCase().includes(query) ||
                s.notes?.toLowerCase().includes(query)
            );
        }

        if (selectedTagId) {
            result = result.filter(s => s.tagIds?.includes(selectedTagId));
        }

        if (selectedSourceId) {
            result = result.filter(s => s.sourceId === selectedSourceId);
        }

        if (showStarredOnly) {
            result = result.filter(s => s.starred);
        }

        return result;
    }, [slides, searchQuery, selectedTagId, selectedSourceId, showStarredOnly]);

    // Get unique sources that have promoted slides
    const sourcesWithSlides = useMemo(() => {
        const sourceIds = new Set(slides.map(s => s.sourceId));
        return presentations.filter(p => sourceIds.has(p.id));
    }, [slides, presentations]);

    const handleStarToggle = async (slide: Slide) => {
        try {
            const updated = await updateSlide(slide.id, { starred: !slide.starred });
            setSlides(prev => prev.map(s => s.id === updated.id ? updated : s));
        } catch (e) {
            console.error('Failed to toggle star:', e);
        }
    };

    const handleSlideClick = (slide: Slide) => {
        // Navigate to viewer with this slide focused
        navigate(`/view/${slide.sourceId}/${slide.sourceId}?slide=${slide.sourceSlideOrder}`);
    };

    const clearFilters = () => {
        setSearchQuery('');
        setSelectedTagId(null);
        setSelectedSourceId(null);
        setShowStarredOnly(false);
    };

    const hasActiveFilters = searchQuery || selectedTagId || selectedSourceId || showStarredOnly;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/')}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div className="flex items-center gap-2">
                                <Library className="w-6 h-6 text-blue-600" />
                                <h1 className="text-xl font-semibold text-gray-900">
                                    Slide Library
                                </h1>
                            </div>
                            <span className="text-sm text-gray-500">
                                {slides.length} slide{slides.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={loadData}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                                title="Refresh"
                            >
                                <RefreshCw className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Filter bar */}
            <div className="bg-white border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                    <div className="flex items-center gap-4">
                        {/* Search */}
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search slides..."
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Quick filters */}
                        <button
                            onClick={() => setShowStarredOnly(!showStarredOnly)}
                            className={clsx(
                                "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
                                showStarredOnly
                                    ? "bg-yellow-50 border-yellow-300 text-yellow-700"
                                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                            )}
                        >
                            <Star className={clsx("w-4 h-4", showStarredOnly && "fill-current")} />
                            Starred
                        </button>

                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={clsx(
                                "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
                                showFilters || hasActiveFilters
                                    ? "bg-blue-50 border-blue-300 text-blue-700"
                                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                            )}
                        >
                            <Filter className="w-4 h-4" />
                            Filters
                            {hasActiveFilters && (
                                <span className="w-2 h-2 bg-blue-500 rounded-full" />
                            )}
                        </button>

                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="text-sm text-gray-500 hover:text-gray-700"
                            >
                                Clear all
                            </button>
                        )}
                    </div>

                    {/* Expanded filters */}
                    {showFilters && (
                        <div className="mt-4 pt-4 border-t space-y-3">
                            {/* Tags */}
                            {tags.length > 0 && (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Tag className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm text-gray-500 mr-2">Tags:</span>
                                    {tags.map(tag => (
                                        <button
                                            key={tag.id}
                                            onClick={() => setSelectedTagId(
                                                selectedTagId === tag.id ? null : tag.id
                                            )}
                                        >
                                            <TagPill
                                                tag={tag}
                                                selected={selectedTagId === tag.id}
                                                size="sm"
                                            />
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Sources */}
                            {sourcesWithSlides.length > 0 && (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Layers className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm text-gray-500 mr-2">Source:</span>
                                    {sourcesWithSlides.map(source => (
                                        <button
                                            key={source.id}
                                            onClick={() => setSelectedSourceId(
                                                selectedSourceId === source.id ? null : source.id
                                            )}
                                            className={clsx(
                                                "px-2 py-1 text-sm rounded-lg transition-colors",
                                                selectedSourceId === source.id
                                                    ? "bg-blue-100 text-blue-700"
                                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                            )}
                                        >
                                            {source.originalName}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                ) : error ? (
                    <div className="text-center py-12">
                        <p className="text-red-600 mb-4">{error}</p>
                        <button
                            onClick={loadData}
                            className="text-blue-600 hover:text-blue-800"
                        >
                            Try again
                        </button>
                    </div>
                ) : slides.length === 0 ? (
                    <div className="text-center py-12">
                        <Library className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                        <h2 className="text-xl font-medium text-gray-600 mb-2">
                            No slides in your library yet
                        </h2>
                        <p className="text-gray-500 mb-4">
                            Open a presentation and promote slides to build your library.
                        </p>
                        <button
                            onClick={() => navigate('/')}
                            className="text-blue-600 hover:text-blue-800"
                        >
                            Go to presentations
                        </button>
                    </div>
                ) : filteredSlides.length === 0 ? (
                    <div className="text-center py-12">
                        <Search className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500 mb-4">
                            No slides match your filters
                        </p>
                        <button
                            onClick={clearFilters}
                            className="text-blue-600 hover:text-blue-800"
                        >
                            Clear filters
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="mb-4 text-sm text-gray-500">
                            Showing {filteredSlides.length} of {slides.length} slides
                        </div>
                        <SlideGrid
                            slides={filteredSlides}
                            tags={tags}
                            onClickSlide={(slide) => handleSlideClick(slide as Slide)}
                            onStarToggle={handleStarToggle}
                        />
                    </>
                )}
            </main>
        </div>
    );
};

export default SlideLibrary;
