import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { FileUpload } from './components/FileUpload';
import { StatusPage } from './pages/StatusPage';
import { BatchStatusPage } from './pages/BatchStatusPage';
import { ViewerPage } from './pages/ViewerPage';
import { CollectionSidebar } from './components/CollectionSidebar';
import { CollectionModal, FolderModal } from './components/CollectionModal';
import { TagFilter, TagListDisplay } from './components/TagPills';
import { BookOpen, FileText, RefreshCw, Clock, Settings, Trash2, Pencil, Check, X, Search } from 'lucide-react';
import {
    getManagedPresentations, reprocessPresentation, deletePresentation, updatePresentation,
    getCollections, createCollection, updateCollection as apiUpdateCollection, deleteCollection as apiDeleteCollection,
    getFolders, createFolder, updateFolder as apiUpdateFolder, deleteFolder as apiDeleteFolder,
    getTags,
    type ManagedPresentation, type Collection, type Folder, type Tag
} from './api';
import { SettingsModal } from './components/SettingsModal';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/status/:id" element={<StatusPage />} />
                <Route path="/batch-status" element={<BatchStatusPage />} />
                <Route path="/viewer/:type/:id/:resultId?" element={<ViewerPage />} />
            </Routes>
        </BrowserRouter>
    );
}

const Home: React.FC = () => {
    // Data state
    const [managedFiles, setManagedFiles] = useState<ManagedPresentation[]>([]);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);

    // Selection state
    const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

    // UI state
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal state
    const [collectionModalOpen, setCollectionModalOpen] = useState(false);
    const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
    const [folderModalOpen, setFolderModalOpen] = useState(false);
    const [folderModalParentId, setFolderModalParentId] = useState<string | null>(null);
    const [folderModalCollectionId, setFolderModalCollectionId] = useState<string | null>(null);
    const [editingFolder, setEditingFolder] = useState<Folder | null>(null);

    const navigate = useNavigate();

    // Filter presentations
    const filteredFiles = managedFiles.filter(file => {
        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const name = file.originalName.replace(/\.(pptx?|PPTX?)$/, '').toLowerCase();
            const author = (file.author || '').toLowerCase();
            if (!name.includes(query) && !author.includes(query)) return false;
        }

        // Collection filter - only filter when a collection is selected
        // When "All Presentations" (null), show all including unassigned (undefined/null)
        if (selectedCollectionId !== null) {
            // Show only presentations in the selected collection
            if (file.collectionId !== selectedCollectionId) return false;
        }

        // Folder filter
        if (selectedFolderId !== null) {
            if (file.folderId !== selectedFolderId) return false;
        }

        // Tag filter
        if (selectedTagIds.length > 0) {
            const fileTags = file.tagIds || [];
            if (!selectedTagIds.some(tid => fileTags.includes(tid))) return false;
        }

        return true;
    });

    // Get tags for current collection
    const currentTags = selectedCollectionId
        ? tags.filter(t => t.collectionId === selectedCollectionId)
        : tags;

    // Load all data
    const loadData = async () => {
        try {
            const [presos, colls] = await Promise.all([
                getManagedPresentations(),
                getCollections()
            ]);
            setManagedFiles(presos);
            setCollections(colls);

            // Load folders and tags for all collections
            const allFolders: Folder[] = [];
            const allTags: Tag[] = [];
            for (const coll of colls) {
                const [collFolders, collTags] = await Promise.all([
                    getFolders(coll.id),
                    getTags(coll.id)
                ]);
                allFolders.push(...collFolders);
                allTags.push(...collTags);
            }
            setFolders(allFolders);
            setTags(allTags);
        } catch (e) {
            console.error('Failed to load data:', e);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Handlers
    const handleReprocess = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        if (confirm('Are you sure you want to reprocess this file?')) {
            await reprocessPresentation(id);
            navigate(`/status/${id}`);
        }
    };

    const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm(`Delete "${name}"? This cannot be undone.`)) {
            try {
                await deletePresentation(id);
                setManagedFiles(files => files.filter(f => f.id !== id));
            } catch (err) {
                alert('Failed to delete presentation');
            }
        }
    };

    const startEdit = (file: ManagedPresentation, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setEditingId(file.id);
        setEditName(file.originalName.replace(/\.(pptx?|PPTX?)$/, ''));
    };

    const saveEdit = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!editName.trim()) return;
        try {
            const newName = editName.trim() + '.pptx';
            await updatePresentation(id, { originalName: newName });
            setManagedFiles(files => files.map(f =>
                f.id === id ? { ...f, originalName: newName } : f
            ));
            setEditingId(null);
        } catch (err) {
            alert('Failed to update name');
        }
    };

    const cancelEdit = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setEditingId(null);
    };

    // Collection handlers
    const handleCreateCollection = () => {
        setEditingCollection(null);
        setCollectionModalOpen(true);
    };

    const handleEditCollection = (collection: Collection) => {
        setEditingCollection(collection);
        setCollectionModalOpen(true);
    };

    const handleSaveCollection = async (data: { name: string; description: string; color: string }) => {
        try {
            if (editingCollection) {
                const updated = await apiUpdateCollection(editingCollection.id, data);
                setCollections(cols => cols.map(c => c.id === updated.id ? updated : c));
            } else {
                const created = await createCollection(data.name, data.description, data.color);
                setCollections(cols => [...cols, created]);
            }
        } catch (e) {
            console.error('Failed to save collection:', e);
            alert('Failed to save collection: ' + (e instanceof Error ? e.message : 'Unknown error'));
        }
    };

    const handleDeleteCollection = async (collection: Collection) => {
        if (confirm(`Delete collection "${collection.name}"? Presentations will be moved to "All Presentations".`)) {
            try {
                await apiDeleteCollection(collection.id);
                setCollections(cols => cols.filter(c => c.id !== collection.id));
                setFolders(folds => folds.filter(f => f.collectionId !== collection.id));
                setTags(ts => ts.filter(t => t.collectionId !== collection.id));
                // Update presentations
                setManagedFiles(files => files.map(f =>
                    f.collectionId === collection.id
                        ? { ...f, collectionId: null, folderId: null, tagIds: [] }
                        : f
                ));
                if (selectedCollectionId === collection.id) {
                    setSelectedCollectionId(null);
                    setSelectedFolderId(null);
                }
            } catch (e) {
                console.error('Failed to delete collection:', e);
                alert('Failed to delete collection: ' + (e instanceof Error ? e.message : 'Unknown error'));
            }
        }
    };

    // Folder handlers
    const handleCreateFolder = (collectionId: string, parentId: string | null) => {
        setEditingFolder(null);
        setFolderModalParentId(parentId);
        setFolderModalCollectionId(collectionId);
        setFolderModalOpen(true);
    };

    const handleRenameFolder = (folder: Folder) => {
        setEditingFolder(folder);
        setFolderModalCollectionId(folder.collectionId);
        setFolderModalOpen(true);
    };

    const handleSaveFolder = async (name: string) => {
        try {
            if (editingFolder) {
                const updated = await apiUpdateFolder(editingFolder.id, { name });
                setFolders(folds => folds.map(f => f.id === updated.id ? updated : f));
            } else if (folderModalCollectionId) {
                const created = await createFolder(folderModalCollectionId, name, folderModalParentId);
                setFolders(folds => [...folds, created]);
            }
        } catch (e) {
            alert('Failed to save folder');
        }
    };

    const handleDeleteFolder = async (folder: Folder) => {
        if (confirm(`Delete folder "${folder.name}" and all subfolders?`)) {
            try {
                await apiDeleteFolder(folder.id);
                // Remove folder and children from state
                const removeIds = new Set<string>();
                const addDescendants = (fid: string) => {
                    removeIds.add(fid);
                    folders.filter(f => f.parentId === fid).forEach(f => addDescendants(f.id));
                };
                addDescendants(folder.id);
                setFolders(folds => folds.filter(f => !removeIds.has(f.id)));
                setManagedFiles(files => files.map(f =>
                    removeIds.has(f.folderId || '') ? { ...f, folderId: null } : f
                ));
                if (selectedFolderId && removeIds.has(selectedFolderId)) {
                    setSelectedFolderId(null);
                }
            } catch (e) {
                alert('Failed to delete folder');
            }
        }
    };

    // Tag handlers
    const handleToggleTag = (tagId: string) => {
        setSelectedTagIds(prev =>
            prev.includes(tagId)
                ? prev.filter(id => id !== tagId)
                : [...prev, tagId]
        );
    };

    const handleMoveToCollection = async (presentationId: string, collectionId: string | null) => {
        try {
            await updatePresentation(presentationId, { collectionId, folderId: null, tagIds: [] });
            setManagedFiles(files => files.map(f =>
                f.id === presentationId
                    ? { ...f, collectionId, folderId: null, tagIds: [] }
                    : f
            ));
        } catch (e) {
            alert('Failed to move presentation');
        }
    };

    return (
        <div className="h-screen flex flex-col bg-gray-50 font-sans text-gray-900">
            {/* Header */}
            <header className="bg-white shadow-sm z-20 flex-shrink-0">
                <div className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="bg-blue-600 p-2 rounded-lg">
                            <BookOpen className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-xl font-bold tracking-tight">PPT to Learning</h1>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search presentations..."
                                className="pl-9 pr-8 py-2 w-64 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                            title="API Settings"
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                        <button onClick={loadData} className="text-sm text-blue-600 hover:underline">
                            Refresh
                        </button>
                    </div>
                </div>
            </header>

            {/* Main content with sidebar */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <div className="w-64 flex-shrink-0">
                    <CollectionSidebar
                        collections={collections}
                        folders={folders}
                        tags={tags}
                        selectedCollectionId={selectedCollectionId}
                        selectedFolderId={selectedFolderId}
                        onSelectCollection={setSelectedCollectionId}
                        onSelectFolder={setSelectedFolderId}
                        onCreateCollection={handleCreateCollection}
                        onEditCollection={handleEditCollection}
                        onDeleteCollection={handleDeleteCollection}
                        onCreateFolder={handleCreateFolder}
                        onRenameFolder={handleRenameFolder}
                        onDeleteFolder={handleDeleteFolder}
                    />
                </div>

                {/* Main area */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Upload panel */}
                        <div className="lg:col-span-4">
                            <div className="mb-4">
                                <h2 className="text-lg font-bold mb-1">Upload New</h2>
                                <p className="text-sm text-gray-500">
                                    {selectedCollectionId
                                        ? `Import to ${collections.find(c => c.id === selectedCollectionId)?.name}`
                                        : 'Select a collection first'}
                                </p>
                            </div>
                            <div className="bg-white p-3 rounded-xl shadow border border-gray-200">
                                <FileUpload
                                    collectionId={selectedCollectionId}
                                    folderId={selectedFolderId}
                                    onUploadComplete={loadData}
                                />
                            </div>
                        </div>

                        {/* Presentations list */}
                        <div className="lg:col-span-8">
                            <div className="mb-4 flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold">
                                        {selectedCollectionId
                                            ? collections.find(c => c.id === selectedCollectionId)?.name
                                            : 'All Presentations'}
                                        {selectedFolderId && folders.find(f => f.id === selectedFolderId) && (
                                            <span className="text-gray-400 font-normal">
                                                {' / '}{folders.find(f => f.id === selectedFolderId)?.name}
                                            </span>
                                        )}
                                    </h2>
                                    <p className="text-sm text-gray-500">
                                        {filteredFiles.length} presentation{filteredFiles.length !== 1 ? 's' : ''}
                                    </p>
                                </div>
                            </div>

                            {/* Tag filter */}
                            {currentTags.length > 0 && (
                                <div className="mb-4">
                                    <TagFilter
                                        tags={currentTags}
                                        selectedTagIds={selectedTagIds}
                                        onToggleTag={handleToggleTag}
                                        onClearAll={() => setSelectedTagIds([])}
                                    />
                                </div>
                            )}

                            {/* Presentations */}
                            <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
                                {filteredFiles.length === 0 ? (
                                    <div className="p-8 text-center text-gray-400">
                                        {searchQuery || selectedTagIds.length > 0
                                            ? 'No matching presentations found.'
                                            : 'No presentations yet.'}
                                    </div>
                                ) : (
                                    <ul className="divide-y divide-gray-100">
                                        {filteredFiles.map((file) => (
                                            <li key={file.id} className="p-4 hover:bg-gray-50 transition flex items-center justify-between group">
                                                <Link
                                                    to={file.status === 'completed' ? `/viewer/new/${file.id}/${file.resultId}` : `/status/${file.id}`}
                                                    className="flex items-center flex-1 min-w-0"
                                                    onClick={(e) => editingId === file.id && e.preventDefault()}
                                                >
                                                    <div className={`p-2 rounded mr-3 flex-shrink-0 ${file.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                                                        {file.status === 'completed' ? <FileText className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        {editingId === file.id ? (
                                                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                                <input
                                                                    type="text"
                                                                    value={editName}
                                                                    onChange={(e) => setEditName(e.target.value)}
                                                                    className="flex-1 px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                    autoFocus
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') saveEdit(file.id, e as any);
                                                                        if (e.key === 'Escape') cancelEdit(e as any);
                                                                    }}
                                                                />
                                                                <button onClick={(e) => saveEdit(file.id, e)} className="p-1 text-green-600 hover:bg-green-50 rounded">
                                                                    <Check className="w-4 h-4" />
                                                                </button>
                                                                <button onClick={cancelEdit} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <h3 className="font-medium text-gray-800 group-hover:text-blue-600 transition-colors truncate">
                                                                    {file.originalName.replace(/\.(pptx?|PPTX?)$/, '')}
                                                                </h3>
                                                                <div className="flex items-center text-xs text-gray-400 space-x-2 flex-wrap mt-0.5">
                                                                    {file.author && (
                                                                        <>
                                                                            <span className="text-gray-500">{file.author}</span>
                                                                            <span>•</span>
                                                                        </>
                                                                    )}
                                                                    {file.stats?.slide_count && (
                                                                        <>
                                                                            <span>{file.stats.slide_count} slides</span>
                                                                            <span>•</span>
                                                                        </>
                                                                    )}
                                                                    <span className="capitalize">{file.status}</span>
                                                                </div>
                                                                {file.tagIds && file.tagIds.length > 0 && (
                                                                    <div className="mt-1">
                                                                        <TagListDisplay tags={tags} tagIds={file.tagIds} />
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </Link>
                                                <div className="ml-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                    {/* Move to collection */}
                                                    {collections.length > 0 && !file.collectionId && (
                                                        <select
                                                            onClick={(e) => e.stopPropagation()}
                                                            onChange={(e) => {
                                                                if (e.target.value) {
                                                                    handleMoveToCollection(file.id, e.target.value);
                                                                }
                                                            }}
                                                            className="text-xs border border-gray-200 rounded px-1 py-1 mr-1"
                                                            defaultValue=""
                                                        >
                                                            <option value="" disabled>Move to...</option>
                                                            {collections.map(c => (
                                                                <option key={c.id} value={c.id}>{c.name}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                    <button
                                                        onClick={(e) => startEdit(file, e)}
                                                        title="Rename"
                                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleReprocess(file.id, e)}
                                                        title="Reprocess"
                                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition"
                                                    >
                                                        <RefreshCw className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDelete(file.id, file.originalName.replace(/\.(pptx?|PPTX?)$/, ''), e)}
                                                        title="Delete"
                                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

            <CollectionModal
                isOpen={collectionModalOpen}
                onClose={() => setCollectionModalOpen(false)}
                onSave={handleSaveCollection}
                collection={editingCollection}
            />

            <FolderModal
                isOpen={folderModalOpen}
                onClose={() => {
                    setFolderModalOpen(false);
                    setEditingFolder(null);
                }}
                onSave={handleSaveFolder}
                folder={editingFolder}
            />
        </div>
    );
};

export default App;
