import React, { useState } from 'react';
import { Library, Plus, ChevronRight, ChevronDown, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import clsx from 'clsx';
import type { Collection, Folder, Tag } from '../api';
import { FolderTree } from './FolderTree';

interface CollectionSidebarProps {
    collections: Collection[];
    folders: Folder[];
    tags: Tag[];
    selectedCollectionId: string | null;
    selectedFolderId: string | null;
    onSelectCollection: (collectionId: string | null) => void;
    onSelectFolder: (folderId: string | null) => void;
    onCreateCollection: () => void;
    onEditCollection: (collection: Collection) => void;
    onDeleteCollection: (collection: Collection) => void;
    onCreateFolder: (collectionId: string, parentId: string | null) => void;
    onRenameFolder: (folder: Folder) => void;
    onDeleteFolder: (folder: Folder) => void;
}

interface CollectionItemProps {
    collection: Collection;
    folders: Folder[];
    isSelected: boolean;
    isExpanded: boolean;
    selectedFolderId: string | null;
    onSelect: () => void;
    onToggleExpand: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onSelectFolder: (folderId: string | null) => void;
    onCreateFolder: (parentId: string | null) => void;
    onRenameFolder: (folder: Folder) => void;
    onDeleteFolder: (folder: Folder) => void;
}

const CollectionItem: React.FC<CollectionItemProps> = ({
    collection,
    folders,
    isSelected,
    isExpanded,
    selectedFolderId,
    onSelect,
    onToggleExpand,
    onEdit,
    onDelete,
    onSelectFolder,
    onCreateFolder,
    onRenameFolder,
    onDeleteFolder
}) => {
    const [showMenu, setShowMenu] = useState(false);
    const collectionFolders = folders.filter(f => f.collectionId === collection.id);

    return (
        <div className="mb-1">
            <div
                className={clsx(
                    "group flex items-center py-2 px-3 rounded-lg cursor-pointer transition-all",
                    isSelected && !selectedFolderId
                        ? "bg-blue-100 text-blue-700"
                        : isSelected
                        ? "bg-gray-100 text-gray-700"
                        : "hover:bg-gray-100 text-gray-600"
                )}
                onClick={onSelect}
            >
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleExpand();
                    }}
                    className="mr-1"
                >
                    {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                    ) : (
                        <ChevronRight className="w-4 h-4" />
                    )}
                </button>
                <div
                    className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                    style={{ backgroundColor: collection.color }}
                />
                <span className="flex-1 font-medium text-sm truncate">{collection.name}</span>
                <div className="relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(!showMenu);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-all"
                    >
                        <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {showMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[120px]">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowMenu(false);
                                        onEdit();
                                    }}
                                    className="w-full flex items-center px-3 py-1.5 text-sm hover:bg-gray-100"
                                >
                                    <Pencil className="w-3 h-3 mr-2" /> Edit
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowMenu(false);
                                        onDelete();
                                    }}
                                    className="w-full flex items-center px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                                >
                                    <Trash2 className="w-3 h-3 mr-2" /> Delete
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
            {isExpanded && isSelected && (
                <div className="ml-4 border-l border-gray-200 pl-2">
                    <FolderTree
                        folders={collectionFolders}
                        selectedFolderId={selectedFolderId}
                        onSelectFolder={onSelectFolder}
                        onCreateFolder={onCreateFolder}
                        onRenameFolder={onRenameFolder}
                        onDeleteFolder={onDeleteFolder}
                        collectionId={collection.id}
                    />
                </div>
            )}
        </div>
    );
};

export const CollectionSidebar: React.FC<CollectionSidebarProps> = ({
    collections,
    folders,
    tags: _tags,
    selectedCollectionId,
    selectedFolderId,
    onSelectCollection,
    onSelectFolder,
    onCreateCollection,
    onEditCollection,
    onDeleteCollection,
    onCreateFolder,
    onRenameFolder,
    onDeleteFolder
}) => {
    void _tags; // Reserved for future tag display in sidebar
    const [expandedCollections, setExpandedCollections] = useState<Set<string>>(
        new Set(selectedCollectionId ? [selectedCollectionId] : [])
    );

    const toggleExpanded = (id: string) => {
        setExpandedCollections(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSelectCollection = (collectionId: string) => {
        onSelectCollection(collectionId);
        onSelectFolder(null);
        // Auto-expand when selecting
        setExpandedCollections(prev => new Set(prev).add(collectionId));
    };

    return (
        <div className="h-full flex flex-col bg-gray-50 border-r border-gray-200">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <Library className="w-5 h-5 mr-2 text-gray-500" />
                        <span className="font-semibold text-gray-700">Collections</span>
                    </div>
                    <button
                        onClick={onCreateCollection}
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                        title="New collection"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Collections List */}
            <div className="flex-1 overflow-y-auto p-2">
                {/* All Presentations option */}
                <div
                    className={clsx(
                        "flex items-center py-2 px-3 rounded-lg cursor-pointer transition-all mb-2",
                        selectedCollectionId === null
                            ? "bg-blue-100 text-blue-700"
                            : "hover:bg-gray-100 text-gray-600"
                    )}
                    onClick={() => {
                        onSelectCollection(null);
                        onSelectFolder(null);
                    }}
                >
                    <Library className="w-4 h-4 mr-2" />
                    <span className="font-medium text-sm">All Presentations</span>
                </div>

                {/* Separator */}
                {collections.length > 0 && (
                    <div className="border-t border-gray-200 my-2" />
                )}

                {/* Collection Items */}
                {collections.map(collection => (
                    <CollectionItem
                        key={collection.id}
                        collection={collection}
                        folders={folders}
                        isSelected={selectedCollectionId === collection.id}
                        isExpanded={expandedCollections.has(collection.id)}
                        selectedFolderId={selectedCollectionId === collection.id ? selectedFolderId : null}
                        onSelect={() => handleSelectCollection(collection.id)}
                        onToggleExpand={() => toggleExpanded(collection.id)}
                        onEdit={() => onEditCollection(collection)}
                        onDelete={() => onDeleteCollection(collection)}
                        onSelectFolder={onSelectFolder}
                        onCreateFolder={(parentId) => onCreateFolder(collection.id, parentId)}
                        onRenameFolder={onRenameFolder}
                        onDeleteFolder={onDeleteFolder}
                    />
                ))}

                {collections.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-sm">
                        <p>No collections yet</p>
                        <button
                            onClick={onCreateCollection}
                            className="mt-2 text-blue-600 hover:underline"
                        >
                            Create your first collection
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
