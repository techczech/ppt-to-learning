import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { checkStatus } from '../api';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export const StatusPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [status, setStatus] = useState('processing');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!id) return;

        const interval = setInterval(async () => {
            try {
                const res = await checkStatus(id);
                if (res.status === 'completed') {
                    clearInterval(interval);
                    navigate(`/viewer/new/${id}/${res.resultId}`);
                }
            } catch (e) {
                setError('Failed to check status');
                clearInterval(interval);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [id, navigate]);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-screen text-red-500">
                <XCircle className="w-16 h-16 mb-4" />
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-screen text-gray-600">
            <Loader2 className="w-16 h-16 animate-spin mb-4 text-blue-600" />
            <h2 className="text-2xl font-semibold mb-2">Converting Presentation...</h2>
            <p>This may take a few moments depending on the file size.</p>
        </div>
    );
};
