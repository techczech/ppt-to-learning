import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Circle, Home } from 'lucide-react';
import clsx from 'clsx';
import type { Collection, Folder as FolderType } from '../api';

interface DestinationPickerProps {
    collections: Collection[];
    folders: FolderType[];
    selectedCollectionId: string | null;
    selectedFolderId: string | null;
    onSelect: (collectionId: string | null, folderId: string | null) => void;
}

interface FolderNodeProps {
    folder: FolderType;
    folders: FolderType[];
    level: number;
    selectedFolderId: string | null;
    onSelectFolder: (folderId: string) => void;
    expandedIds: Set<string>;
    toggleExpanded: (id: string) => void;
}

const FolderNode: React.FC<FolderNodeProps> = ({
    folder,
    folders,
    level,
    selectedFolderId,
    onSelectFolder,
    expandedIds,
    toggleExpanded
}) => {
    const children = folders.filter(f => f.parentId === folder.id).sort((a, b) => a.order - b.order);
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(folder.id);
    const isSelected = selectedFolderId === folder.id;

    return (
        <div>
            <div
                className={clsx(
                    "group flex items-center py-1.5 px-2 rounded-lg cursor-pointer transition-all",
                    isSelected ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100 text-gray-700"
                )}
                style={{ paddingLeft: `${level * 16 + 24}px` }}
                onClick={() => onSelectFolder(folder.id)}
            >
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (hasChildren) toggleExpanded(folder.id);
                    }}
                    className={clsx(
                        "w-4 h-4 mr-1 flex items-center justify-center",
                        !hasChildren && "opacity-0"
                    )}
                >
                    {hasChildren && (isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)}
                </button>
                {isExpanded ? (
                    <FolderOpen className="w-4 h-4 mr-2 text-amber-500" />
                ) : (
                    <Folder className="w-4 h-4 mr-2 text-amber-500" />
                )}
                <span className="flex-1 text-sm truncate">{folder.name}</span>
                {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-blue-600" />
                )}
            </div>
            {isExpanded && hasChildren && (
                <div>
                    {children.map(child => (
                        <FolderNode
                            key={child.id}
                            folder={child}
                            folders={folders}
                            level={level + 1}
                            selectedFolderId={selectedFolderId}
                            onSelectFolder={onSelectFolder}
                            expandedIds={expandedIds}
                            toggleExpanded={toggleExpanded}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const DestinationPicker: React.FC<DestinationPickerProps> = ({
    collections,
    folders,
    selectedCollectionId,
    selectedFolderId,
    onSelect
}) => {
    const [expandedCollections, setExpandedCollections] = useState<Set<string>>(
        new Set(collections.map(c => c.id))
    );
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

    const toggleCollection = (id: string) => {
        setExpandedCollections(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleFolder = (id: string) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const isNoCollection = selectedCollectionId === null && selectedFolderId === null;

    return (
        <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg">
            {/* No collection option */}
            <div
                className={clsx(
                    "flex items-center py-2 px-3 cursor-pointer transition-all border-b border-gray-100",
                    isNoCollection ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50 text-gray-700"
                )}
                onClick={() => onSelect(null, null)}
            >
                <Home className="w-4 h-4 mr-2 text-gray-400" />
                <span className="flex-1 text-sm font-medium">All Presentations (no collection)</span>
                {isNoCollection && (
                    <div className="w-2 h-2 rounded-full bg-blue-600" />
                )}
            </div>

            {/* Collections */}
            {collections.map(collection => {
                const collectionFolders = folders.filter(f => f.collectionId === collection.id);
                const rootFolders = collectionFolders.filter(f => f.parentId === null).sort((a, b) => a.order - b.order);
                const hasFolders = rootFolders.length > 0;
                const isExpanded = expandedCollections.has(collection.id);
                const isCollectionSelected = selectedCollectionId === collection.id && selectedFolderId === null;

                return (
                    <div key={collection.id} className="border-b border-gray-100 last:border-b-0">
                        {/* Collection header */}
                        <div
                            className={clsx(
                                "flex items-center py-2 px-3 cursor-pointer transition-all",
                                isCollectionSelected ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50 text-gray-700"
                            )}
                        >
                            {hasFolders && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleCollection(collection.id);
                                    }}
                                    className="w-4 h-4 mr-1 flex items-center justify-center"
                                >
                                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                </button>
                            )}
                            {!hasFolders && <div className="w-4 h-4 mr-1" />}
                            <Circle
                                className="w-3 h-3 mr-2"
                                style={{ fill: collection.color, color: collection.color }}
                            />
                            <span
                                className="flex-1 text-sm font-medium truncate"
                                onClick={() => onSelect(collection.id, null)}
                            >
                                {collection.name}
                            </span>
                            {isCollectionSelected && (
                                <div className="w-2 h-2 rounded-full bg-blue-600" />
                            )}
                        </div>

                        {/* Collection folders */}
                        {isExpanded && hasFolders && (
                            <div className="pb-1">
                                {/* All items in collection (root) */}
                                <div
                                    className={clsx(
                                        "flex items-center py-1.5 px-3 pl-8 cursor-pointer transition-all",
                                        isCollectionSelected ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100 text-gray-600"
                                    )}
                                    onClick={() => onSelect(collection.id, null)}
                                >
                                    <Folder className="w-4 h-4 mr-2 text-gray-400" />
                                    <span className="text-sm">All items</span>
                                    {isCollectionSelected && (
                                        <div className="ml-auto w-2 h-2 rounded-full bg-blue-600" />
                                    )}
                                </div>

                                {/* Folder tree */}
                                {rootFolders.map(folder => (
                                    <FolderNode
                                        key={folder.id}
                                        folder={folder}
                                        folders={collectionFolders}
                                        level={0}
                                        selectedFolderId={selectedFolderId}
                                        onSelectFolder={(folderId) => onSelect(collection.id, folderId)}
                                        expandedIds={expandedFolders}
                                        toggleExpanded={toggleFolder}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default DestinationPicker;
