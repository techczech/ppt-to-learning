import React from 'react';
import {
    FolderOpen,
    Folder,
    Package,
    ChevronRight,
    ChevronDown,
    Layers,
    Download,
    Trash2,
    Pencil,
    FolderPlus
} from 'lucide-react';
import clsx from 'clsx';
import type { Collection, Folder as FolderType, Pack, PackFolder } from '../api';

interface SlideLibrarySidebarProps {
    collections: Collection[];
    folders: FolderType[];
    packs: Pack[];
    packFolders: PackFolder[];
    selectedCollectionId: string | null;
    selectedFolderId: string | null;
    selectedPackId: string | null;
    selectedPackFolderId: string | null;
    onSelectCollection: (id: string | null) => void;
    onSelectFolder: (id: string | null) => void;
    onSelectPack: (id: string | null) => void;
    onSelectPackFolder: (id: string | null) => void;
    onEditPack: (packId: string) => void;
    onExportPack: (packId: string) => void;
    onDeletePack: (packId: string) => void;
    onCreatePackFolder?: () => void;
    onEditPackFolder?: (folderId: string) => void;
    onDeletePackFolder?: (folderId: string) => void;
}

export const SlideLibrarySidebar: React.FC<SlideLibrarySidebarProps> = ({
    collections,
    folders,
    packs,
    packFolders,
    selectedCollectionId,
    selectedFolderId,
    selectedPackId,
    selectedPackFolderId,
    onSelectCollection,
    onSelectFolder,
    onSelectPack,
    onSelectPackFolder,
    onEditPack,
    onExportPack,
    onDeletePack,
    onCreatePackFolder,
    onEditPackFolder,
    onDeletePackFolder
}) => {
    const [expandedCollections, setExpandedCollections] = React.useState<Set<string>>(new Set());
    const [expandedPackFolders, setExpandedPackFolders] = React.useState<Set<string>>(new Set());

    const toggleCollection = (collectionId: string) => {
        const newExpanded = new Set(expandedCollections);
        if (newExpanded.has(collectionId)) {
            newExpanded.delete(collectionId);
        } else {
            newExpanded.add(collectionId);
        }
        setExpandedCollections(newExpanded);
    };

    const getFoldersForCollection = (collectionId: string) => {
        return folders.filter(f => f.collectionId === collectionId && !f.parentId);
    };

    const getChildFolders = (parentId: string) => {
        return folders.filter(f => f.parentId === parentId);
    };

    const togglePackFolder = (folderId: string) => {
        const newExpanded = new Set(expandedPackFolders);
        if (newExpanded.has(folderId)) {
            newExpanded.delete(folderId);
        } else {
            newExpanded.add(folderId);
        }
        setExpandedPackFolders(newExpanded);
    };

    const getPacksInFolder = (folderId: string | null) => {
        return packs.filter(p => p.folderId === folderId);
    };

    const getRootPackFolders = () => {
        return packFolders.filter(f => !f.parentId);
    };

    const getChildPackFolders = (parentId: string) => {
        return packFolders.filter(f => f.parentId === parentId);
    };

    const renderFolder = (folder: FolderType, level: number = 0) => {
        const children = getChildFolders(folder.id);
        const isSelected = selectedFolderId === folder.id;

        return (
            <div key={folder.id}>
                <button
                    onClick={() => onSelectFolder(isSelected ? null : folder.id)}
                    className={clsx(
                        "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg transition-colors",
                        isSelected
                            ? "bg-blue-100 text-blue-700"
                            : "text-gray-600 hover:bg-gray-100"
                    )}
                    style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}
                >
                    <Folder className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{folder.name}</span>
                </button>
                {children.map(child => renderFolder(child, level + 1))}
            </div>
        );
    };

    return (
        <aside className="w-64 border-r bg-gray-50 flex flex-col h-full overflow-hidden">
            {/* All Slides */}
            <div className="p-3 border-b">
                <button
                    onClick={() => {
                        onSelectCollection(null);
                        onSelectFolder(null);
                        onSelectPack(null);
                    }}
                    className={clsx(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
                        !selectedCollectionId && !selectedFolderId && !selectedPackId
                            ? "bg-blue-100 text-blue-700"
                            : "text-gray-700 hover:bg-gray-100"
                    )}
                >
                    <Layers className="w-5 h-5" />
                    <span className="font-medium">All Slides</span>
                </button>
            </div>

            {/* Collections & Folders */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Collections
                </div>

                {collections.length === 0 ? (
                    <p className="text-sm text-gray-400 italic px-2">No collections</p>
                ) : (
                    collections.map(collection => {
                        const collFolders = getFoldersForCollection(collection.id);
                        const isExpanded = expandedCollections.has(collection.id);
                        const isSelected = selectedCollectionId === collection.id && !selectedFolderId;

                        return (
                            <div key={collection.id}>
                                <div className="flex items-center">
                                    {collFolders.length > 0 && (
                                        <button
                                            onClick={() => toggleCollection(collection.id)}
                                            className="p-1 text-gray-400 hover:text-gray-600"
                                        >
                                            {isExpanded ? (
                                                <ChevronDown className="w-4 h-4" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4" />
                                            )}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            onSelectCollection(isSelected ? null : collection.id);
                                            onSelectFolder(null);
                                            onSelectPack(null);
                                        }}
                                        className={clsx(
                                            "flex-1 flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg transition-colors",
                                            isSelected
                                                ? "bg-blue-100 text-blue-700"
                                                : "text-gray-600 hover:bg-gray-100",
                                            collFolders.length === 0 && "ml-5"
                                        )}
                                    >
                                        <FolderOpen
                                            className="w-4 h-4 flex-shrink-0"
                                            style={{ color: collection.color }}
                                        />
                                        <span className="truncate">{collection.name}</span>
                                    </button>
                                </div>

                                {isExpanded && collFolders.map(folder => renderFolder(folder))}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Packs */}
            <div className="border-t p-3">
                <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Packs
                    </div>
                    {onCreatePackFolder && (
                        <button
                            onClick={onCreatePackFolder}
                            className="p-1 text-gray-400 hover:text-purple-600"
                            title="Create pack folder"
                        >
                            <FolderPlus className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {packs.length === 0 && packFolders.length === 0 ? (
                    <p className="text-sm text-gray-400 italic px-2">No packs yet</p>
                ) : (
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                        {/* Pack Folders */}
                        {getRootPackFolders().map(packFolder => {
                            const folderPacks = getPacksInFolder(packFolder.id);
                            const childFolders = getChildPackFolders(packFolder.id);
                            const isExpanded = expandedPackFolders.has(packFolder.id);
                            const isSelected = selectedPackFolderId === packFolder.id;
                            const hasContent = folderPacks.length > 0 || childFolders.length > 0;

                            return (
                                <div key={packFolder.id}>
                                    <div className="flex items-center">
                                        {hasContent && (
                                            <button
                                                onClick={() => togglePackFolder(packFolder.id)}
                                                className="p-1 text-gray-400 hover:text-gray-600"
                                            >
                                                {isExpanded ? (
                                                    <ChevronDown className="w-4 h-4" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4" />
                                                )}
                                            </button>
                                        )}
                                        <div
                                            className={clsx(
                                                "group flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors",
                                                isSelected
                                                    ? "bg-purple-100 text-purple-700"
                                                    : "text-gray-600 hover:bg-gray-100",
                                                !hasContent && "ml-5"
                                            )}
                                        >
                                            <button
                                                onClick={() => onSelectPackFolder(isSelected ? null : packFolder.id)}
                                                className="flex-1 flex items-center gap-2 text-sm text-left"
                                            >
                                                <Folder
                                                    className="w-4 h-4 flex-shrink-0"
                                                    style={{ color: packFolder.color }}
                                                />
                                                <span className="truncate">{packFolder.name}</span>
                                                <span className="text-xs text-gray-400">
                                                    ({folderPacks.length})
                                                </span>
                                            </button>
                                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                                                {onEditPackFolder && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onEditPackFolder(packFolder.id);
                                                        }}
                                                        className="p-1 text-gray-400 hover:text-purple-600"
                                                        title="Edit folder"
                                                    >
                                                        <Pencil className="w-3 h-3" />
                                                    </button>
                                                )}
                                                {onDeletePackFolder && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onDeletePackFolder(packFolder.id);
                                                        }}
                                                        className="p-1 text-gray-400 hover:text-red-600"
                                                        title="Delete folder"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Packs within folder */}
                                    {isExpanded && folderPacks.map(pack => (
                                        <div
                                            key={pack.id}
                                            className={clsx(
                                                "group flex items-center gap-2 px-2 py-1.5 ml-6 rounded-lg transition-colors",
                                                selectedPackId === pack.id
                                                    ? "bg-purple-100 text-purple-700"
                                                    : "text-gray-600 hover:bg-gray-100"
                                            )}
                                        >
                                            <button
                                                onClick={() => onSelectPack(selectedPackId === pack.id ? null : pack.id)}
                                                className="flex-1 flex items-center gap-2 text-sm text-left"
                                            >
                                                <Package
                                                    className="w-4 h-4 flex-shrink-0"
                                                    style={{ color: pack.color }}
                                                />
                                                <span className="truncate">{pack.name}</span>
                                                <span className="text-xs text-gray-400">
                                                    ({pack.slideIds.length})
                                                </span>
                                            </button>
                                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onEditPack(pack.id);
                                                    }}
                                                    className="p-1 text-gray-400 hover:text-purple-600"
                                                    title="Edit pack"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onExportPack(pack.id);
                                                    }}
                                                    className="p-1 text-gray-400 hover:text-blue-600"
                                                    title="Export pack"
                                                >
                                                    <Download className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDeletePack(pack.id);
                                                    }}
                                                    className="p-1 text-gray-400 hover:text-red-600"
                                                    title="Delete pack"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}

                        {/* Unfoldered Packs */}
                        {getPacksInFolder(null).map(pack => (
                            <div
                                key={pack.id}
                                className={clsx(
                                    "group flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors",
                                    selectedPackId === pack.id
                                        ? "bg-purple-100 text-purple-700"
                                        : "text-gray-600 hover:bg-gray-100"
                                )}
                            >
                                <button
                                    onClick={() => onSelectPack(selectedPackId === pack.id ? null : pack.id)}
                                    className="flex-1 flex items-center gap-2 text-sm text-left"
                                >
                                    <Package
                                        className="w-4 h-4 flex-shrink-0"
                                        style={{ color: pack.color }}
                                    />
                                    <span className="truncate">{pack.name}</span>
                                    <span className="text-xs text-gray-400">
                                        ({pack.slideIds.length})
                                    </span>
                                </button>
                                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEditPack(pack.id);
                                        }}
                                        className="p-1 text-gray-400 hover:text-purple-600"
                                        title="Edit pack"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onExportPack(pack.id);
                                        }}
                                        className="p-1 text-gray-400 hover:text-blue-600"
                                        title="Export pack"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeletePack(pack.id);
                                        }}
                                        className="p-1 text-gray-400 hover:text-red-600"
                                        title="Delete pack"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </aside>
    );
};

export default SlideLibrarySidebar;
