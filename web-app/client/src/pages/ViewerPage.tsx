import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
    getPresentation, getLegacyPresentation, getMediaUrl, 
    savePresentation, analyzeSlide, fixWithScreenshot,
    getStoredPrompt
} from '../api';
import { 
    ChevronLeft, ChevronRight, Menu, Home, Code, Copy, 
    Check, Edit3, Save, Sparkles, Camera, Loader2, X 
} from 'lucide-react';
import clsx from 'clsx';

// --- Types ---

interface SmartArtNode {
    id: string;
    text: string;
    children: SmartArtNode[];
    level: number;
    icon?: string;
    icon_alt?: string;
}

interface ContentBlock {
    type: 'heading' | 'paragraph' | 'list' | 'image' | 'smart_art' | 'table';
    text?: string;
    level?: number;
    style?: string;
    items?: any[];
    src?: string;
    alt?: string;
    caption?: string;
    layout?: string;
    nodes?: SmartArtNode[];
    rows?: string[][];
}

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

// --- Components ---

const SmartArtTree: React.FC<{ nodes: SmartArtNode[], conversionId: string }> = ({ nodes, conversionId }) => {
    if (!nodes || nodes.length === 0) return null;
    return (
        <ul className="list-disc pl-6 space-y-2 mt-2">
            {nodes.map((node) => (
                <li key={node.id} className="text-gray-800">
                    <div className="font-medium flex items-center">
                        {node.icon && (
                            <img 
                                src={getMediaUrl(conversionId, node.icon)} 
                                alt={node.icon_alt || "Icon"} 
                                title={node.icon_alt || undefined}
                                className="w-10 h-10 mr-3 object-contain inline-block bg-white p-1 rounded border border-gray-100 shadow-sm"
                            />
                        )}
                        <span>{node.text || <span className="text-gray-400 italic">(Group)</span>}</span>
                    </div>
                    {node.children && node.children.length > 0 && (
                        <SmartArtTree nodes={node.children} conversionId={conversionId} />
                    )}
                </li>
            ))}
        </ul>
    );
};

const ContentRenderer: React.FC<{ 
    block: ContentBlock, 
    conversionId: string, 
    isEditing: boolean,
    onUpdate: (newBlock: ContentBlock) => void
}> = ({ block, conversionId, isEditing, onUpdate }) => {
    
    if (isEditing) {
        if (block.type === 'heading' || block.type === 'paragraph') {
            return (
                <textarea 
                    className="w-full p-2 border rounded mb-4 font-sans text-lg"
                    value={block.text || ''}
                    onChange={(e) => onUpdate({ ...block, text: e.target.value })}
                    rows={block.type === 'heading' ? 1 : 3}
                />
            );
        }
        if (block.type === 'list') {
            return (
                <div className="border p-4 rounded mb-4 bg-gray-50">
                    <span className="text-xs font-bold text-gray-400 uppercase">List Editor</span>
                    {block.items?.map((item, i) => (
                        <input 
                            key={i}
                            className="w-full p-1 border-b bg-transparent mb-1"
                            value={item.text}
                            onChange={(e) => {
                                const newItems = [...(block.items || [])];
                                newItems[i] = { ...item, text: e.target.value };
                                onUpdate({ ...block, items: newItems });
                            }}
                        />
                    ))}
                </div>
            );
        }
    }

    switch (block.type) {
        case 'heading':
            return <h2 className="text-3xl font-bold mb-6 text-gray-900">{block.text}</h2>;
        case 'paragraph':
            return <p className="text-lg text-gray-700 mb-4 leading-relaxed whitespace-pre-wrap">{block.text}</p>;
        case 'list':
            return (
                <ul className={clsx("mb-4 ml-6 space-y-2 text-gray-700 text-lg", block.style === 'bullet' ? 'list-disc' : 'list-decimal')}>
                    {block.items?.map((item: any, i: number) => (
                        <li key={i}>{item.text}</li>
                    ))}
                </ul>
            );
        case 'image':
            return (
                <div className="my-6">
                    <img src={getMediaUrl(conversionId, block.src || '')} alt={block.alt} className="max-w-full h-auto rounded shadow-sm border border-gray-100" />
                    {block.caption && <p className="text-sm text-gray-500 mt-2 text-center">{block.caption}</p>}
                </div>
            );
        case 'smart_art':
            return (
                <div className="my-6 p-6 bg-blue-50 border border-blue-200 rounded-lg shadow-inner">
                    <h3 className="text-md font-bold text-blue-800 uppercase tracking-wide mb-4 flex items-center">
                        <span className="bg-blue-600 text-white px-2 py-0.5 rounded mr-2 text-xs">DIAGRAM</span>
                        <span>{block.layout || 'SmartArt'}</span>
                    </h3>
                    <SmartArtTree nodes={block.nodes || []} conversionId={conversionId} />
                </div>
            );
        case 'table':
            return (
                <div className="my-6 overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200 bg-white">
                        <tbody className="divide-y divide-gray-100">
                            {block.rows?.map((row: string[], ri: number) => (
                                <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                    {row.map((cell: string, ci: number) => (
                                        <td key={ci} className="px-4 py-3 text-sm text-gray-700 border-r border-gray-100 last:border-0 whitespace-pre-wrap">{cell}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        default: return null;
    }
};

export const ViewerPage: React.FC = () => {
    const { type, id, resultId } = useParams<{ type: string, id: string, resultId: string }>();
    
    const [data, setData] = useState<Presentation | null>(null);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [viewMode, setViewMode] = useState<'slides' | 'json'>('slides');
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    
    // AI State
    const [aiPanelOpen, setAIPanelOpen] = useState(false);
    const [aiLoading, setAILoading] = useState(false);
    const [aiReport, setAIReport] = useState<string | null>(null);

    const allSlides = useMemo(() => {
        if (!data) return [];
        return data.sections.flatMap(s => s.slides);
    }, [data]);

    useEffect(() => {
        if (!type || !id) return;
        setLoading(true);
        const fetchData = async () => {
            try {
                let res = type === 'legacy' ? await getLegacyPresentation(id) : await getPresentation(id, resultId!);
                if (res) setData(res);
            } catch (err) { console.error(err); } 
            finally { setLoading(false); }
        };
        fetchData();
    }, [type, id, resultId]);

    const handleSave = async () => {
        if (!data || !id || !resultId) return;
        setSaving(true);
        try {
            await savePresentation(id, resultId, data);
            setIsEditing(false);
        } catch (e) { alert('Save failed'); } 
        finally { setSaving(false); }
    };

    const handleAIAnalyze = async () => {
        if (!currentSlide) return;
        setAILoading(true);
        try {
            const prompt = getStoredPrompt('analyze');
            const res = await analyzeSlide(currentSlide, prompt);
            setAIReport(res.report);
            setAIPanelOpen(true);
        } catch (e) { alert('AI Analysis failed'); } 
        finally { setAILoading(false); }
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
    const conversionId = type === 'legacy' ? 'legacy' : id!;

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
                    <h2 className="font-extrabold text-xl leading-tight">{data.metadata.id}</h2>
                </div>
                <div className="flex-1 overflow-y-auto py-4">
                    {data.sections.map((section, secIdx) => (
                        <div key={secIdx} className="mb-4">
                            <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-widest bg-gray-50 border-b border-gray-100">{section.title}</div>
                            {section.slides.map((slide) => {
                                const idx = allSlides.findIndex(s => s.order === slide.order);
                                return (
                                    <div key={idx} onClick={() => { setCurrentSlideIndex(idx); setViewMode('slides'); }}
                                        className={clsx("px-4 py-2.5 mx-2 rounded-md cursor-pointer mt-1 text-sm transition-all",
                                        (idx === currentSlideIndex) ? "bg-blue-600 text-white shadow-md" : "hover:bg-gray-200 text-gray-600")}>
                                        <span className="truncate block">{slide.title || `Slide ${slide.order}`}</span>
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
                    <div className="flex items-center">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="mr-6 p-2 text-gray-500"><Menu /></button>
                        <h1 className="text-lg font-bold truncate max-w-lg">{viewMode === 'json' ? 'JSON' : currentSlide?.title}</h1>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button onClick={() => setViewMode(viewMode === 'slides' ? 'json' : 'slides')} className="p-2 hover:bg-gray-100 rounded-full"><Code className="w-5 h-5"/></button>
                        
                        <button 
                            onClick={handleAIAnalyze} 
                            disabled={aiLoading}
                            className="flex items-center px-4 py-2 bg-purple-50 text-purple-700 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-purple-100 transition-all"
                        >
                            {aiLoading ? <Loader2 className="animate-spin w-4 h-4 mr-2"/> : <Sparkles className="w-4 h-4 mr-2" />}
                            AI Interpret
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
                    ) : (
                        <div className="max-w-4xl w-full bg-white shadow-xl border border-gray-200 rounded-3xl p-12 min-h-[700px] mb-12">
                            {currentSlide?.content.map((block, idx) => (
                                <ContentRenderer 
                                    key={idx} 
                                    block={block} 
                                    conversionId={conversionId} 
                                    isEditing={isEditing}
                                    onUpdate={(newBlock) => updateBlock(idx, newBlock)}
                                />
                            ))}
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
                "fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 border-l border-gray-200 flex flex-col",
                aiPanelOpen ? "translate-x-0" : "translate-x-full"
            )}>
                <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-purple-50">
                    <h3 className="font-black text-purple-800 uppercase tracking-tighter flex items-center">
                        <Sparkles className="w-5 h-5 mr-2" /> Gemini Analysis
                    </h3>
                    <button onClick={() => setAIPanelOpen(false)} className="p-1 hover:bg-purple-100 rounded-full text-purple-800"><X/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {aiReport && (
                        <div className="prose prose-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {aiReport}
                        </div>
                    )}
                    
                    <div className="pt-6 border-t border-gray-100">
                        <h4 className="text-xs font-black text-gray-400 uppercase mb-4 tracking-widest">Visual Correction</h4>
                        <p className="text-xs text-gray-500 mb-4">Upload a screenshot of the original slide to fix extraction errors.</p>
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-all">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <Camera className="w-8 h-8 text-gray-400 mb-2" />
                                <p className="text-xs text-gray-500 font-bold">Upload Screenshot</p>
                            </div>
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && handleScreenshotFix(e.target.files[0])} />
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};