import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
    Layers,
    Sparkles,
    Presentation,
    Plus,
    Image,
    FileText,
    Package,
    CheckSquare,
    Square,
    Trash2,
    FolderInput,
    X
} from 'lucide-react';
import clsx from 'clsx';
import { TagPill } from '../components/TagPills';
import { SlideDetailPanel } from '../components/SlideDetailPanel';
import { SlideLibrarySidebar } from '../components/SlideLibrarySidebar';
import { CartDrawer, CartButton } from '../components/CartDrawer';
import { SavePackModal } from '../components/SavePackModal';
import { EditPackModal } from '../components/EditPackModal';
import { SlidePickerModal } from '../components/SlidePickerModal';
import { SimilarSlidesPanel } from '../components/SimilarSlidesPanel';
import { MoveToCollectionModal } from '../components/MoveToCollectionModal';
import { PackFolderModal } from '../components/PackFolderModal';
import {
    getSlides,
    getTags,
    getManagedPresentations,
    getCollections,
    getFolders,
    getPacks,
    getPackFolders,
    createPackFolder,
    updatePackFolder,
    deletePackFolder,
    deletePack,
    getPackWithSlides,
    getPackExportUrl,
    searchSlides,
    getCart,
    addToCart,
    isInCart,
    getSlideContent,
    updatePack,
    updateSlide,
    demoteSlide,
    type Slide,
    type Tag as TagType,
    type ManagedPresentation,
    type Collection,
    type Folder,
    type Pack,
    type PackFolder
} from '../api';
import { ContentRenderer, type ContentBlock } from '../components/ContentRenderer';

const SlideLibrary: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Data state
    const [slides, setSlides] = useState<Slide[]>([]);
    const [tags, setTags] = useState<TagType[]>([]);
    const [presentations, setPresentations] = useState<ManagedPresentation[]>([]);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [packs, setPacks] = useState<Pack[]>([]);
    const [packFolders, setPackFolders] = useState<PackFolder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter state
    const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
    const [selectedTagId, setSelectedTagId] = useState<string | null>(searchParams.get('tag'));
    const [selectedSourceId, setSelectedSourceId] = useState<string | null>(searchParams.get('source'));
    const [showStarredOnly, setShowStarredOnly] = useState(searchParams.get('starred') === 'true');
    const [showFilters, setShowFilters] = useState(false);

    // Organization state
    const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
    const [selectedPackFolderId, setSelectedPackFolderId] = useState<string | null>(null);

    // Panel state
    const [selectedSlide, setSelectedSlide] = useState<Slide | null>(null);
    const [similarSlide, setSimilarSlide] = useState<Slide | null>(null);
    const [showSimilarPanel, setShowSimilarPanel] = useState(false);

    // Cart state
    const [cartOpen, setCartOpen] = useState(false);
    const [cartCount, setCartCount] = useState(0);
    const [cartVersion, setCartVersion] = useState(0);
    const [savePackSlideIds, setSavePackSlideIds] = useState<string[]>([]);
    const [showSavePackModal, setShowSavePackModal] = useState(false);

    // Edit pack state
    const [editingPack, setEditingPack] = useState<Pack | null>(null);
    const [showSlidePicker, setShowSlidePicker] = useState(false);
    const [slidesToAddToPack, setSlidesToAddToPack] = useState<string[]>([]);

    // Search state
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<Slide[] | null>(null);

    // View mode state
    const [viewMode, setViewMode] = useState<'screenshots' | 'content'>('screenshots');
    const [slideContents, setSlideContents] = useState<Map<string, any[]>>(new Map());

    // Add to pack dropdown state
    const [packDropdownSlideId, setPackDropdownSlideId] = useState<string | null>(null);

    // Batch selection state
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedSlideIds, setSelectedSlideIds] = useState<Set<string>>(new Set());
    const [batchActionInProgress, setBatchActionInProgress] = useState(false);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [showPackFolderModal, setShowPackFolderModal] = useState(false);
    const [editingPackFolder, setEditingPackFolder] = useState<PackFolder | null>(null);
    const [showBatchPackDropdown, setShowBatchPackDropdown] = useState(false);

    // Load data
    useEffect(() => {
        loadData();
        updateCartCount();
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

    // Debounced search
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults(null);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const result = await searchSlides(searchQuery, {
                    collectionId: selectedCollectionId || undefined,
                    folderId: selectedFolderId || undefined,
                    limit: 100
                });
                setSearchResults(result.results);
            } catch (e) {
                console.error('Search failed:', e);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery, selectedCollectionId, selectedFolderId]);

    const updateCartCount = () => {
        setCartCount(getCart().length);
    };

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [slidesData, tagsData, presentationsData, collectionsData, packsData, packFoldersData] = await Promise.all([
                getSlides(),
                loadAllTags(),
                getManagedPresentations(),
                getCollections(),
                getPacks(),
                getPackFolders()
            ]);

            // Load folders from all collections
            const allFolders: Folder[] = [];
            for (const coll of collectionsData) {
                const collFolders = await getFolders(coll.id);
                allFolders.push(...collFolders);
            }

            setSlides(slidesData);
            setTags(tagsData);
            setPresentations(presentationsData);
            setCollections(collectionsData);
            setFolders(allFolders);
            setPacks(packsData);
            setPackFolders(packFoldersData);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load slides');
        } finally {
            setLoading(false);
        }
    };

    // Load content for visible slides when in content mode
    const loadSlideContents = useCallback(async (slideIds: string[]) => {
        const toLoad = slideIds.filter(id => !slideContents.has(id));
        if (toLoad.length === 0) return;

        // Load in batches
        const batchSize = 10;
        for (let i = 0; i < toLoad.length; i += batchSize) {
            const batch = toLoad.slice(i, i + batchSize);
            const results = await Promise.all(
                batch.map(async (id) => {
                    try {
                        const data = await getSlideContent(id);
                        return { id, content: data.content || [] };
                    } catch {
                        return { id, content: [] };
                    }
                })
            );
            setSlideContents(prev => {
                const next = new Map(prev);
                results.forEach(({ id, content }) => next.set(id, content));
                return next;
            });
        }
    }, [slideContents]);

    // Load tags from all collections
    const loadAllTags = async (): Promise<TagType[]> => {
        const collectionsRes = await fetch('/api/collections');
        const collections = await collectionsRes.json();
        const allTags: TagType[] = [];
        for (const coll of collections) {
            const collTags = await getTags(coll.id);
            allTags.push(...collTags);
        }
        return allTags;
    };

    // Load pack slides when pack is selected
    useEffect(() => {
        if (selectedPackId) {
            loadPackSlides(selectedPackId);
        }
    }, [selectedPackId]);

    // Load slides from all packs in folder when pack folder is selected
    useEffect(() => {
        if (selectedPackFolderId) {
            loadPackFolderSlides(selectedPackFolderId);
        }
    }, [selectedPackFolderId]);

    const loadPackFolderSlides = async (folderId: string) => {
        try {
            const folderPacks = packs.filter(p => p.folderId === folderId);
            const allSlides: Slide[] = [];
            for (const pack of folderPacks) {
                const { slides: packSlides } = await getPackWithSlides(pack.id);
                allSlides.push(...packSlides);
            }
            // Remove duplicates by slide ID
            const uniqueSlides = Array.from(new Map(allSlides.map(s => [s.id, s])).values());
            setSlides(uniqueSlides);
        } catch (e) {
            console.error('Failed to load pack folder slides:', e);
        }
    };

    const loadPackSlides = async (packId: string) => {
        try {
            const { slides: packSlides } = await getPackWithSlides(packId);
            setSlides(packSlides);
        } catch (e) {
            console.error('Failed to load pack slides:', e);
        }
    };

    // Filter slides
    const filteredSlides = useMemo(() => {
        // If we have search results, use those
        if (searchResults !== null) {
            let result = [...searchResults];

            if (selectedTagId) {
                result = result.filter(s => s.tagIds?.includes(selectedTagId));
            }
            if (showStarredOnly) {
                result = result.filter(s => s.starred);
            }

            return result;
        }

        // Otherwise filter the loaded slides
        let result = [...slides];

        if (selectedCollectionId && !selectedPackId) {
            result = result.filter(s => s.collectionId === selectedCollectionId);
        }

        if (selectedFolderId && !selectedPackId) {
            result = result.filter(s => s.folderId === selectedFolderId);
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
    }, [slides, searchResults, selectedCollectionId, selectedFolderId, selectedTagId, selectedSourceId, showStarredOnly, selectedPackId]);

    // Load content for filtered slides when in content mode
    useEffect(() => {
        if (viewMode === 'content' && filteredSlides.length > 0) {
            loadSlideContents(filteredSlides.slice(0, 20).map(s => s.id));
        }
    }, [viewMode, filteredSlides, loadSlideContents]);

    // Get unique sources that have promoted slides
    const sourcesWithSlides = useMemo(() => {
        const sourceIds = new Set(slides.map(s => s.sourceId));
        return presentations.filter(p => sourceIds.has(p.id));
    }, [slides, presentations]);

    const handleSlideClick = (slide: Slide) => {
        setSelectedSlide(slide);
    };

    const handleSlideUpdate = (updatedSlide: Slide) => {
        setSlides(prev => prev.map(s => s.id === updatedSlide.id ? updatedSlide : s));
        setSelectedSlide(updatedSlide);
    };

    const handleSlideRemove = (slideId: string) => {
        setSlides(prev => prev.filter(s => s.id !== slideId));
        setSelectedSlide(null);
    };

    const handleAddToCart = useCallback((slide: Slide) => {
        addToCart(slide.id);
        updateCartCount();
        setCartVersion(v => v + 1);
    }, []);

    const handleAddToPack = async (slideId: string, packId: string) => {
        const pack = packs.find(p => p.id === packId);
        if (!pack) return;

        // Check if already in pack
        if (pack.slideIds.includes(slideId)) {
            setPackDropdownSlideId(null);
            return;
        }

        try {
            const updatedPack = await updatePack(packId, {
                slideIds: [...pack.slideIds, slideId]
            });
            setPacks(prev => prev.map(p => p.id === packId ? updatedPack : p));
        } catch (e) {
            console.error('Failed to add slide to pack:', e);
        } finally {
            setPackDropdownSlideId(null);
        }
    };

    const handleFindSimilar = (slide: Slide) => {
        setSimilarSlide(slide);
        setShowSimilarPanel(true);
        setSelectedSlide(null);
    };

    const handleSaveAsPack = (slideIds: string[]) => {
        setSavePackSlideIds(slideIds);
        setShowSavePackModal(true);
        setCartOpen(false);
    };

    const handlePackCreated = (pack: Pack) => {
        setPacks(prev => [...prev, pack]);
        updateCartCount();
        setCartVersion(v => v + 1);
    };

    const handleExportPack = (packId: string) => {
        window.location.href = getPackExportUrl(packId);
    };

    const handleDeletePack = async (packId: string) => {
        if (!confirm('Delete this pack? The slides will remain in your library.')) return;

        try {
            await deletePack(packId);
            setPacks(prev => prev.filter(p => p.id !== packId));
            if (selectedPackId === packId) {
                setSelectedPackId(null);
                loadData();
            }
        } catch (e) {
            console.error('Failed to delete pack:', e);
        }
    };

    const handleEditPack = (packId: string) => {
        const pack = packs.find(p => p.id === packId);
        if (pack) {
            setEditingPack(pack);
        }
    };

    const handlePackUpdated = (updatedPack: Pack) => {
        setPacks(prev => prev.map(p => p.id === updatedPack.id ? updatedPack : p));
    };

    // Batch selection handlers
    const toggleSlideSelection = (slideId: string) => {
        setSelectedSlideIds(prev => {
            const next = new Set(prev);
            if (next.has(slideId)) {
                next.delete(slideId);
            } else {
                next.add(slideId);
            }
            return next;
        });
    };

    const selectAllVisible = () => {
        setSelectedSlideIds(new Set(filteredSlides.map(s => s.id)));
    };

    const clearSelection = () => {
        setSelectedSlideIds(new Set());
    };

    const exitSelectionMode = () => {
        setSelectionMode(false);
        setSelectedSlideIds(new Set());
        setShowBatchPackDropdown(false);
    };

    const handleBatchAddToPack = async (packId: string) => {
        const pack = packs.find(p => p.id === packId);
        if (!pack) return;

        setBatchActionInProgress(true);
        try {
            const newSlideIds = Array.from(selectedSlideIds).filter(id => !pack.slideIds.includes(id));
            if (newSlideIds.length > 0) {
                const updatedPack = await updatePack(packId, {
                    slideIds: [...pack.slideIds, ...newSlideIds]
                });
                setPacks(prev => prev.map(p => p.id === packId ? updatedPack : p));
            }
            exitSelectionMode();
        } catch (e) {
            console.error('Failed to add slides to pack:', e);
        } finally {
            setBatchActionInProgress(false);
            setShowBatchPackDropdown(false);
        }
    };

    const handleBatchDelete = async () => {
        const count = selectedSlideIds.size;
        if (!confirm(`Remove ${count} slide${count !== 1 ? 's' : ''} from your library? The original slides in presentations will not be affected.`)) {
            return;
        }

        setBatchActionInProgress(true);
        try {
            const idsToDelete = Array.from(selectedSlideIds);
            await Promise.all(idsToDelete.map(id => demoteSlide(id)));
            setSlides(prev => prev.filter(s => !selectedSlideIds.has(s.id)));
            exitSelectionMode();
        } catch (e) {
            console.error('Failed to delete slides:', e);
            alert('Failed to delete some slides');
        } finally {
            setBatchActionInProgress(false);
        }
    };

    const handleBatchMove = async (collectionId: string | null, folderId: string | null) => {
        setBatchActionInProgress(true);
        try {
            const idsToMove = Array.from(selectedSlideIds);
            await Promise.all(idsToMove.map(id =>
                updateSlide(id, { collectionId: collectionId || undefined, folderId: folderId || undefined })
            ));
            // Refresh slides to get updated data
            const updatedSlides = await getSlides();
            setSlides(updatedSlides);
            exitSelectionMode();
            setShowMoveModal(false);
        } catch (e) {
            console.error('Failed to move slides:', e);
            alert('Failed to move some slides');
        } finally {
            setBatchActionInProgress(false);
        }
    };

    const handleBatchCreatePack = () => {
        setSavePackSlideIds(Array.from(selectedSlideIds));
        setShowSavePackModal(true);
        exitSelectionMode();
    };

    const handleSelectCollection = (id: string | null) => {
        setSelectedCollectionId(id);
        setSelectedFolderId(null);
        setSelectedPackId(null);
        if (id === null) {
            loadData();
        }
    };

    const handleSelectFolder = (id: string | null) => {
        setSelectedFolderId(id);
        setSelectedPackId(null);
    };

    const handleSelectPack = (id: string | null) => {
        setSelectedPackId(id);
        setSelectedCollectionId(null);
        setSelectedFolderId(null);
        setSelectedPackFolderId(null);
        if (id === null) {
            loadData();
        }
    };

    const handleSelectPackFolder = (id: string | null) => {
        setSelectedPackFolderId(id);
        setSelectedPackId(null);
        setSelectedCollectionId(null);
        setSelectedFolderId(null);
    };

    const handleCreatePackFolder = () => {
        setEditingPackFolder(null);
        setShowPackFolderModal(true);
    };

    const handleEditPackFolder = (folderId: string) => {
        const folder = packFolders.find(f => f.id === folderId);
        if (!folder) return;
        setEditingPackFolder(folder);
        setShowPackFolderModal(true);
    };

    const handleSavePackFolder = async (data: { name: string; color: string; parentId: string | null }) => {
        if (editingPackFolder) {
            // Edit mode
            const updated = await updatePackFolder(editingPackFolder.id, data);
            setPackFolders(prev => prev.map(f => f.id === editingPackFolder.id ? updated : f));
        } else {
            // Create mode
            const folder = await createPackFolder(data.name, { color: data.color, parentId: data.parentId });
            setPackFolders(prev => [...prev, folder]);
        }
    };

    const handleDeletePackFolder = async (folderId: string) => {
        const folder = packFolders.find(f => f.id === folderId);
        if (!folder) return;

        const packsInFolder = packs.filter(p => p.folderId === folderId);
        const message = packsInFolder.length > 0
            ? `Delete folder "${folder.name}"? The ${packsInFolder.length} pack(s) inside will be moved out of the folder.`
            : `Delete folder "${folder.name}"?`;

        if (!confirm(message)) return;

        try {
            await deletePackFolder(folderId);
            setPackFolders(prev => prev.filter(f => f.id !== folderId));
            // Update packs to remove folder reference
            setPacks(prev => prev.map(p => p.folderId === folderId ? { ...p, folderId: null } : p));
            if (selectedPackFolderId === folderId) {
                setSelectedPackFolderId(null);
            }
        } catch (e) {
            console.error('Failed to delete pack folder:', e);
            alert('Failed to delete folder');
        }
    };

    const clearFilters = () => {
        setSearchQuery('');
        setSelectedTagId(null);
        setSelectedSourceId(null);
        setShowStarredOnly(false);
        setSearchResults(null);
    };

    const hasActiveFilters = searchQuery || selectedTagId || selectedSourceId || showStarredOnly;

    // Get current context label
    const getContextLabel = () => {
        if (selectedPackId) {
            const pack = packs.find(p => p.id === selectedPackId);
            return pack ? `Pack: ${pack.name}` : 'Pack';
        }
        if (selectedPackFolderId) {
            const folder = packFolders.find(f => f.id === selectedPackFolderId);
            return folder ? `Pack Folder: ${folder.name}` : 'Pack Folder';
        }
        if (selectedFolderId) {
            const folder = folders.find(f => f.id === selectedFolderId);
            return folder ? folder.name : 'Folder';
        }
        if (selectedCollectionId) {
            const collection = collections.find(c => c.id === selectedCollectionId);
            return collection ? collection.name : 'Collection';
        }
        return 'All Slides';
    };

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <SlideLibrarySidebar
                collections={collections}
                folders={folders}
                packs={packs}
                packFolders={packFolders}
                selectedCollectionId={selectedCollectionId}
                selectedFolderId={selectedFolderId}
                selectedPackId={selectedPackId}
                selectedPackFolderId={selectedPackFolderId}
                onSelectCollection={handleSelectCollection}
                onSelectFolder={handleSelectFolder}
                onSelectPack={handleSelectPack}
                onSelectPackFolder={handleSelectPackFolder}
                onEditPack={handleEditPack}
                onExportPack={handleExportPack}
                onDeletePack={handleDeletePack}
                onCreatePackFolder={handleCreatePackFolder}
                onEditPackFolder={handleEditPackFolder}
                onDeletePackFolder={handleDeletePackFolder}
            />

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <header className="bg-white border-b sticky top-0 z-10">
                    <div className="px-4 sm:px-6 lg:px-8">
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
                                        {getContextLabel()}
                                    </h1>
                                </div>
                                <span className="text-sm text-gray-500">
                                    {filteredSlides.length} slide{filteredSlides.length !== 1 ? 's' : ''}
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
                    <div className="px-4 sm:px-6 lg:px-8 py-3">
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
                                {isSearching && (
                                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                                )}
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
                <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
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
                    ) : slides.length === 0 && !selectedPackId ? (
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
                            <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
                                {selectionMode ? (
                                    // Selection mode toolbar
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-medium text-purple-700">
                                            {selectedSlideIds.size} selected
                                        </span>
                                        <button
                                            onClick={selectAllVisible}
                                            className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                                        >
                                            Select all
                                        </button>
                                        <button
                                            onClick={clearSelection}
                                            className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                                        >
                                            Clear
                                        </button>
                                        <div className="h-4 w-px bg-gray-300" />
                                        {/* Batch actions */}
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowBatchPackDropdown(!showBatchPackDropdown)}
                                                disabled={selectedSlideIds.size === 0 || batchActionInProgress}
                                                className={clsx(
                                                    "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                                                    selectedSlideIds.size === 0
                                                        ? "text-gray-400 cursor-not-allowed"
                                                        : "text-purple-700 bg-purple-50 hover:bg-purple-100"
                                                )}
                                            >
                                                <Package className="w-4 h-4" />
                                                Add to Pack
                                            </button>
                                            {showBatchPackDropdown && (
                                                <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                                                    {packs.length > 0 && (
                                                        <>
                                                            <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b">
                                                                Existing Packs
                                                            </div>
                                                            {packs.map(pack => (
                                                                <button
                                                                    key={pack.id}
                                                                    onClick={() => handleBatchAddToPack(pack.id)}
                                                                    className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-gray-700 hover:bg-purple-50"
                                                                >
                                                                    <Package className="w-4 h-4" style={{ color: pack.color }} />
                                                                    <span className="truncate">{pack.name}</span>
                                                                </button>
                                                            ))}
                                                            <div className="border-t my-1" />
                                                        </>
                                                    )}
                                                    <button
                                                        onClick={handleBatchCreatePack}
                                                        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-purple-700 hover:bg-purple-50"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                        Create New Pack
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => setShowMoveModal(true)}
                                            disabled={selectedSlideIds.size === 0 || batchActionInProgress}
                                            className={clsx(
                                                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                                                selectedSlideIds.size === 0
                                                    ? "text-gray-400 cursor-not-allowed"
                                                    : "text-blue-700 bg-blue-50 hover:bg-blue-100"
                                            )}
                                        >
                                            <FolderInput className="w-4 h-4" />
                                            Move
                                        </button>
                                        <button
                                            onClick={handleBatchDelete}
                                            disabled={selectedSlideIds.size === 0 || batchActionInProgress}
                                            className={clsx(
                                                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                                                selectedSlideIds.size === 0
                                                    ? "text-gray-400 cursor-not-allowed"
                                                    : "text-red-700 bg-red-50 hover:bg-red-100"
                                            )}
                                        >
                                            {batchActionInProgress ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                            Delete
                                        </button>
                                        <div className="h-4 w-px bg-gray-300" />
                                        <button
                                            onClick={exitSelectionMode}
                                            className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                                        >
                                            <X className="w-4 h-4" />
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    // Normal toolbar
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm text-gray-500">
                                            Showing {filteredSlides.length} slide{filteredSlides.length !== 1 ? 's' : ''}
                                            {searchResults !== null && ' (search results)'}
                                        </span>
                                        <button
                                            onClick={() => setSelectionMode(true)}
                                            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                        >
                                            <CheckSquare className="w-3.5 h-3.5" />
                                            Select
                                        </button>
                                    </div>
                                )}
                                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                                    <button
                                        onClick={() => setViewMode('screenshots')}
                                        className={clsx(
                                            "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                                            viewMode === 'screenshots'
                                                ? "bg-white text-gray-900 shadow-sm"
                                                : "text-gray-600 hover:text-gray-900"
                                        )}
                                        title="Screenshot view"
                                    >
                                        <Image className="w-4 h-4" />
                                        <span className="hidden sm:inline">Screenshots</span>
                                    </button>
                                    <button
                                        onClick={() => setViewMode('content')}
                                        className={clsx(
                                            "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                                            viewMode === 'content'
                                                ? "bg-white text-gray-900 shadow-sm"
                                                : "text-gray-600 hover:text-gray-900"
                                        )}
                                        title="Content view"
                                    >
                                        <FileText className="w-4 h-4" />
                                        <span className="hidden sm:inline">Content</span>
                                    </button>
                                </div>
                            </div>
                            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                                {filteredSlides.map(slide => {
                                    const inCart = isInCart(slide.id);
                                    const isSelected = selectedSlideIds.has(slide.id);
                                    return (
                                        <div key={slide.id} className="group relative">
                                            <div onClick={() => selectionMode ? toggleSlideSelection(slide.id) : handleSlideClick(slide)}>
                                                <div className={clsx(
                                                    "bg-white border rounded-lg overflow-hidden transition-all cursor-pointer",
                                                    isSelected
                                                        ? "border-purple-500 ring-2 ring-purple-200 shadow-md"
                                                        : "hover:shadow-md hover:border-blue-300"
                                                )}>
                                                    <div className="aspect-[16/10] bg-gray-100 relative">
                                                        {/* Selection checkbox */}
                                                        {selectionMode && (
                                                            <div className="absolute top-2 left-2 z-10">
                                                                {isSelected ? (
                                                                    <CheckSquare className="w-6 h-6 text-purple-600 bg-white rounded" />
                                                                ) : (
                                                                    <Square className="w-6 h-6 text-gray-400 bg-white/80 rounded" />
                                                                )}
                                                            </div>
                                                        )}
                                                        {viewMode === 'content' ? (
                                                            // Content preview mode
                                                            <div className="w-full h-full p-2 overflow-hidden bg-white">
                                                                {slideContents.has(slide.id) ? (
                                                                    <div className="space-y-1">
                                                                        {(slideContents.get(slide.id) as ContentBlock[])?.slice(0, 3).map((block, idx) => (
                                                                            <ContentRenderer
                                                                                key={idx}
                                                                                block={block}
                                                                                conversionId={slide.sourceId}
                                                                                compact={true}
                                                                            />
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                                        <Loader2 className="w-6 h-6 animate-spin" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            // Screenshot mode
                                                            slide.screenshotUrl ? (
                                                                <img
                                                                    src={slide.screenshotUrl}
                                                                    alt={slide.title}
                                                                    className="w-full h-full object-contain"
                                                                    loading="lazy"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                                    <Library className="w-12 h-12" />
                                                                </div>
                                                            )
                                                        )}
                                                        <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded">
                                                            #{slide.sourceSlideOrder}
                                                        </div>
                                                        {slide.starred && (
                                                            <Star className="absolute top-2 right-2 w-5 h-5 text-yellow-500 fill-current" />
                                                        )}
                                                    </div>
                                                    <div className="p-3">
                                                        <h3 className="font-medium text-gray-900 truncate">
                                                            {slide.title}
                                                        </h3>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Action buttons overlay */}
                                            <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleAddToCart(slide);
                                                    }}
                                                    disabled={inCart}
                                                    className={clsx(
                                                        "p-1.5 rounded-full shadow transition-colors",
                                                        inCart
                                                            ? "bg-green-500 text-white"
                                                            : "bg-white text-gray-600 hover:bg-blue-500 hover:text-white"
                                                    )}
                                                    title={inCart ? "In cart" : "Add to cart"}
                                                >
                                                    {inCart ? <Presentation className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleFindSimilar(slide);
                                                    }}
                                                    className="p-1.5 bg-white text-gray-600 hover:bg-purple-500 hover:text-white rounded-full shadow transition-colors"
                                                    title="Find similar"
                                                >
                                                    <Sparkles className="w-4 h-4" />
                                                </button>
                                                {/* Add to pack dropdown */}
                                                {packs.length > 0 && (
                                                    <div className="relative">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setPackDropdownSlideId(packDropdownSlideId === slide.id ? null : slide.id);
                                                            }}
                                                            className={clsx(
                                                                "p-1.5 rounded-full shadow transition-colors",
                                                                packDropdownSlideId === slide.id
                                                                    ? "bg-purple-500 text-white"
                                                                    : "bg-white text-gray-600 hover:bg-purple-500 hover:text-white"
                                                            )}
                                                            title="Add to pack"
                                                        >
                                                            <Package className="w-4 h-4" />
                                                        </button>
                                                        {packDropdownSlideId === slide.id && (
                                                            <div
                                                                className="absolute left-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b">
                                                                    Add to Pack
                                                                </div>
                                                                {packs.map(pack => {
                                                                    const isInPack = pack.slideIds.includes(slide.id);
                                                                    return (
                                                                        <button
                                                                            key={pack.id}
                                                                            onClick={() => handleAddToPack(slide.id, pack.id)}
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
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </main>
            </div>

            {/* Cart button */}
            <CartButton count={cartCount} onClick={() => setCartOpen(true)} />

            {/* Cart drawer */}
            <CartDrawer
                isOpen={cartOpen}
                onClose={() => setCartOpen(false)}
                onSaveAsPack={handleSaveAsPack}
                cartVersion={cartVersion}
            />

            {/* Save pack modal */}
            <SavePackModal
                isOpen={showSavePackModal}
                onClose={() => setShowSavePackModal(false)}
                slideIds={savePackSlideIds}
                onPackCreated={handlePackCreated}
            />

            {/* Edit pack modal */}
            <EditPackModal
                isOpen={editingPack !== null}
                onClose={() => setEditingPack(null)}
                pack={editingPack}
                slides={slides}
                packFolders={packFolders}
                onPackUpdated={handlePackUpdated}
                onOpenSlidePicker={() => setShowSlidePicker(true)}
                slidesToAdd={slidesToAddToPack}
                onSlidesAdded={() => setSlidesToAddToPack([])}
            />

            {/* Slide picker modal */}
            <SlidePickerModal
                isOpen={showSlidePicker}
                onClose={() => setShowSlidePicker(false)}
                slides={slides}
                excludeSlideIds={editingPack?.slideIds || []}
                onSlidesSelected={(ids) => {
                    setSlidesToAddToPack(ids);
                    setShowSlidePicker(false);
                }}
            />

            {/* Move to collection modal */}
            <MoveToCollectionModal
                isOpen={showMoveModal}
                onClose={() => setShowMoveModal(false)}
                collections={collections}
                folders={folders}
                slideCount={selectedSlideIds.size}
                onMove={handleBatchMove}
                isMoving={batchActionInProgress}
            />

            {/* Pack folder modal */}
            <PackFolderModal
                isOpen={showPackFolderModal}
                onClose={() => {
                    setShowPackFolderModal(false);
                    setEditingPackFolder(null);
                }}
                folder={editingPackFolder}
                folders={packFolders}
                onSave={handleSavePackFolder}
            />

            {/* Similar slides panel */}
            <SimilarSlidesPanel
                slide={similarSlide}
                isOpen={showSimilarPanel}
                onClose={() => {
                    setShowSimilarPanel(false);
                    setSimilarSlide(null);
                }}
                onSlideClick={(slide) => {
                    setShowSimilarPanel(false);
                    setSimilarSlide(null);
                    setSelectedSlide(slide);
                }}
                onCartChange={() => {
                    updateCartCount();
                    setCartVersion(v => v + 1);
                }}
            />

            {/* Slide Detail Panel */}
            <SlideDetailPanel
                slide={selectedSlide}
                tags={tags}
                presentations={presentations}
                packs={packs}
                isOpen={selectedSlide !== null}
                onClose={() => setSelectedSlide(null)}
                onSlideUpdate={handleSlideUpdate}
                onSlideRemove={handleSlideRemove}
                onAddToPack={handleAddToPack}
                onFindSimilar={handleFindSimilar}
                onCreateNewPack={(slideId) => {
                    setSavePackSlideIds([slideId]);
                    setShowSavePackModal(true);
                }}
            />
        </div>
    );
};

export default SlideLibrary;
