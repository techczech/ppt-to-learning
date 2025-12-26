import React from 'react';
import { CheckCircle, Loader2, Clock, XCircle, Upload, FileText } from 'lucide-react';
import clsx from 'clsx';

export type UploadStatus = 'queued' | 'uploading' | 'processing' | 'completed' | 'failed';

export interface FileProgress {
    fileId: string;
    filename: string;
    status: UploadStatus;
    presentationId?: string;
    error?: string;
}

interface BatchUploadStatusProps {
    files: FileProgress[];
    onViewPresentation?: (presentationId: string) => void;
}

const statusConfig: Record<UploadStatus, { icon: React.ReactNode; label: string; color: string }> = {
    queued: {
        icon: <Clock className="w-4 h-4" />,
        label: 'Queued',
        color: 'text-gray-400'
    },
    uploading: {
        icon: <Upload className="w-4 h-4 animate-pulse" />,
        label: 'Uploading...',
        color: 'text-blue-500'
    },
    processing: {
        icon: <Loader2 className="w-4 h-4 animate-spin" />,
        label: 'Processing...',
        color: 'text-amber-500'
    },
    completed: {
        icon: <CheckCircle className="w-4 h-4" />,
        label: 'Completed',
        color: 'text-green-500'
    },
    failed: {
        icon: <XCircle className="w-4 h-4" />,
        label: 'Failed',
        color: 'text-red-500'
    }
};

export const BatchUploadStatus: React.FC<BatchUploadStatusProps> = ({
    files,
    onViewPresentation
}) => {
    const completedCount = files.filter(f => f.status === 'completed').length;
    const failedCount = files.filter(f => f.status === 'failed').length;
    const totalCount = files.length;
    const allDone = completedCount + failedCount === totalCount;

    return (
        <div className="space-y-4">
            {/* Progress summary */}
            <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                    {allDone ? (
                        failedCount > 0
                            ? `Completed with ${failedCount} error${failedCount > 1 ? 's' : ''}`
                            : 'All files processed successfully'
                    ) : (
                        `Processing ${completedCount} of ${totalCount} files...`
                    )}
                </span>
                <span className="font-medium text-gray-900">
                    {completedCount}/{totalCount}
                </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                    className={clsx(
                        "h-2 rounded-full transition-all duration-300",
                        failedCount > 0 ? "bg-amber-500" : "bg-green-500"
                    )}
                    style={{ width: `${((completedCount + failedCount) / totalCount) * 100}%` }}
                />
            </div>

            {/* File list */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
                {files.map((file) => {
                    const config = statusConfig[file.status];
                    return (
                        <div
                            key={file.fileId}
                            className={clsx(
                                "flex items-center justify-between p-3 rounded-lg border transition-all",
                                file.status === 'completed' ? "bg-green-50 border-green-200" :
                                file.status === 'failed' ? "bg-red-50 border-red-200" :
                                file.status === 'processing' ? "bg-amber-50 border-amber-200" :
                                file.status === 'uploading' ? "bg-blue-50 border-blue-200" :
                                "bg-gray-50 border-gray-200"
                            )}
                        >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                <span className="truncate text-sm font-medium text-gray-700">
                                    {file.filename}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className={clsx("flex items-center gap-1.5", config.color)}>
                                    {config.icon}
                                    <span className="text-sm">{config.label}</span>
                                </div>
                                {file.status === 'completed' && file.presentationId && onViewPresentation && (
                                    <button
                                        onClick={() => onViewPresentation(file.presentationId!)}
                                        className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                                    >
                                        View
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
