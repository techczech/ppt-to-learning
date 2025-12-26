import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { checkStatus } from '../api';
import { BatchUploadStatus } from '../components/BatchUploadStatus';
import type { FileProgress, UploadStatus } from '../components/BatchUploadStatus';
import { ArrowLeft, Library } from 'lucide-react';

interface BatchItem {
    id: string;
    filename: string;
    status: UploadStatus;
    resultId?: string;
}

export const BatchStatusPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [items, setItems] = useState<BatchItem[]>([]);
    const [initialized, setInitialized] = useState(false);

    // Parse IDs and filenames from URL
    useEffect(() => {
        const idsParam = searchParams.get('ids');
        const namesParam = searchParams.get('names');

        if (!idsParam) {
            navigate('/');
            return;
        }

        const ids = idsParam.split(',');
        const names = namesParam ? namesParam.split(',') : ids.map((_, i) => `File ${i + 1}`);

        setItems(ids.map((id, i) => ({
            id,
            filename: decodeURIComponent(names[i] || `File ${i + 1}`),
            status: 'processing' as UploadStatus
        })));
        setInitialized(true);
    }, [searchParams, navigate]);

    // Poll status for all items
    const pollStatuses = useCallback(async () => {
        const updatedItems = await Promise.all(
            items.map(async (item) => {
                if (item.status === 'completed' || item.status === 'failed') {
                    return item;
                }
                try {
                    const res = await checkStatus(item.id);
                    return {
                        ...item,
                        status: res.status as UploadStatus,
                        resultId: res.resultId
                    };
                } catch {
                    return { ...item, status: 'failed' as UploadStatus };
                }
            })
        );
        setItems(updatedItems);
    }, [items]);

    useEffect(() => {
        if (!initialized || items.length === 0) return;

        const allDone = items.every(
            item => item.status === 'completed' || item.status === 'failed'
        );

        if (allDone) return;

        const interval = setInterval(pollStatuses, 2000);
        return () => clearInterval(interval);
    }, [initialized, items, pollStatuses]);

    const handleViewPresentation = (presentationId: string) => {
        const item = items.find(i => i.id === presentationId);
        if (item?.resultId) {
            navigate(`/viewer/new/${presentationId}/${item.resultId}`);
        }
    };

    const completedCount = items.filter(i => i.status === 'completed').length;
    const allDone = items.every(
        item => item.status === 'completed' || item.status === 'failed'
    );

    // Convert to FileProgress format
    const fileProgress: FileProgress[] = items.map((item, i) => ({
        fileId: `file-${i}`,
        filename: item.filename,
        status: item.status,
        presentationId: item.id
    }));

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            to="/"
                            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span>Back to Library</span>
                        </Link>
                    </div>
                    <h1 className="text-lg font-semibold text-gray-900">
                        Batch Upload
                    </h1>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-8">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-xl font-semibold mb-6">
                        {allDone
                            ? `Processed ${completedCount} of ${items.length} files`
                            : `Processing ${items.length} files...`}
                    </h2>

                    <BatchUploadStatus
                        files={fileProgress}
                        onViewPresentation={handleViewPresentation}
                    />

                    {allDone && (
                        <div className="mt-6 pt-6 border-t border-gray-200 flex justify-center">
                            <Link
                                to="/"
                                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
                            >
                                <Library className="w-5 h-5" />
                                View in Library
                            </Link>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};
