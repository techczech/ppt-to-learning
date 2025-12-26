import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { Folder as FolderType } from '../api';

interface FolderTreeProps {
    folders: FolderType[];
    selectedFolderId: string | null;
    onSelectFolder: (folderId: string | null) => void;
    onCreateFolder: (parentId: string | null) => void;
    onRenameFolder: (folder: FolderType) => void;
    onDeleteFolder: (folder: FolderType) => void;
    collectionId: string;
}

interface FolderNodeProps {
    folder: FolderType;
    folders: FolderType[];
    level: number;
    selectedFolderId: string | null;
    onSelectFolder: (folderId: string | null) => void;
    onCreateFolder: (parentId: string | null) => void;
    onRenameFolder: (folder: FolderType) => void;
    onDeleteFolder: (folder: FolderType) => void;
    expandedIds: Set<string>;
    toggleExpanded: (id: string) => void;
}

const FolderNode: React.FC<FolderNodeProps> = ({
    folder,
    folders,
    level,
    selectedFolderId,
    onSelectFolder,
    onCreateFolder,
    onRenameFolder,
    onDeleteFolder,
    expandedIds,
    toggleExpanded
}) => {
    const [showMenu, setShowMenu] = useState(false);
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
                style={{ paddingLeft: `${level * 16 + 8}px` }}
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
                <div className="relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(!showMenu);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-all"
                    >
                        <MoreHorizontal className="w-3 h-3" />
                    </button>
                    {showMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                            <div className="absolute right-0 top-6 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[140px]">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowMenu(false);
                                        onCreateFolder(folder.id);
                                    }}
                                    className="w-full flex items-center px-3 py-1.5 text-sm hover:bg-gray-100"
                                >
                                    <Plus className="w-3 h-3 mr-2" /> New subfolder
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowMenu(false);
                                        onRenameFolder(folder);
                                    }}
                                    className="w-full flex items-center px-3 py-1.5 text-sm hover:bg-gray-100"
                                >
                                    <Pencil className="w-3 h-3 mr-2" /> Rename
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowMenu(false);
                                        onDeleteFolder(folder);
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
                            onCreateFolder={onCreateFolder}
                            onRenameFolder={onRenameFolder}
                            onDeleteFolder={onDeleteFolder}
                            expandedIds={expandedIds}
                            toggleExpanded={toggleExpanded}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const FolderTree: React.FC<FolderTreeProps> = ({
    folders,
    selectedFolderId,
    onSelectFolder,
    onCreateFolder,
    onRenameFolder,
    onDeleteFolder,
    collectionId: _collectionId
}) => {
    void _collectionId; // Reserved for future use
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const toggleExpanded = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Root folders (no parent)
    const rootFolders = folders.filter(f => f.parentId === null).sort((a, b) => a.order - b.order);

    return (
        <div className="py-1">
            {/* All items (root of collection) */}
            <div
                className={clsx(
                    "flex items-center py-1.5 px-2 rounded-lg cursor-pointer transition-all",
                    selectedFolderId === null ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100 text-gray-700"
                )}
                onClick={() => onSelectFolder(null)}
            >
                <Folder className="w-4 h-4 mr-2 text-gray-400" />
                <span className="text-sm font-medium">All items</span>
            </div>

            {/* Folder tree */}
            {rootFolders.map(folder => (
                <FolderNode
                    key={folder.id}
                    folder={folder}
                    folders={folders}
                    level={0}
                    selectedFolderId={selectedFolderId}
                    onSelectFolder={onSelectFolder}
                    onCreateFolder={onCreateFolder}
                    onRenameFolder={onRenameFolder}
                    onDeleteFolder={onDeleteFolder}
                    expandedIds={expandedIds}
                    toggleExpanded={toggleExpanded}
                />
            ))}

            {/* Add folder button */}
            <button
                onClick={() => onCreateFolder(null)}
                className="flex items-center w-full py-1.5 px-2 mt-1 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
            >
                <Plus className="w-4 h-4 mr-2" />
                New folder
            </button>
        </div>
    );
};
