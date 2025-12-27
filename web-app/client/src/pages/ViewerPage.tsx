import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
    getPresentation,
    savePresentation, fixWithScreenshot,
    getStoredPrompt, semanticConvert,
    getScreenshotsStatus, generateScreenshots, getScreenshotUrl,
    getManagedPresentations
} from '../api';
import type { ScreenshotsStatus, ManagedPresentation } from '../api';
import {
    ChevronLeft, ChevronRight, Menu, Home, Code,
    Edit3, Save, Sparkles, Camera, Loader2, X, Wand2, ImageIcon,
    Eye, EyeOff, Grid, Maximize2, Search, CheckSquare,
    Square, Trash2, AlertCircle, ZoomIn, ZoomOut, Library, Download
} from 'lucide-react';
import clsx from 'clsx';
import SlidePromotionModal from '../components/SlidePromotionModal';
import { ContentRenderer, getYouTubeId, type ContentBlock } from '../components/ContentRenderer';

interface Slide {
    order: number;
    title: string;
    layout: string;
    notes: string;
    content: ContentBlock[];
}

interface SectionData {
    title: string;
    slides: Slide[];
}

interface Presentation {
    metadata: {
        id: string;
        source_file: string;
        processed_at: string;
    };
    sections: SectionData[];
}

export const ViewerPage: React.FC = () => {
    const { type, id, resultId } = useParams<{ type: string, id: string, resultId: string }>();
    const [searchParams] = useSearchParams();

    const [data, setData] = useState<Presentation | null>(null);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [initialSlideSet, setInitialSlideSet] = useState(false);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [viewMode, setViewMode] = useState<'slides' | 'json'>('slides');
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    
    // AI State
    const [aiPanelOpen, setAIPanelOpen] = useState(false);
    const [aiLoading, setAILoading] = useState(false);
    const [aiReport, setAIReport] = useState<string | null>(null);
    const [aiStatus, setAIStatus] = useState<string>('');

    // Preview state for semantic conversion
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [previewFile, setPreviewFile] = useState<File | null>(null);
    const [showPreview, setShowPreview] = useState(false);

    // Screenshot state
    const [screenshotsStatus, setScreenshotsStatus] = useState<ScreenshotsStatus | null>(null);
    const [generatingScreenshots, setGeneratingScreenshots] = useState(false);

    // Thumbnail & view state
    const [showThumbnail, setShowThumbnail] = useState(true);
    const [thumbnailModal, setThumbnailModal] = useState(false);
    const [gridView, setGridView] = useState(false);

    // Presentation info (for display name)
    const [presentationInfo, setPresentationInfo] = useState<ManagedPresentation | null>(null);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);

    // Multi-select state for grid view
    const [selectedSlides, setSelectedSlides] = useState<Set<number>>(new Set());
    const [batchProcessing, setBatchProcessing] = useState(false);
    const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
    const [batchErrors, setBatchErrors] = useState<{ slideOrder: number; error: string }[]>([]);

    // Grid zoom state (number of columns: 2, 3, 4, or 6)
    const [gridZoom, setGridZoom] = useState(3);

    // Slide promotion modal
    const [promotionModalOpen, setPromotionModalOpen] = useState(false);

    const allSlides = useMemo(() => {
        if (!data) return [];
        return data.sections.flatMap(s => s.slides);
    }, [data]);

    // Display name: use originalName without extension, fallback to metadata.id for legacy
    const displayName = useMemo(() => {
        if (presentationInfo?.originalName) {
            return presentationInfo.originalName.replace(/\.(pptx?|PPTX?)$/, '');
        }
        return data?.metadata?.id || id || 'Presentation';
    }, [presentationInfo, data, id]);

    // Search: find slides matching query
    const searchMatches = useMemo(() => {
        if (!searchQuery.trim() || !allSlides.length) return new Set<number>();
        const query = searchQuery.toLowerCase();
        const matches = new Set<number>();

        allSlides.forEach((slide, idx) => {
            // Search in title
            if (slide.title?.toLowerCase().includes(query)) {
                matches.add(idx);
                return;
            }
            // Search in notes
            if (slide.notes?.toLowerCase().includes(query)) {
                matches.add(idx);
                return;
            }
            // Search in content
            for (const block of slide.content) {
                const blockText = JSON.stringify(block).toLowerCase();
                if (blockText.includes(query)) {
                    matches.add(idx);
                    break;
                }
            }
        });

        return matches;
    }, [searchQuery, allSlides]);

    useEffect(() => {
        if (!type || !id) return;
        setLoading(true);
        const fetchData = async () => {
            try {
                let res = await getPresentation(id, resultId!);
                if (res) setData(res);
            } catch (err) { console.error(err); }
            finally { setLoading(false); }
        };
        fetchData();
    }, [type, id, resultId]);

    // Set initial slide from query param (e.g., ?slide=5)
    useEffect(() => {
        if (!allSlides.length || initialSlideSet) return;

        const slideParam = searchParams.get('slide');
        if (slideParam) {
            const slideOrder = parseInt(slideParam, 10);
            if (!isNaN(slideOrder)) {
                // Find the slide index by order number
                const idx = allSlides.findIndex(s => s.order === slideOrder);
                if (idx >= 0) {
                    setCurrentSlideIndex(idx);
                }
            }
        }
        setInitialSlideSet(true);
    }, [allSlides, searchParams, initialSlideSet]);

    // Fetch presentation info and screenshot status
    useEffect(() => {
        if (!id) return;
        const fetchInfo = async () => {
            try {
                const presentations = await getManagedPresentations();
                const info = presentations.find(p => p.id === id);
                if (info) setPresentationInfo(info);
            } catch (err) { console.error('Failed to fetch presentation info:', err); }
        };
        const fetchScreenshots = async () => {
            try {
                const status = await getScreenshotsStatus(id);
                setScreenshotsStatus(status);
            } catch (err) { console.error('Failed to fetch screenshots status:', err); }
        };
        fetchInfo();
        fetchScreenshots();
    }, [type, id]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            switch (e.key) {
                case 'ArrowLeft':
                    if (currentSlideIndex > 0) setCurrentSlideIndex(i => i - 1);
                    break;
                case 'ArrowRight':
                    if (currentSlideIndex < allSlides.length - 1) setCurrentSlideIndex(i => i + 1);
                    break;
                case 'g':
                    if (!isEditing) setGridView(v => !v);
                    break;
                case 't':
                    if (!isEditing) setShowThumbnail(v => !v);
                    break;
                case 'c':
                    if (!isEditing) setAIPanelOpen(true);
                    break;
                case 'Escape':
                    setAIPanelOpen(false);
                    setThumbnailModal(false);
                    setGridView(false);
                    setSearchOpen(false);
                    setSearchQuery('');
                    break;
                case '/':
                    if (!isEditing) {
                        e.preventDefault();
                        setSearchOpen(true);
                    }
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentSlideIndex, allSlides.length, isEditing]);

    // Multi-select helpers
    const toggleSlideSelection = (idx: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedSlides(prev => {
            const next = new Set(prev);
            if (next.has(idx)) {
                next.delete(idx);
            } else {
                next.add(idx);
            }
            return next;
        });
    };

    const selectAllSlides = () => {
        setSelectedSlides(new Set(allSlides.map((_, i) => i)));
    };

    const selectNeedingReview = () => {
        const needsReview = allSlides
            .map((slide, idx) => ({ slide, idx }))
            .filter(({ slide }) => {
                const hasSemanticContent = slide.content.some(b =>
                    ['comparison', 'sequence', 'text_with_visual', 'definition'].includes(b.type)
                );
                return !hasSemanticContent && slide.content.length > 0;
            })
            .map(({ idx }) => idx);
        setSelectedSlides(new Set(needsReview));
    };

    const clearSelection = () => {
        setSelectedSlides(new Set());
    };

    // Batch Gemini conversion
    const handleBatchConvert = async () => {
        if (selectedSlides.size === 0 || !screenshotsStatus?.hasScreenshots) return;

        setBatchProcessing(true);
        setBatchErrors([]);
        const slideIndices = Array.from(selectedSlides).sort((a, b) => a - b);
        setBatchProgress({ current: 0, total: slideIndices.length });
        const errors: { slideOrder: number; error: string }[] = [];

        for (let i = 0; i < slideIndices.length; i++) {
            const slideIdx = slideIndices[i];
            const slide = allSlides[slideIdx];
            setBatchProgress({ current: i + 1, total: slideIndices.length });

            try {
                // Fetch screenshot and convert
                const screenshotUrl = getScreenshotUrl(id!, slide.order);
                const response = await fetch(screenshotUrl);
                const blob = await response.blob();
                const file = new File([blob], `slide_${slide.order}.png`, { type: 'image/png' });

                const res = await semanticConvert(file, slide);

                // Update the slide in data
                setData(prevData => {
                    if (!prevData) return prevData;
                    const newData = { ...prevData };
                    newData.sections.forEach(sec => {
                        const idx = sec.slides.findIndex(s => s.order === slide.order);
                        if (idx !== -1) {
                            sec.slides[idx].content = res.semanticContent.content;
                            if (res.semanticContent.title) {
                                sec.slides[idx].title = res.semanticContent.title;
                            }
                        }
                    });
                    return newData;
                });
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Unknown error';
                console.error(`Failed to convert slide ${slide.order}:`, errorMsg);
                errors.push({ slideOrder: slide.order, error: errorMsg });
            }
        }

        setBatchProcessing(false);
        setBatchProgress(null);
        setBatchErrors(errors);
        setSelectedSlides(new Set());
    };

    // Delete selected slides
    const handleDeleteSlides = async () => {
        if (selectedSlides.size === 0) return;

        const confirmed = window.confirm(
            `Are you sure you want to delete ${selectedSlides.size} slide(s)? This cannot be undone.`
        );
        if (!confirmed) return;

        const slideOrders = Array.from(selectedSlides)
            .map(idx => allSlides[idx].order);

        setData(prevData => {
            if (!prevData) return prevData;
            const newData = { ...prevData };
            newData.sections = newData.sections.map(sec => ({
                ...sec,
                slides: sec.slides.filter(s => !slideOrders.includes(s.order))
            })).filter(sec => sec.slides.length > 0);
            return newData;
        });

        // Save to server
        if (data && id && resultId) {
            try {
                const newData = { ...data };
                newData.sections = newData.sections.map(sec => ({
                    ...sec,
                    slides: sec.slides.filter(s => !slideOrders.includes(s.order))
                })).filter(sec => sec.slides.length > 0);
                await savePresentation(id, resultId, newData);
            } catch (err) {
                console.error('Failed to save after delete:', err);
            }
        }

        setSelectedSlides(new Set());
        setCurrentSlideIndex(0);
    };

    const handleGenerateScreenshots = async () => {
        if (!id) return;
        setGeneratingScreenshots(true);
        try {
            await generateScreenshots(id);
            // Poll for completion
            const pollInterval = setInterval(async () => {
                const status = await getScreenshotsStatus(id);
                setScreenshotsStatus(status);
                if (status.hasScreenshots) {
                    clearInterval(pollInterval);
                    setGeneratingScreenshots(false);
                }
            }, 2000);
            // Stop polling after 10 minutes max
            setTimeout(() => {
                clearInterval(pollInterval);
                setGeneratingScreenshots(false);
            }, 600000);
        } catch (e) {
            alert('Failed to start screenshot generation');
            setGeneratingScreenshots(false);
        }
    };

    const handleSave = async () => {
        if (!data || !id || !resultId) return;
        setSaving(true);
        try {
            await savePresentation(id, resultId, data);
            setIsEditing(false);
        } catch (e) { alert('Save failed'); } 
        finally { setSaving(false); }
    };

    const handleScreenshotFix = async (file: File) => {
        if (!currentSlide) return;
        setAILoading(true);
        try {
            const prompt = getStoredPrompt('fix');
            const res = await fixWithScreenshot(file, currentSlide, prompt);
            const newData = { ...data! };
            let found = false;
            newData.sections.forEach(sec => {
                const idx = sec.slides.findIndex(s => s.order === currentSlide.order);
                if (idx !== -1) {
                    sec.slides[idx].content = res.suggestedContent;
                    found = true;
                }
            });
            if (found) {
                setData(newData);
                setAIReport("Slide content updated based on screenshot! Review and save changes.");
                setAIPanelOpen(true);
            }
        } catch (e) { alert('Screenshot fix failed'); }
        finally { setAILoading(false); }
    };

    // Step 1: Show preview when file is selected
    const handleFileSelect = (file: File) => {
        if (!currentSlide) return;

        // Create preview URL for the image
        const imageUrl = URL.createObjectURL(file);
        setPreviewImage(imageUrl);
        setPreviewFile(file);
        setShowPreview(true);
        setAIPanelOpen(true);
        setAIReport(null);
        setAIStatus('');
    };

    // Step 2: Actually run the conversion after user confirms
    const handleSemanticConvert = async () => {
        if (!currentSlide || (!previewFile && !previewImage)) return;

        setAILoading(true);
        setAIStatus('Preparing image...');

        try {
            let fileToSend: File;

            if (previewFile) {
                // Use uploaded file directly
                fileToSend = previewFile;
            } else if (previewImage) {
                // Fetch from URL (pre-generated screenshot)
                setAIStatus('Loading screenshot...');
                const response = await fetch(previewImage);
                const blob = await response.blob();
                fileToSend = new File([blob], 'screenshot.png', { type: 'image/png' });
            } else {
                throw new Error('No image available');
            }

            setAIStatus('Sending to Gemini API...');
            const res = await semanticConvert(fileToSend, currentSlide);

            setAIStatus('Processing response...');
            const newData = { ...data! };
            let found = false;
            newData.sections.forEach(sec => {
                const idx = sec.slides.findIndex(s => s.order === currentSlide.order);
                if (idx !== -1) {
                    // Replace content with semantic version
                    sec.slides[idx].content = res.semanticContent.content;
                    // Update title if provided
                    if (res.semanticContent.title) {
                        sec.slides[idx].title = res.semanticContent.title;
                    }
                    found = true;
                }
            });

            if (found) {
                setData(newData);
                const summary = res.semanticContent.summary || 'Content converted to semantic format.';
                const semanticType = res.semanticContent.semantic_type || 'mixed';
                setAIReport(`**Semantic Conversion Complete**\n\nType: ${semanticType}\n\n${summary}\n\nReview the converted content and save if satisfied.`);
                setShowPreview(false);
                setPreviewImage(null);
                setPreviewFile(null);
            }
        } catch (e: any) {
            setAIReport(`**Error:** ${e.message || 'Unknown error'}\n\nTry selecting a different model in Settings.`);
        }
        finally {
            setAILoading(false);
            setAIStatus('');
        }
    };

    const cancelPreview = () => {
        setShowPreview(false);
        setPreviewImage(null);
        setPreviewFile(null);
        setAIReport(null);
    };

    const updateBlock = (index: number, newBlock: ContentBlock) => {
        if (!data) return;
        const newData = { ...data };
        newData.sections.forEach(sec => {
            const slide = sec.slides.find(s => s.order === currentSlide.order);
            if (slide) {
                slide.content[index] = newBlock;
            }
        });
        setData(newData);
    };

    if (loading) return <div className="p-10 flex items-center justify-center h-screen text-gray-400">Loading...</div>;
    if (!data) return <div className="p-10 text-red-500">Failed to load content.</div>;

    const currentSlide = allSlides[currentSlideIndex];
    const conversionId = id!;

    return (
        <div className="flex h-screen bg-white overflow-hidden text-gray-900">
            {/* Sidebar */}
            <div className={clsx(
                "bg-gray-50 border-r border-gray-200 flex flex-col transition-all duration-300 shadow-xl z-30",
                sidebarOpen ? "w-80" : "w-0 -translate-x-full opacity-0"
            )}>
                <div className="p-6 border-b border-gray-200 bg-white">
                    <Link to="/" className="inline-flex items-center text-xs font-bold text-blue-600 mb-4 uppercase tracking-widest">
                        <Home className="w-3.5 h-3.5 mr-1.5" /> Library
                    </Link>
                    <h2 className="font-extrabold text-xl leading-tight">{displayName}</h2>
                </div>
                <div className="flex-1 overflow-y-auto py-4">
                    {data.sections.map((section, secIdx) => (
                        <div key={secIdx} className="mb-4">
                            <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-widest bg-gray-50 border-b border-gray-100">{section.title}</div>
                            {section.slides.map((slide) => {
                                const idx = allSlides.findIndex(s => s.order === slide.order);
                                const isMatch = searchMatches.has(idx);
                                const isCurrent = idx === currentSlideIndex;
                                return (
                                    <div key={idx} onClick={() => { setCurrentSlideIndex(idx); setViewMode('slides'); }}
                                        className={clsx(
                                            "px-4 py-2.5 mx-2 rounded-md cursor-pointer mt-1 text-sm transition-all",
                                            isCurrent ? "bg-blue-600 text-white shadow-md" :
                                            isMatch ? "bg-yellow-100 text-yellow-800 ring-1 ring-yellow-300" :
                                            "hover:bg-gray-200 text-gray-600"
                                        )}>
                                        <span className="truncate block flex items-center gap-2">
                                            {isMatch && !isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 flex-shrink-0" />}
                                            {slide.title || `Slide ${slide.order}`}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Main */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                <div className="h-16 border-b border-gray-200 flex items-center justify-between px-8 bg-white/80 backdrop-blur-md z-20">
                    <div className="flex items-center flex-1 min-w-0">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="mr-4 p-2 text-gray-500 flex-shrink-0"><Menu /></button>
                        {searchOpen ? (
                            <div className="flex items-center gap-2 flex-1 max-w-md">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search slides..."
                                        className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                        autoFocus
                                    />
                                </div>
                                {searchQuery && (
                                    <span className="text-xs text-gray-500 whitespace-nowrap">
                                        {searchMatches.size} match{searchMatches.size !== 1 ? 'es' : ''}
                                    </span>
                                )}
                                <button
                                    onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                                    className="p-1 text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <>
                                <h1 className="text-lg font-bold truncate max-w-lg">{viewMode === 'json' ? 'JSON' : displayName}</h1>
                                <button
                                    onClick={() => setSearchOpen(true)}
                                    className="ml-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                                    title="Search (press /)"
                                >
                                    <Search className="w-4 h-4" />
                                </button>
                            </>
                        )}
                    </div>
                    <div className="flex items-center space-x-3">
                        {/* View toggles */}
                        <button
                            onClick={() => setGridView(!gridView)}
                            className={clsx("p-2 rounded-full", gridView ? "bg-indigo-100 text-indigo-700" : "hover:bg-gray-100")}
                            title="Grid view (g)"
                        >
                            <Grid className="w-5 h-5"/>
                        </button>
                        <button
                            onClick={() => setShowThumbnail(!showThumbnail)}
                            className={clsx("p-2 rounded-full", showThumbnail ? "bg-indigo-100 text-indigo-700" : "hover:bg-gray-100")}
                            title="Toggle thumbnail (t)"
                        >
                            {showThumbnail ? <Eye className="w-5 h-5"/> : <EyeOff className="w-5 h-5"/>}
                        </button>
                        <button onClick={() => setViewMode(viewMode === 'slides' ? 'json' : 'slides')} className="p-2 hover:bg-gray-100 rounded-full" title="JSON view"><Code className="w-5 h-5"/></button>
                        <a
                            href={`/api/presentations/${id}/export`}
                            className="p-2 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded-full"
                            title="Export as ZIP"
                        >
                            <Download className="w-5 h-5"/>
                        </a>

                        <div className="h-6 w-px bg-gray-200" />

                        <button
                            onClick={() => setPromotionModalOpen(true)}
                            className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md"
                            title="Add slides to your library"
                        >
                            <Library className="w-4 h-4 mr-2" />
                            Promote
                        </button>

                        <button
                            onClick={() => setAIPanelOpen(true)}
                            disabled={aiLoading}
                            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md"
                        >
                            {aiLoading ? <Loader2 className="animate-spin w-4 h-4 mr-2"/> : <Wand2 className="w-4 h-4 mr-2" />}
                            Fix with Gemini
                        </button>

                        <div className="h-6 w-px bg-gray-200 mx-2" />

                        {isEditing ? (
                            <button onClick={handleSave} disabled={saving} className="flex items-center px-4 py-2 bg-green-600 text-white rounded-full text-xs font-bold uppercase tracking-widest shadow-lg hover:bg-green-700">
                                {saving ? <Loader2 className="animate-spin w-4 h-4 mr-2"/> : <Save className="w-4 h-4 mr-2" />}
                                Save Changes
                            </button>
                        ) : (
                            <button onClick={() => setIsEditing(true)} className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-gray-200">
                                <Edit3 className="w-4 h-4 mr-2" /> Edit Slide
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-12 bg-gray-50/50 flex justify-center">
                    {viewMode === 'json' ? (
                        <pre className="bg-gray-900 text-green-400 p-8 rounded-2xl overflow-auto text-sm font-mono w-full max-w-5xl h-fit shadow-2xl border border-gray-800">
                            {JSON.stringify(data, null, 2)}
                        </pre>
                    ) : gridView ? (
                        /* Grid View with Batch Actions */
                        <div className="w-full max-w-7xl">
                            {/* Batch Action Toolbar */}
                            <div className="mb-4 p-3 bg-white rounded-xl border border-gray-200 shadow-sm flex items-center gap-3 flex-wrap">
                                <button
                                    onClick={selectAllSlides}
                                    className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                                >
                                    Select All
                                </button>
                                <button
                                    onClick={selectNeedingReview}
                                    className="px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg flex items-center gap-1.5"
                                >
                                    <AlertCircle className="w-4 h-4" />
                                    Select Needing Review
                                </button>
                                {selectedSlides.size > 0 && (
                                    <>
                                        <div className="h-6 w-px bg-gray-200" />
                                        <span className="text-sm text-gray-500 font-medium">
                                            {selectedSlides.size} selected
                                        </span>
                                        <button
                                            onClick={handleBatchConvert}
                                            disabled={batchProcessing || !screenshotsStatus?.hasScreenshots}
                                            className="px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                                        >
                                            {batchProcessing ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Converting {batchProgress?.current}/{batchProgress?.total}...
                                                </>
                                            ) : (
                                                <>
                                                    <Wand2 className="w-4 h-4" />
                                                    Convert with Gemini
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={handleDeleteSlides}
                                            disabled={batchProcessing}
                                            className="px-3 py-1.5 text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Delete
                                        </button>
                                        <button
                                            onClick={clearSelection}
                                            className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 rounded-lg"
                                        >
                                            Clear
                                        </button>
                                    </>
                                )}
                                {!screenshotsStatus?.hasScreenshots && selectedSlides.size > 0 && (
                                    <span className="text-xs text-amber-600">
                                        Generate screenshots to enable batch conversion
                                    </span>
                                )}

                                {/* Batch error display */}
                                {batchErrors.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-red-600">
                                            {batchErrors.length} slide{batchErrors.length > 1 ? 's' : ''} failed
                                            {batchErrors.some(e => e.error.includes('timed out')) && ' (timeout)'}
                                        </span>
                                        <button
                                            onClick={() => setBatchErrors([])}
                                            className="text-xs text-gray-400 hover:text-gray-600"
                                        >
                                            Dismiss
                                        </button>
                                    </div>
                                )}

                                {/* Zoom controls */}
                                <div className="ml-auto flex items-center gap-2 border-l border-gray-200 pl-3">
                                    <span className="text-xs text-gray-500">Zoom:</span>
                                    <button
                                        onClick={() => setGridZoom(z => Math.max(2, z - 1))}
                                        disabled={gridZoom <= 2}
                                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30"
                                        title="Larger thumbnails"
                                    >
                                        <ZoomIn className="w-4 h-4" />
                                    </button>
                                    <span className="text-xs font-mono text-gray-500 w-4 text-center">{gridZoom}</span>
                                    <button
                                        onClick={() => setGridZoom(z => Math.min(6, z + 1))}
                                        disabled={gridZoom >= 6}
                                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30"
                                        title="Smaller thumbnails"
                                    >
                                        <ZoomOut className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Grid of Slides - dynamic columns based on zoom */}
                            <div className={clsx(
                                "grid gap-4",
                                gridZoom === 2 && "grid-cols-2",
                                gridZoom === 3 && "grid-cols-3",
                                gridZoom === 4 && "grid-cols-4",
                                gridZoom === 5 && "grid-cols-5",
                                gridZoom === 6 && "grid-cols-6"
                            )}>
                                {allSlides.map((slide, idx) => {
                                    const hasScreenshot = screenshotsStatus?.hasScreenshots;
                                    const hasSemanticContent = slide.content.some(b =>
                                        ['comparison', 'sequence', 'text_with_visual', 'definition'].includes(b.type)
                                    );
                                    const needsReview = !hasSemanticContent && slide.content.length > 0;
                                    const isSelected = selectedSlides.has(idx);

                                    return (
                                        <div
                                            key={idx}
                                            className={clsx(
                                                "relative bg-white rounded-xl border-2 transition-all overflow-hidden",
                                                isSelected ? "border-indigo-500 ring-2 ring-indigo-200 shadow-md" :
                                                idx === currentSlideIndex ? "border-blue-400 shadow-md" :
                                                "border-gray-200 hover:border-gray-300 hover:shadow-lg"
                                            )}
                                        >
                                            {/* Checkbox */}
                                            <button
                                                onClick={(e) => toggleSlideSelection(idx, e)}
                                                className="absolute top-2 left-2 z-10 p-1 bg-white/90 rounded-md shadow-sm hover:bg-white"
                                            >
                                                {isSelected ? (
                                                    <CheckSquare className="w-5 h-5 text-indigo-600" />
                                                ) : (
                                                    <Square className="w-5 h-5 text-gray-400" />
                                                )}
                                            </button>

                                            {/* Warning badge */}
                                            {needsReview && (
                                                <div className="absolute top-2 right-2 z-10 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm" title="Needs semantic conversion">
                                                    ⚠
                                                </div>
                                            )}

                                            {/* Side-by-side content */}
                                            <div
                                                className="grid grid-cols-2 gap-0.5 bg-gray-200 cursor-pointer"
                                                onClick={() => { setCurrentSlideIndex(idx); setGridView(false); }}
                                            >
                                                {/* Left: Screenshot */}
                                                <div className="aspect-[16/9] bg-gray-100">
                                                    {hasScreenshot ? (
                                                        <img
                                                            src={getScreenshotUrl(id!, slide.order)}
                                                            alt={`Slide ${slide.order}`}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="flex items-center justify-center h-full text-gray-400 bg-gray-50">
                                                            <span className="text-2xl font-bold">{slide.order}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Right: Scaled full content render */}
                                                <div className="aspect-[16/9] bg-white overflow-hidden relative">
                                                    <div
                                                        className="absolute top-0 left-0 p-4 origin-top-left pointer-events-none"
                                                        style={{
                                                            transform: 'scale(0.12)',
                                                            width: '833%',
                                                            minHeight: '833%'
                                                        }}
                                                    >
                                                        {slide.content.length === 0 ? (
                                                            <div className="text-gray-400 italic text-lg">No content</div>
                                                        ) : (
                                                            slide.content.map((block, bi) => (
                                                                <ContentRenderer
                                                                    key={bi}
                                                                    block={block}
                                                                    conversionId={conversionId}
                                                                    isEditing={false}
                                                                    onUpdate={() => {}}
                                                                    shouldEmbedYouTube={false}
                                                                />
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Title */}
                                            <div className="p-2 bg-white border-t border-gray-100">
                                                <p className="text-xs font-medium text-gray-700 truncate">{slide.title || `Slide ${slide.order}`}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        /* Normal Slide View */
                        <div className="max-w-4xl w-full bg-white shadow-xl border border-gray-200 rounded-3xl p-12 min-h-[700px] mb-12 relative">
                            {/* Screenshot Thumbnail */}
                            {showThumbnail && screenshotsStatus?.hasScreenshots && (
                                <div className="absolute top-6 right-6 z-10">
                                    <div
                                        className="relative group cursor-pointer"
                                        onClick={() => setThumbnailModal(true)}
                                    >
                                        <img
                                            src={getScreenshotUrl(id!, currentSlide.order)}
                                            alt="Slide screenshot"
                                            className="w-48 h-auto rounded-lg shadow-lg border border-gray-200 transition-transform group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-all flex items-center justify-center">
                                            <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Slide Content */}
                            <div className={clsx(showThumbnail && screenshotsStatus?.hasScreenshots && "pr-52")}>
                                {(() => {
                                    // Pre-compute which block indices should show YouTube embeds
                                    // This avoids mutation during render (which breaks in React StrictMode)
                                    const seenYouTubeIds = new Set<string>();
                                    const embedIndices = new Set<number>();

                                    currentSlide?.content.forEach((block, idx) => {
                                        if (block.type === 'link' && block.url) {
                                            const ytId = getYouTubeId(block.url);
                                            if (ytId && !seenYouTubeIds.has(ytId)) {
                                                seenYouTubeIds.add(ytId);
                                                embedIndices.add(idx);
                                            }
                                        }
                                        // Also check list items for YouTube URLs
                                        if (block.type === 'list' && block.items) {
                                            for (const item of block.items) {
                                                if (item.url) {
                                                    const ytId = getYouTubeId(item.url);
                                                    if (ytId && !seenYouTubeIds.has(ytId)) {
                                                        seenYouTubeIds.add(ytId);
                                                        embedIndices.add(idx);
                                                        break; // Only need to mark the block once
                                                    }
                                                }
                                            }
                                        }
                                    });

                                    return currentSlide?.content.map((block, idx) => (
                                        <ContentRenderer
                                            key={idx}
                                            block={block}
                                            conversionId={conversionId}
                                            isEditing={isEditing}
                                            onUpdate={(newBlock) => updateBlock(idx, newBlock)}
                                            shouldEmbedYouTube={embedIndices.has(idx)}
                                        />
                                    ));
                                })()}
                            </div>
                            {currentSlide?.notes && (
                                <div className="mt-16 pt-8 border-t border-gray-100 text-sm text-gray-500 italic leading-relaxed">
                                    {currentSlide.notes}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Navigation Pager */}
                {viewMode === 'slides' && (
                    <div className="absolute bottom-8 right-8 flex items-center bg-white shadow-2xl rounded-full p-2 border border-gray-200 z-40">
                        <button onClick={() => setCurrentSlideIndex(i => i-1)} disabled={currentSlideIndex === 0} className="p-3 hover:bg-gray-100 rounded-full disabled:opacity-20"><ChevronLeft/></button>
                        <span className="px-4 font-bold text-sm">{currentSlideIndex + 1} / {allSlides.length}</span>
                        <button onClick={() => setCurrentSlideIndex(i => i+1)} disabled={currentSlideIndex === allSlides.length-1} className="p-3 hover:bg-gray-100 rounded-full disabled:opacity-20"><ChevronRight/></button>
                    </div>
                )}
            </div>

            {/* AI Sidebar Panel */}
            <div className={clsx(
                "fixed top-0 right-0 h-full w-[480px] bg-white shadow-2xl z-50 transform transition-transform duration-300 border-l border-gray-200 flex flex-col",
                aiPanelOpen ? "translate-x-0" : "translate-x-full"
            )}>
                <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-purple-50">
                    <h3 className="font-black text-purple-800 uppercase tracking-tighter flex items-center">
                        <Sparkles className="w-5 h-5 mr-2" /> AI Tools
                        <span className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-green-500 text-white rounded-full">v2</span>
                    </h3>
                    <button onClick={() => { setAIPanelOpen(false); cancelPreview(); }} className="p-1 hover:bg-purple-100 rounded-full text-purple-800"><X/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Status indicator */}
                    {aiStatus && (
                        <div className="flex items-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <Loader2 className="w-4 h-4 text-blue-600 animate-spin mr-3" />
                            <span className="text-sm text-blue-700 font-medium">{aiStatus}</span>
                        </div>
                    )}

                    {/* Report/Result */}
                    {aiReport && !showPreview && (
                        <div className="prose prose-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 p-4 rounded-lg">
                            {aiReport}
                        </div>
                    )}

                    {/* Preview Mode - Show image and prompt before sending */}
                    {showPreview && previewImage && (
                        <div className="space-y-4">
                            <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl">
                                <h4 className="text-sm font-black text-indigo-800 uppercase mb-3 tracking-wide">Preview</h4>

                                {/* Image Preview */}
                                <div className="mb-4">
                                    <p className="text-xs text-gray-500 mb-2 font-medium">Screenshot to convert:</p>
                                    <img
                                        src={previewImage}
                                        alt="Screenshot preview"
                                        className="w-full rounded-lg border border-gray-200 shadow-sm"
                                    />
                                </div>

                                {/* Current Slide Data Preview */}
                                <div className="mb-4">
                                    <p className="text-xs text-gray-500 mb-2 font-medium">Current slide data (will be sent as context):</p>
                                    <pre className="text-[10px] bg-gray-900 text-green-400 p-3 rounded-lg overflow-auto max-h-32 font-mono">
                                        {JSON.stringify(currentSlide, null, 2)}
                                    </pre>
                                </div>

                                {/* Error display */}
                                {aiReport && (
                                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                        <p className="text-sm text-red-700 whitespace-pre-wrap">{aiReport}</p>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={cancelPreview}
                                        disabled={aiLoading}
                                        className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-300 transition-all disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSemanticConvert}
                                        disabled={aiLoading}
                                        className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg disabled:opacity-50 flex items-center justify-center"
                                    >
                                        {aiLoading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                Converting...
                                            </>
                                        ) : (
                                            <>
                                                <Wand2 className="w-4 h-4 mr-2" />
                                                Convert Now
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Upload UI - Only show when not in preview mode */}
                    {!showPreview && (
                        <>
                            {/* Semantic Conversion - Primary Action */}
                            <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl">
                                <h4 className="text-sm font-black text-indigo-800 uppercase mb-2 tracking-wide flex items-center">
                                    <Wand2 className="w-4 h-4 mr-2" /> Semantic Conversion
                                </h4>
                                <p className="text-xs text-indigo-600 mb-4">
                                    Convert this slide into semantic learning content.
                                    The AI will understand visual layout and create structured content (comparisons, sequences, etc.)
                                </p>

                                {/* Screenshot Status & Actions */}
                                <div className="mb-4 p-3 bg-white rounded-lg border border-indigo-100">
                                        {screenshotsStatus?.hasScreenshots ? (
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center text-green-700">
                                                    <ImageIcon className="w-4 h-4 mr-2" />
                                                    <span className="text-xs font-medium">{screenshotsStatus.count} screenshots available</span>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const url = getScreenshotUrl(id!, currentSlide.order);
                                                        setPreviewImage(url);
                                                        setPreviewFile(null); // Will fetch from URL
                                                        setShowPreview(true);
                                                    }}
                                                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700"
                                                >
                                                    Use Screenshot
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-gray-500">No screenshots generated</span>
                                                <button
                                                    onClick={handleGenerateScreenshots}
                                                    disabled={generatingScreenshots}
                                                    className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center"
                                                >
                                                    {generatingScreenshots ? (
                                                        <>
                                                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                            Generating...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ImageIcon className="w-3 h-3 mr-1" />
                                                            Generate All
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                </div>

                                {/* Manual Upload Fallback */}
                                <label className={clsx(
                                    "flex flex-col items-center justify-center w-full h-20 border-2 border-dashed rounded-xl cursor-pointer transition-all",
                                    aiLoading ? "border-gray-300 bg-gray-50" : "border-indigo-300 hover:border-indigo-500 hover:bg-indigo-100"
                                )}>
                                    <div className="flex flex-col items-center justify-center py-3">
                                        <Camera className="w-5 h-5 text-indigo-500 mb-1" />
                                        <p className="text-xs text-indigo-700 font-medium">
                                            Or upload screenshot manually
                                        </p>
                                    </div>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        disabled={aiLoading}
                                        onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
                                    />
                                </label>
                            </div>

                            {/* Visual Correction - Secondary Action */}
                            <div className="pt-4 border-t border-gray-100">
                                <h4 className="text-xs font-black text-gray-400 uppercase mb-3 tracking-widest">Quick Fix (OCR Correction)</h4>
                                <p className="text-xs text-gray-500 mb-3">Fix minor extraction errors without changing structure.</p>
                                <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-all">
                                    <div className="flex flex-col items-center justify-center py-3">
                                        <Camera className="w-5 h-5 text-gray-400 mb-1" />
                                        <p className="text-xs text-gray-500 font-medium">Upload for Quick Fix</p>
                                    </div>
                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && handleScreenshotFix(e.target.files[0])} />
                                </label>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Thumbnail Modal */}
            {thumbnailModal && screenshotsStatus?.hasScreenshots && (
                <div
                    className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-8"
                    onClick={() => setThumbnailModal(false)}
                >
                    <div className="relative max-w-5xl w-full">
                        <button
                            onClick={() => setThumbnailModal(false)}
                            className="absolute -top-12 right-0 p-2 text-white hover:bg-white/20 rounded-full"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <img
                            src={getScreenshotUrl(id!, currentSlide.order)}
                            alt="Slide screenshot"
                            className="w-full h-auto rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <div className="text-center mt-4 text-white text-sm">
                            Slide {currentSlide.order}: {currentSlide.title || 'Untitled'}
                        </div>
                    </div>
                </div>
            )}

            {/* Slide Promotion Modal */}
            <SlidePromotionModal
                isOpen={promotionModalOpen}
                onClose={() => setPromotionModalOpen(false)}
                presentationId={id!}
                presentationName={displayName}
                onPromoted={() => {
                    // Optionally refresh or show a notification
                    console.log('Slides promoted to library');
                }}
            />
        </div>
    );
};