import React, { useState } from 'react';
import { X, FolderInput } from 'lucide-react';
import { DestinationPicker } from './DestinationPicker';
import type { Collection, Folder } from '../api';

interface MoveModalProps {
    isOpen: boolean;
    onClose: () => void;
    onMove: (collectionId: string | null, folderId: string | null, preserveTags: boolean) => Promise<void>;
    presentationCount: number;
    collections: Collection[];
    folders: Folder[];
}

export const MoveModal: React.FC<MoveModalProps> = ({
    isOpen,
    onClose,
    onMove,
    presentationCount,
    collections,
    folders
}) => {
    const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const [preserveTags, setPreserveTags] = useState(true);
    const [isMoving, setIsMoving] = useState(false);

    if (!isOpen) return null;

    const handleSelect = (collectionId: string | null, folderId: string | null) => {
        setSelectedCollectionId(collectionId);
        setSelectedFolderId(folderId);
    };

    const handleMove = async () => {
        setIsMoving(true);
        try {
            await onMove(selectedCollectionId, selectedFolderId, preserveTags);
            onClose();
        } catch (e) {
            console.error('Move failed:', e);
        } finally {
            setIsMoving(false);
        }
    };

    const getDestinationName = () => {
        if (selectedCollectionId === null) {
            return 'All Presentations';
        }
        const collection = collections.find(c => c.id === selectedCollectionId);
        if (!collection) return 'Unknown';
        if (selectedFolderId) {
            const folder = folders.find(f => f.id === selectedFolderId);
            return folder ? `${collection.name} / ${folder.name}` : collection.name;
        }
        return collection.name;
    };

    const hasSelection = selectedCollectionId !== null || (selectedCollectionId === null && selectedFolderId === null);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        <FolderInput className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-semibold">
                            Move {presentationCount} Presentation{presentationCount !== 1 ? 's' : ''}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4">
                    <p className="text-sm text-gray-600 mb-3">Select destination:</p>

                    <DestinationPicker
                        collections={collections}
                        folders={folders}
                        selectedCollectionId={selectedCollectionId}
                        selectedFolderId={selectedFolderId}
                        onSelect={handleSelect}
                    />

                    {/* Preserve tags option */}
                    <label className="flex items-center gap-2 mt-4 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={preserveTags}
                            onChange={(e) => setPreserveTags(e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Preserve existing tags</span>
                    </label>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleMove}
                        disabled={!hasSelection || isMoving}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isMoving ? 'Moving...' : `Move to ${getDestinationName()}`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MoveModal;
