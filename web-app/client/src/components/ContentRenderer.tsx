import React from 'react';
import { ExternalLink, X } from 'lucide-react';
import clsx from 'clsx';
import { getMediaUrl } from '../api';

// --- Types ---

export interface SmartArtNode {
    id: string;
    text: string;
    children: SmartArtNode[];
    level: number;
    icon?: string;
    icon_alt?: string;
}

export interface ComparisonGroup {
    label: string;
    visual_cue?: string;
    items: string[];
}

export interface SequenceStep {
    step: number;
    text: string;
    detail?: string;
}

export interface ListItemData {
    text: string;
    level?: number;
    url?: string;
    children?: ListItemData[];
}

export interface ContentBlock {
    type: 'heading' | 'paragraph' | 'list' | 'image' | 'smart_art' | 'table' | 'comparison' | 'sequence' | 'text_with_visual' | 'definition' | 'link' | 'video';
    title?: string;
    text?: string;
    url?: string;
    level?: number;
    style?: string;
    items?: ListItemData[];
    src?: string;
    alt?: string;
    caption?: string;
    layout?: string;
    nodes?: SmartArtNode[];
    rows?: string[][];
    // Semantic types
    description?: string;
    groups?: ComparisonGroup[];
    steps?: SequenceStep[];
    visual_description?: string;
    relationship?: string;
    term?: string;
    definition?: string;
    examples?: string[];
}

// --- Helpers ---

export const getYouTubeId = (url: string): string | null => {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/);
    return match ? match[1] : null;
};

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

export interface ContentRendererProps {
    block: ContentBlock;
    conversionId: string;
    isEditing?: boolean;
    onUpdate?: (newBlock: ContentBlock) => void;
    onDelete?: () => void;
    shouldEmbedYouTube?: boolean;
    compact?: boolean; // For preview mode in grid
}

// Wrapper component for blocks in edit mode with delete button
const EditableBlockWrapper: React.FC<{
    isEditing: boolean;
    onDelete?: () => void;
    children: React.ReactNode;
}> = ({ isEditing, onDelete, children }) => {
    if (!isEditing || !onDelete) {
        return <>{children}</>;
    }
    return (
        <div className="relative group">
            <button
                onClick={onDelete}
                className="absolute -top-2 -right-2 z-10 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-md"
                title="Remove this block"
            >
                <X className="w-4 h-4" />
            </button>
            {children}
        </div>
    );
};

export const ContentRenderer: React.FC<ContentRendererProps> = ({
    block,
    conversionId,
    isEditing = false,
    onUpdate = () => {},
    onDelete,
    shouldEmbedYouTube = false,
    compact = false
}) => {

    if (isEditing) {
        if (block.type === 'heading' || block.type === 'paragraph') {
            return (
                <EditableBlockWrapper isEditing={isEditing} onDelete={onDelete}>
                    <textarea
                        className="w-full p-2 border rounded mb-4 font-sans text-lg"
                        value={block.text || ''}
                        onChange={(e) => onUpdate({ ...block, text: e.target.value })}
                        rows={block.type === 'heading' ? 1 : 3}
                    />
                </EditableBlockWrapper>
            );
        }
        if (block.type === 'list') {
            return (
                <EditableBlockWrapper isEditing={isEditing} onDelete={onDelete}>
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
                </EditableBlockWrapper>
            );
        }
    }

    // Compact styling for grid preview
    const textSize = compact ? 'text-sm' : 'text-lg';
    const headingSize = compact ? 'text-lg font-semibold mb-2' : 'text-3xl font-bold mb-6';
    const marginY = compact ? 'my-2' : 'my-6';
    const padding = compact ? 'p-3' : 'p-6';

    // Helper to wrap content with delete button when editing
    const wrapWithDelete = (content: React.ReactNode) => (
        <EditableBlockWrapper isEditing={isEditing} onDelete={onDelete}>
            {content}
        </EditableBlockWrapper>
    );

    switch (block.type) {
        case 'heading':
            return wrapWithDelete(<h2 className={`${headingSize} text-gray-900`}>{block.text}</h2>);
        case 'paragraph':
            return wrapWithDelete(<p className={`${textSize} text-gray-700 mb-4 leading-relaxed whitespace-pre-wrap`}>{block.text}</p>);
        case 'list': {
            // For lists, find the first YouTube URL to embed (if shouldEmbedYouTube is true)
            let embeddedYouTubeId: string | null = null;
            return wrapWithDelete(
                <ul className={clsx(`mb-4 ml-6 space-y-2 text-gray-700 ${textSize}`, block.style === 'bullet' ? 'list-disc' : 'list-decimal')}>
                    {block.items?.map((item: ListItemData, i: number) => {
                        const youtubeId = item.url ? getYouTubeId(item.url) : null;
                        // Only embed the first YouTube video in this list block (if block is marked for embedding)
                        const shouldEmbed = shouldEmbedYouTube && youtubeId && !embeddedYouTubeId && !compact;
                        if (shouldEmbed) {
                            embeddedYouTubeId = youtubeId;
                        }
                        // Convert YouTube URLs to watch format for clicking
                        const clickableUrl = youtubeId
                            ? `https://www.youtube.com/watch?v=${youtubeId}`
                            : item.url;

                        return (
                            <li key={i}>
                                {item.url ? (
                                    <a
                                        href={clickableUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                                    >
                                        {item.text}
                                        <ExternalLink className="w-3.5 h-3.5 inline-block" />
                                    </a>
                                ) : (
                                    item.text
                                )}
                                {shouldEmbed && youtubeId && (
                                    <div className="mt-3 mb-2">
                                        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                                            <iframe
                                                className="absolute inset-0 w-full h-full rounded-lg shadow-md"
                                                src={`https://www.youtube.com/embed/${youtubeId}`}
                                                title={item.text}
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                            />
                                        </div>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            );
        }
        case 'image':
            if (compact) {
                return wrapWithDelete(
                    <div className="my-2">
                        <img src={getMediaUrl(conversionId, block.src || '')} alt={block.alt} className="max-w-full h-auto rounded" />
                    </div>
                );
            }
            return wrapWithDelete(
                <div className={marginY}>
                    <img src={getMediaUrl(conversionId, block.src || '')} alt={block.alt} className="max-w-full h-auto rounded shadow-sm border border-gray-100" />
                    {block.caption && <p className="text-sm text-gray-500 mt-2 text-center">{block.caption}</p>}
                </div>
            );
        case 'smart_art':
            return wrapWithDelete(
                <div className={`${marginY} ${padding} bg-blue-50 border border-blue-200 rounded-lg shadow-inner`}>
                    <h3 className={`${compact ? 'text-sm' : 'text-md'} font-bold text-blue-800 uppercase tracking-wide mb-4 flex items-center`}>
                        <span className="bg-blue-600 text-white px-2 py-0.5 rounded mr-2 text-xs">DIAGRAM</span>
                        <span>{block.layout || 'SmartArt'}</span>
                    </h3>
                    <SmartArtTree nodes={block.nodes || []} conversionId={conversionId} />
                </div>
            );
        case 'table':
            return wrapWithDelete(
                <div className={`${marginY} overflow-x-auto rounded-lg border border-gray-200 shadow-sm`}>
                    <table className="min-w-full divide-y divide-gray-200 bg-white">
                        <tbody className="divide-y divide-gray-100">
                            {block.rows?.map((row: string[], ri: number) => (
                                <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                    {row.map((cell: string, ci: number) => (
                                        <td key={ci} className={`px-4 py-3 ${compact ? 'text-xs' : 'text-sm'} text-gray-700 border-r border-gray-100 last:border-0 whitespace-pre-wrap`}>{cell}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        case 'comparison':
            return wrapWithDelete(
                <div className={`${marginY} ${padding} bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl shadow-sm`}>
                    {block.description && (
                        <p className={`${compact ? 'text-xs' : 'text-sm'} text-indigo-700 font-medium mb-4 italic`}>{block.description}</p>
                    )}
                    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(block.groups?.length || 1, compact ? 2 : 4)}, 1fr)` }}>
                        {block.groups?.map((group, gi) => (
                            <div key={gi} className="bg-white rounded-lg p-4 shadow-sm border border-indigo-100">
                                <h4 className={`font-bold text-indigo-900 mb-1 ${compact ? 'text-sm' : ''}`}>{group.label}</h4>
                                {group.visual_cue && !compact && (
                                    <p className="text-xs text-indigo-500 mb-3 italic">{group.visual_cue}</p>
                                )}
                                <ul className="space-y-2">
                                    {group.items.slice(0, compact ? 3 : undefined).map((item, ii) => (
                                        <li key={ii} className={`text-gray-700 pl-3 border-l-2 border-indigo-300 ${compact ? 'text-xs' : ''}`}>{item}</li>
                                    ))}
                                    {compact && group.items.length > 3 && (
                                        <li className="text-xs text-indigo-400">+{group.items.length - 3} more</li>
                                    )}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            );
        case 'sequence':
            return wrapWithDelete(
                <div className={`${marginY} ${padding} bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl shadow-sm`}>
                    {block.description && (
                        <p className={`${compact ? 'text-xs' : 'text-sm'} text-emerald-700 font-medium mb-4 italic`}>{block.description}</p>
                    )}
                    <div className="space-y-3">
                        {block.steps?.slice(0, compact ? 3 : undefined).map((step, si) => (
                            <div key={si} className="flex items-start gap-4">
                                <div className={`flex-shrink-0 ${compact ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'} rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold`}>
                                    {step.step}
                                </div>
                                <div className="flex-1 pt-1">
                                    <p className={`font-medium text-gray-900 ${compact ? 'text-sm' : ''}`}>{step.text}</p>
                                    {step.detail && !compact && <p className="text-sm text-gray-600 mt-1">{step.detail}</p>}
                                </div>
                            </div>
                        ))}
                        {compact && block.steps && block.steps.length > 3 && (
                            <p className="text-xs text-emerald-600">+{block.steps.length - 3} more steps</p>
                        )}
                    </div>
                </div>
            );
        case 'text_with_visual':
            return wrapWithDelete(
                <div className={`${marginY} ${padding} bg-amber-50 border border-amber-200 rounded-xl shadow-sm`}>
                    <p className={`${textSize} text-gray-800 mb-3`}>{block.text}</p>
                    {block.visual_description && !compact && (
                        <div className="text-sm text-amber-700 bg-amber-100 rounded-lg p-3 mt-2">
                            <span className="font-semibold">Visual: </span>{block.visual_description}
                        </div>
                    )}
                    {block.relationship && !compact && (
                        <p className="text-xs text-amber-600 mt-2 italic">{block.relationship}</p>
                    )}
                </div>
            );
        case 'definition':
            return wrapWithDelete(
                <div className={`${marginY} ${padding} bg-sky-50 border border-sky-200 rounded-xl shadow-sm`}>
                    <h4 className={`font-bold text-sky-900 ${compact ? 'text-base' : 'text-xl'} mb-2`}>{block.term}</h4>
                    <p className={`text-gray-700 ${compact ? 'text-sm' : ''} mb-3`}>{block.definition}</p>
                    {block.examples && block.examples.length > 0 && !compact && (
                        <div className="mt-3 pt-3 border-t border-sky-200">
                            <span className="text-xs font-bold text-sky-600 uppercase tracking-wide">Examples:</span>
                            <ul className="mt-2 space-y-1">
                                {block.examples.map((ex, ei) => (
                                    <li key={ei} className="text-sm text-gray-600 pl-3 border-l-2 border-sky-300">{ex}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            );
        case 'link': {
            const youtubeId = block.url ? getYouTubeId(block.url) : null;
            // Convert YouTube URLs to watch format for clicking (embed URLs don't work for direct navigation)
            const clickableUrl = youtubeId
                ? `https://www.youtube.com/watch?v=${youtubeId}`
                : block.url;
            return wrapWithDelete(
                <div className="my-4">
                    <a
                        href={clickableUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-all ${compact ? 'text-sm' : ''}`}
                    >
                        <ExternalLink className="w-4 h-4" />
                        <span className="font-medium">{block.text || block.url}</span>
                    </a>
                    {shouldEmbedYouTube && youtubeId && !compact && (
                        <div className="mt-4">
                            <div className="relative w-full max-w-2xl" style={{ paddingBottom: '56.25%' }}>
                                <iframe
                                    className="absolute inset-0 w-full h-full rounded-lg shadow-lg border border-gray-200"
                                    src={`https://www.youtube.com/embed/${youtubeId}`}
                                    title={block.text || 'YouTube Video'}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            </div>
                        </div>
                    )}
                </div>
            );
        }
        case 'video':
            if (compact) {
                return wrapWithDelete(
                    <div className="my-2 text-sm text-gray-500 italic">
                        [Video: {block.title || 'Untitled'}]
                    </div>
                );
            }
            return wrapWithDelete(
                <div className={marginY}>
                    {block.title && (
                        <p className="text-sm font-medium text-gray-600 mb-2">{block.title}</p>
                    )}
                    <video
                        src={getMediaUrl(conversionId, block.src || '')}
                        controls
                        className="max-w-full h-auto rounded-lg shadow-md border border-gray-200"
                        style={{ maxHeight: '500px' }}
                    >
                        Your browser does not support the video tag.
                    </video>
                </div>
            );
        default: return null;
    }
};

export default ContentRenderer;
