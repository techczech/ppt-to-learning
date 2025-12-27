import React, { useState } from 'react';
import { X, FolderOpen, Folder, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import type { Collection, Folder as FolderType } from '../api';

interface MoveToCollectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    collections: Collection[];
    folders: FolderType[];
    slideCount: number;
    onMove: (collectionId: string | null, folderId: string | null) => void;
    isMoving: boolean;
}

export const MoveToCollectionModal: React.FC<MoveToCollectionModalProps> = ({
    isOpen,
    onClose,
    collections,
    folders,
    slideCount,
    onMove,
    isMoving
}) => {
    const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

    const getFoldersForCollection = (collectionId: string) => {
        return folders.filter(f => f.collectionId === collectionId && !f.parentId);
    };

    const handleMove = () => {
        onMove(selectedCollectionId, selectedFolderId);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
                {/* Backdrop */}
                <div
                    className="fixed inset-0 bg-black/50 transition-opacity"
                    onClick={onClose}
                />

                {/* Modal */}
                <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b">
                        <h2 className="text-lg font-semibold text-gray-900">
                            Move {slideCount} Slide{slideCount !== 1 ? 's' : ''}
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 max-h-[400px] overflow-y-auto">
                        <p className="text-sm text-gray-500 mb-4">
                            Select a collection or folder to move the selected slides to:
                        </p>

                        {/* No Collection option */}
                        <button
                            onClick={() => {
                                setSelectedCollectionId(null);
                                setSelectedFolderId(null);
                            }}
                            className={clsx(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors",
                                selectedCollectionId === null && selectedFolderId === null
                                    ? "bg-blue-100 text-blue-700 border-2 border-blue-500"
                                    : "bg-gray-50 hover:bg-gray-100 text-gray-700"
                            )}
                        >
                            <FolderOpen className="w-5 h-5 text-gray-400" />
                            <span className="font-medium">No Collection (Unorganized)</span>
                        </button>

                        {/* Collections */}
                        {collections.map(collection => {
                            const collFolders = getFoldersForCollection(collection.id);
                            const isCollectionSelected = selectedCollectionId === collection.id && !selectedFolderId;

                            return (
                                <div key={collection.id} className="mb-2">
                                    <button
                                        onClick={() => {
                                            setSelectedCollectionId(collection.id);
                                            setSelectedFolderId(null);
                                        }}
                                        className={clsx(
                                            "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                                            isCollectionSelected
                                                ? "bg-blue-100 text-blue-700 border-2 border-blue-500"
                                                : "bg-gray-50 hover:bg-gray-100 text-gray-700"
                                        )}
                                    >
                                        <FolderOpen
                                            className="w-5 h-5"
                                            style={{ color: collection.color }}
                                        />
                                        <span className="font-medium">{collection.name}</span>
                                    </button>

                                    {/* Folders within collection */}
                                    {collFolders.length > 0 && (
                                        <div className="ml-6 mt-1 space-y-1">
                                            {collFolders.map(folder => (
                                                <button
                                                    key={folder.id}
                                                    onClick={() => {
                                                        setSelectedCollectionId(collection.id);
                                                        setSelectedFolderId(folder.id);
                                                    }}
                                                    className={clsx(
                                                        "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                                                        selectedFolderId === folder.id
                                                            ? "bg-blue-100 text-blue-700 border-2 border-blue-500"
                                                            : "bg-gray-50 hover:bg-gray-100 text-gray-600"
                                                    )}
                                                >
                                                    <Folder className="w-4 h-4 text-gray-400" />
                                                    <span>{folder.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleMove}
                            disabled={isMoving}
                            className={clsx(
                                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
                                isMoving
                                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                    : "bg-blue-600 text-white hover:bg-blue-700"
                            )}
                        >
                            {isMoving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Moving...
                                </>
                            ) : (
                                'Move Slides'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MoveToCollectionModal;
