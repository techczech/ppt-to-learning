import React, { useState } from 'react';
import { Upload, Loader2, ImageIcon, FileText, X, Check } from 'lucide-react';
import { uploadFile, uploadFiles } from '../api';
import type { BatchUploadProgress } from '../api';
import { useNavigate } from 'react-router-dom';
import { BatchUploadStatus } from './BatchUploadStatus';
import type { FileProgress } from './BatchUploadStatus';

interface FileUploadProps {
    collectionId?: string | null;
    folderId?: string | null;
    onUploadComplete?: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({
    collectionId,
    folderId,
    onUploadComplete
}) => {
    const [dragging, setDragging] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<BatchUploadProgress[]>([]);
    const [generateScreenshots, setGenerateScreenshots] = useState(false);
    const navigate = useNavigate();

    const filterValidFiles = (files: FileList | File[]): File[] => {
        return Array.from(files).filter(
            f => f.name.endsWith('.pptx') || f.name.endsWith('.ppt')
        );
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const validFiles = filterValidFiles(e.dataTransfer.files);
        if (validFiles.length > 0) {
            setSelectedFiles(prev => [...prev, ...validFiles]);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const validFiles = filterValidFiles(e.target.files);
            setSelectedFiles(prev => [...prev, ...validFiles]);
        }
        // Reset input so same file can be selected again
        e.target.value = '';
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const clearFiles = () => {
        setSelectedFiles([]);
    };

    const handleUpload = async () => {
        if (selectedFiles.length === 0) return;

        setUploading(true);

        // Single file - use simple flow
        if (selectedFiles.length === 1) {
            try {
                const res = await uploadFile(selectedFiles[0], {
                    generateScreenshots,
                    collectionId,
                    folderId
                });
                onUploadComplete?.();
                navigate(`/status/${res.id}`);
            } catch (e) {
                console.error(e);
                alert('Upload failed');
                setUploading(false);
            }
            return;
        }

        // Multiple files - use batch flow
        try {
            const result = await uploadFiles(
                selectedFiles,
                { generateScreenshots, collectionId, folderId },
                (progress) => {
                    setUploadProgress([...progress]);
                }
            );

            onUploadComplete?.();

            // Navigate to batch status page with IDs
            const params = new URLSearchParams();
            params.set('ids', result.ids.join(','));
            params.set('names', result.filenames.map(encodeURIComponent).join(','));
            navigate(`/batch-status?${params.toString()}`);
        } catch (e) {
            console.error(e);
            alert('Upload failed');
            setUploading(false);
        }
    };

    // Convert progress to FileProgress format for BatchUploadStatus
    const fileProgress: FileProgress[] = uploadProgress.map(p => ({
        fileId: p.fileId,
        filename: p.filename,
        status: p.status,
        presentationId: p.presentationId
    }));

    // Uploading state with progress
    if (uploading && uploadProgress.length > 0) {
        return (
            <div className="border-2 border-dashed border-blue-300 bg-blue-50 rounded-lg p-6">
                <BatchUploadStatus files={fileProgress} />
            </div>
        );
    }

    // Simple uploading state (single file)
    if (uploading) {
        return (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                <div className="flex flex-col items-center text-gray-500">
                    <Loader2 className="w-12 h-12 animate-spin mb-4" />
                    <p>Uploading and starting conversion...</p>
                </div>
            </div>
        );
    }

    // Files selected - show file list
    if (selectedFiles.length > 0) {
        return (
            <div className="border-2 border-dashed border-blue-300 bg-blue-50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-gray-900">
                        {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
                    </h3>
                    <button
                        onClick={clearFiles}
                        className="text-sm text-gray-500 hover:text-gray-700"
                    >
                        Clear all
                    </button>
                </div>

                {/* File list */}
                <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                    {selectedFiles.map((file, index) => (
                        <div
                            key={`${file.name}-${index}`}
                            className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-200"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <span className="text-sm truncate">{file.name}</span>
                            </div>
                            <button
                                onClick={() => removeFile(index)}
                                className="p-1 text-gray-400 hover:text-red-500"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Add more files */}
                <label className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 cursor-pointer mb-4">
                    <Upload className="w-4 h-4" />
                    Add more files
                    <input
                        type="file"
                        multiple
                        className="hidden"
                        accept=".pptx,.ppt"
                        onChange={handleFileSelect}
                    />
                </label>

                {/* Screenshot option */}
                <label className="flex items-center gap-2 mb-4 cursor-pointer select-none text-gray-600">
                    <input
                        type="checkbox"
                        checked={generateScreenshots}
                        onChange={(e) => setGenerateScreenshots(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="flex items-center gap-1.5 text-sm">
                        <ImageIcon className="w-4 h-4" />
                        Generate screenshots
                    </span>
                    <span className="text-xs text-gray-400">(slower)</span>
                </label>

                {/* Upload button */}
                <button
                    onClick={handleUpload}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium"
                >
                    <Check className="w-5 h-5" />
                    Upload {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}
                </button>
            </div>
        );
    }

    // Empty state - drop zone
    return (
        <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors
                ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
            `}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
        >
            <div className="flex flex-col items-center text-gray-500">
                <Upload className="w-12 h-12 mb-4" />
                <p className="text-lg font-medium mb-2">Drop your presentations here</p>
                <p className="text-sm mb-4">Supports .pptx (multiple files)</p>

                <label className="btn btn-primary cursor-pointer bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition">
                    Browse Files
                    <input
                        type="file"
                        multiple
                        className="hidden"
                        accept=".pptx,.ppt"
                        onChange={handleFileSelect}
                    />
                </label>
            </div>
        </div>
    );
};
