import React, { useState } from 'react';
import { Upload, FileType, Loader2 } from 'lucide-react';
import { uploadFile } from '../api';
import { useNavigate } from 'react-router-dom';

export const FileUpload: React.FC = () => {
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const navigate = useNavigate();

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const files = e.dataTransfer.files;
        if (files.length > 0) handleFile(files[0]);
    };

    const handleFile = async (file: File) => {
        if (!file.name.endsWith('.pptx') && !file.name.endsWith('.ppt')) {
            alert('Please upload a .pptx file');
            return;
        }

        setUploading(true);
        try {
            const res = await uploadFile(file);
            // Save to local history if we want (TODO)
            navigate(`/status/${res.id}`);
        } catch (e) {
            console.error(e);
            alert('Upload failed');
            setUploading(false);
        }
    };

    return (
        <div 
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors
                ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
            `}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
        >
            {uploading ? (
                <div className="flex flex-col items-center text-gray-500">
                    <Loader2 className="w-12 h-12 animate-spin mb-4" />
                    <p>Uploading and starting conversion...</p>
                </div>
            ) : (
                <div className="flex flex-col items-center text-gray-500">
                    <Upload className="w-12 h-12 mb-4" />
                    <p className="text-lg font-medium mb-2">Drop your presentation here</p>
                    <p className="text-sm mb-6">Supports .pptx</p>
                    <label className="btn btn-primary cursor-pointer bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition">
                        Browse Files
                        <input 
                            type="file" 
                            className="hidden" 
                            accept=".pptx,.ppt" 
                            onChange={(e) => e.target.files && handleFile(e.target.files[0])}
                        />
                    </label>
                </div>
            )}
        </div>
    );
};
