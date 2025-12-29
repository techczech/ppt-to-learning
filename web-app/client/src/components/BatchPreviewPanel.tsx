import React, { useState, useMemo } from 'react';
import { X, Check, XCircle, ChevronDown, Loader2, Clock, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { ContentRenderer, type ContentBlock } from './ContentRenderer';

export interface BatchResult {
    slideOrder: number;
    slideTitle: string;
    slideIndex: number;
    originalContent: ContentBlock[];
    aiContent: ContentBlock[];
    aiTitle?: string;
    status: 'pending' | 'converting' | 'ready' | 'accepted' | 'rejected' | 'error';
    error?: string;
}

interface BatchPreviewPanelProps {
    results: BatchResult[];
    isProcessing: boolean;
    onAccept: (slideOrder: number) => void;
    onReject: (slideOrder: number) => void;
    onAcceptAll: () => void;
    onRejectAll: () => void;
    onClose: () => void;
    conversionId: string;
}

const StatusBadge: React.FC<{ status: BatchResult['status'] }> = ({ status }) => {
    const styles: Record<BatchResult['status'], { bg: string; text: string; icon: React.ReactNode }> = {
        pending: { bg: 'bg-gray-100', text: 'text-gray-500', icon: <Clock className="w-3 h-3" /> },
        converting: { bg: 'bg-blue-100', text: 'text-blue-700', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
        ready: { bg: 'bg-amber-100', text: 'text-amber-700', icon: <AlertCircle className="w-3 h-3" /> },
        accepted: { bg: 'bg-green-100', text: 'text-green-700', icon: <Check className="w-3 h-3" /> },
        rejected: { bg: 'bg-red-100', text: 'text-red-700', icon: <XCircle className="w-3 h-3" /> },
        error: { bg: 'bg-red-100', text: 'text-red-700', icon: <AlertCircle className="w-3 h-3" /> }
    };

    const style = styles[status];
    const labels: Record<BatchResult['status'], string> = {
        pending: 'Waiting',
        converting: 'Converting...',
        ready: 'Ready',
        accepted: 'Accepted',
        rejected: 'Rejected',
        error: 'Error'
    };

    return (
        <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', style.bg, style.text)}>
            {style.icon}
            {labels[status]}
        </span>
    );
};

export const BatchPreviewPanel: React.FC<BatchPreviewPanelProps> = ({
    results,
    isProcessing,
    onAccept,
    onReject,
    onAcceptAll,
    onRejectAll,
    onClose,
    conversionId
}) => {
    const [expandedSlide, setExpandedSlide] = useState<number | null>(null);

    // Stats
    const stats = useMemo(() => {
        const total = results.length;
        const completed = results.filter(r => ['ready', 'accepted', 'rejected', 'error'].includes(r.status)).length;
        const ready = results.filter(r => r.status === 'ready').length;
        const accepted = results.filter(r => r.status === 'accepted').length;
        const rejected = results.filter(r => r.status === 'rejected').length;
        const errors = results.filter(r => r.status === 'error').length;
        return { total, completed, ready, accepted, rejected, errors };
    }, [results]);

    // Auto-expand first 'ready' item
    React.useEffect(() => {
        if (expandedSlide === null) {
            const firstReady = results.find(r => r.status === 'ready');
            if (firstReady) {
                setExpandedSlide(firstReady.slideOrder);
            }
        }
    }, [results, expandedSlide]);

    const progressPercent = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

    return (
        <div className="fixed top-0 right-0 h-full w-[600px] bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-black text-indigo-800 uppercase tracking-tight flex items-center gap-2">
                        Batch Conversion
                        {isProcessing && <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-indigo-100 rounded-full text-indigo-700">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                    <div className="flex justify-between text-xs text-indigo-600 mb-1">
                        <span>{stats.completed} of {stats.total} slides processed</span>
                        <span>{Math.round(progressPercent)}%</span>
                    </div>
                    <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-indigo-600 transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>

                {/* Stats summary */}
                <div className="flex gap-3 text-xs">
                    {stats.ready > 0 && (
                        <span className="text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                            {stats.ready} ready for review
                        </span>
                    )}
                    {stats.accepted > 0 && (
                        <span className="text-green-700 bg-green-50 px-2 py-1 rounded-full">
                            {stats.accepted} accepted
                        </span>
                    )}
                    {stats.rejected > 0 && (
                        <span className="text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                            {stats.rejected} rejected
                        </span>
                    )}
                    {stats.errors > 0 && (
                        <span className="text-red-700 bg-red-50 px-2 py-1 rounded-full">
                            {stats.errors} errors
                        </span>
                    )}
                </div>

                {/* Bulk actions */}
                {stats.ready > 0 && (
                    <div className="flex gap-2 mt-3">
                        <button
                            onClick={onAcceptAll}
                            className="flex-1 px-3 py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 flex items-center justify-center gap-1"
                        >
                            <Check className="w-3 h-3" />
                            Accept All ({stats.ready})
                        </button>
                        <button
                            onClick={onRejectAll}
                            className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-300 flex items-center justify-center gap-1"
                        >
                            <XCircle className="w-3 h-3" />
                            Reject All ({stats.ready})
                        </button>
                    </div>
                )}
            </div>

            {/* Results list */}
            <div className="flex-1 overflow-y-auto">
                {results.map((result) => {
                    const isExpanded = expandedSlide === result.slideOrder;
                    const canReview = result.status === 'ready';

                    return (
                        <div
                            key={result.slideOrder}
                            className={clsx(
                                'border-b border-gray-100',
                                canReview && 'bg-amber-50/30'
                            )}
                        >
                            {/* Slide header */}
                            <button
                                onClick={() => setExpandedSlide(isExpanded ? null : result.slideOrder)}
                                className={clsx(
                                    'w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left',
                                    isExpanded && 'bg-gray-50'
                                )}
                                disabled={result.status === 'pending' || result.status === 'converting'}
                            >
                                <ChevronDown className={clsx(
                                    'w-4 h-4 text-gray-400 transition-transform',
                                    isExpanded && 'rotate-180',
                                    (result.status === 'pending' || result.status === 'converting') && 'opacity-30'
                                )} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                        Slide {result.slideOrder}: {result.slideTitle}
                                    </p>
                                </div>
                                <StatusBadge status={result.status} />
                            </button>

                            {/* Expanded preview */}
                            {isExpanded && (result.status === 'ready' || result.status === 'accepted' || result.status === 'rejected') && (
                                <div className="px-4 pb-4">
                                    {/* Error message */}
                                    {result.status === 'error' && result.error && (
                                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-3">
                                            {result.error}
                                        </div>
                                    )}

                                    {/* Side-by-side preview */}
                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                        {/* Original */}
                                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                                            <div className="bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 border-b border-gray-200">
                                                Original
                                            </div>
                                            <div className="p-2 max-h-48 overflow-y-auto bg-white">
                                                <div className="transform scale-[0.6] origin-top-left w-[166%]">
                                                    {result.originalContent.length === 0 ? (
                                                        <p className="text-gray-400 italic text-sm">No content</p>
                                                    ) : (
                                                        result.originalContent.slice(0, 5).map((block, idx) => (
                                                            <ContentRenderer
                                                                key={idx}
                                                                block={block}
                                                                conversionId={conversionId}
                                                                isEditing={false}
                                                                onUpdate={() => {}}
                                                                compact
                                                            />
                                                        ))
                                                    )}
                                                    {result.originalContent.length > 5 && (
                                                        <p className="text-xs text-gray-400 mt-2">
                                                            +{result.originalContent.length - 5} more blocks
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* AI Result */}
                                        <div className="border border-indigo-200 rounded-lg overflow-hidden">
                                            <div className="bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 border-b border-indigo-200">
                                                AI Conversion
                                                {result.aiTitle && (
                                                    <span className="ml-2 text-indigo-500">"{result.aiTitle}"</span>
                                                )}
                                            </div>
                                            <div className="p-2 max-h-48 overflow-y-auto bg-white">
                                                <div className="transform scale-[0.6] origin-top-left w-[166%]">
                                                    {result.aiContent.length === 0 ? (
                                                        <p className="text-gray-400 italic text-sm">No content generated</p>
                                                    ) : (
                                                        result.aiContent.slice(0, 5).map((block, idx) => (
                                                            <ContentRenderer
                                                                key={idx}
                                                                block={block}
                                                                conversionId={conversionId}
                                                                isEditing={false}
                                                                onUpdate={() => {}}
                                                                compact
                                                            />
                                                        ))
                                                    )}
                                                    {result.aiContent.length > 5 && (
                                                        <p className="text-xs text-gray-400 mt-2">
                                                            +{result.aiContent.length - 5} more blocks
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action buttons for ready items */}
                                    {result.status === 'ready' && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => onAccept(result.slideOrder)}
                                                className="flex-1 px-3 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 flex items-center justify-center gap-1"
                                            >
                                                <Check className="w-4 h-4" />
                                                Accept
                                            </button>
                                            <button
                                                onClick={() => onReject(result.slideOrder)}
                                                className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-300 flex items-center justify-center gap-1"
                                            >
                                                <XCircle className="w-4 h-4" />
                                                Reject
                                            </button>
                                        </div>
                                    )}

                                    {/* Status message for already processed */}
                                    {result.status === 'accepted' && (
                                        <div className="text-center text-sm text-green-700 py-2">
                                            Changes applied to slide
                                        </div>
                                    )}
                                    {result.status === 'rejected' && (
                                        <div className="text-center text-sm text-gray-500 py-2">
                                            Original content kept
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Error display (when not expanded) */}
                            {result.status === 'error' && !isExpanded && result.error && (
                                <div className="px-4 pb-3">
                                    <p className="text-xs text-red-600 truncate">{result.error}</p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer - close when all done */}
            {!isProcessing && stats.ready === 0 && (
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700"
                    >
                        Done - Close Panel
                    </button>
                </div>
            )}
        </div>
    );
};
