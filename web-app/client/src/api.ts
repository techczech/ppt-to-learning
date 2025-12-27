import axios from 'axios';

const API_URL = '/api';

// --- Types ---

export interface Collection {
    id: string;
    name: string;
    description: string;
    color: string;
    createdAt: string;
}

export interface Folder {
    id: string;
    collectionId: string;
    parentId: string | null;
    name: string;
    order: number;
}

export interface Tag {
    id: string;
    collectionId: string;
    name: string;
    color: string;
}

export interface ManagedPresentation {
    id: string;
    filename: string;
    originalName: string;
    uploadedAt: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    resultId?: string;
    // Extracted PPTX metadata
    title?: string;
    author?: string;
    created?: string;
    modified?: string;
    stats?: { slide_count: number; image_count: number };
    // User-editable metadata
    description?: string;
    // Organization
    collectionId?: string | null;
    folderId?: string | null;
    tagIds?: string[];
}

// --- BYOK and Prompt Management ---
export const getStoredApiKey = () => localStorage.getItem('gemini_api_key') || '';
export const setStoredApiKey = (key: string) => localStorage.setItem('gemini_api_key', key);

// --- Model Selection ---
export const getStoredModel = () => localStorage.getItem('gemini_model') || '';
export const setStoredModel = (model: string) => localStorage.setItem('gemini_model', model);

export const DEFAULT_PROMPTS = {
    analyze: `Analyze the following slide data from a learning module.
Provide:
1. A concise interpretation of the slide's educational purpose.
2. Three specific suggestions for improvement (pedagogical or clarity-wise).

Slide Data:
{{SLIDE_DATA}}

Return the result as a clean text.`,
    fix: `You are an expert OCR and instructional design agent. 
Attached is a screenshot of a PowerPoint slide. 
Below is the current semantic JSON extraction of that slide.

TASK:
1. Compare the image with the JSON.
2. Identify any missing text, misordered elements, or incorrect semantic types.
3. Suggest a corrected "content" array for the JSON that perfectly matches the image.

Current JSON Content:
{{CURRENT_JSON}}

Output only the suggested "content" array in valid JSON format.`
};

export const getStoredPrompt = (type: 'analyze' | 'fix') => localStorage.getItem(`prompt_${type}`) || DEFAULT_PROMPTS[type];
export const setStoredPrompt = (type: 'analyze' | 'fix', prompt: string) => localStorage.setItem(`prompt_${type}`, prompt);

// --- API Instance with interceptors for BYOK ---
const api = axios.create({
    baseURL: API_URL
});

api.interceptors.request.use((config) => {
    const key = getStoredApiKey();
    if (key) {
        config.headers['x-gemini-key'] = key;
    }
    const model = getStoredModel();
    if (model) {
        config.headers['x-gemini-model'] = model;
    }
    return config;
});

// --- API Functions ---

export interface UploadOptions {
    generateScreenshots?: boolean;
    collectionId?: string | null;
    folderId?: string | null;
}

export const uploadFile = async (file: File, options?: UploadOptions) => {
    const formData = new FormData();
    formData.append('file', file);
    if (options?.generateScreenshots) {
        formData.append('generateScreenshots', 'true');
    }
    if (options?.collectionId) {
        formData.append('collectionId', options.collectionId);
    }
    if (options?.folderId) {
        formData.append('folderId', options.folderId);
    }
    const res = await api.post(`/upload`, formData);
    return res.data;
};

export type BatchUploadStatus = 'queued' | 'uploading' | 'processing' | 'completed' | 'failed';

export interface BatchUploadProgress {
    fileId: string;
    filename: string;
    status: BatchUploadStatus;
    presentationId?: string;
    error?: string;
}

export interface BatchUploadResult {
    ids: string[];
    filenames: string[];
}

/**
 * Upload multiple files sequentially with progress callbacks
 */
export const uploadFiles = async (
    files: File[],
    options: UploadOptions,
    onProgress?: (progress: BatchUploadProgress[]) => void
): Promise<BatchUploadResult> => {
    const result: BatchUploadResult = { ids: [], filenames: [] };
    const progress: BatchUploadProgress[] = files.map((f, i) => ({
        fileId: `file-${i}`,
        filename: f.name,
        status: 'queued' as BatchUploadStatus
    }));

    for (let i = 0; i < files.length; i++) {
        progress[i].status = 'uploading';
        onProgress?.([...progress]);

        try {
            const res = await uploadFile(files[i], options);
            progress[i].status = 'processing';
            progress[i].presentationId = res.id;
            result.ids.push(res.id);
            result.filenames.push(files[i].name);
        } catch (e) {
            progress[i].status = 'failed';
            progress[i].error = e instanceof Error ? e.message : 'Upload failed';
        }
        onProgress?.([...progress]);
    }

    return result;
};

export const checkStatus = async (id: string) => {
    const res = await api.get(`/status/${id}`);
    return res.data;
};

export const getPresentation = async (id: string, resultId: string) => {
    const res = await api.get(`/view/${id}/${resultId}`);
    return res.data;
};

export const savePresentation = async (id: string, resultId: string, data: any) => {
    const res = await api.put(`/view/${id}/${resultId}`, data);
    return res.data;
};

export const reprocessPresentation = async (id: string) => {
    const res = await api.post(`/reprocess/${id}`);
    return res.data;
};

export const deletePresentation = async (id: string) => {
    const res = await api.delete(`/presentations/${id}`);
    return res.data;
};

export interface UpdatePresentationData {
    originalName?: string;
    description?: string;
    collectionId?: string | null;
    folderId?: string | null;
    tagIds?: string[];
}

export const updatePresentation = async (id: string, data: UpdatePresentationData) => {
    const res = await api.patch(`/presentations/${id}`, data);
    return res.data;
};

export interface BatchUpdateData {
    collectionId?: string | null;
    folderId?: string | null;
    preserveTags?: boolean;
}

export interface BatchUpdateResult {
    results: Array<{ id: string; success: boolean; error?: string }>;
}

export const batchUpdatePresentations = async (
    ids: string[],
    updates: BatchUpdateData
): Promise<BatchUpdateResult> => {
    const res = await api.patch(`/presentations/batch`, { ids, updates });
    return res.data;
};

export const getManagedPresentations = async (): Promise<ManagedPresentation[]> => {
    const res = await api.get(`/presentations`);
    return res.data;
};

// --- Collections ---

export const getCollections = async (): Promise<Collection[]> => {
    const res = await api.get(`/collections`);
    return res.data;
};

export const createCollection = async (name: string, description?: string, color?: string): Promise<Collection> => {
    const res = await api.post(`/collections`, { name, description, color });
    return res.data;
};

export const updateCollection = async (id: string, data: { name?: string; description?: string; color?: string }): Promise<Collection> => {
    const res = await api.patch(`/collections/${id}`, data);
    return res.data;
};

export const deleteCollection = async (id: string) => {
    const res = await api.delete(`/collections/${id}`);
    return res.data;
};

// --- Folders ---

export const getFolders = async (collectionId: string): Promise<Folder[]> => {
    const res = await api.get(`/collections/${collectionId}/folders`);
    return res.data;
};

export const createFolder = async (collectionId: string, name: string, parentId?: string | null): Promise<Folder> => {
    const res = await api.post(`/collections/${collectionId}/folders`, { name, parentId });
    return res.data;
};

export const updateFolder = async (id: string, data: { name?: string; parentId?: string | null; order?: number }): Promise<Folder> => {
    const res = await api.patch(`/folders/${id}`, data);
    return res.data;
};

export const deleteFolder = async (id: string) => {
    const res = await api.delete(`/folders/${id}`);
    return res.data;
};

// --- Tags ---

export const getTags = async (collectionId: string): Promise<Tag[]> => {
    const res = await api.get(`/collections/${collectionId}/tags`);
    return res.data;
};

export const createTag = async (collectionId: string, name: string, color?: string): Promise<Tag> => {
    const res = await api.post(`/collections/${collectionId}/tags`, { name, color });
    return res.data;
};

export const updateTag = async (id: string, data: { name?: string; color?: string }): Promise<Tag> => {
    const res = await api.patch(`/tags/${id}`, data);
    return res.data;
};

export const deleteTag = async (id: string) => {
    const res = await api.delete(`/tags/${id}`);
    return res.data;
};

// --- Slides (Phase 2: Slide Library) ---

export interface Slide {
    id: string;
    sourceId: string;
    sourceSlideOrder: number;
    title: string;
    status: 'promoted';
    lastModified: string;
    contentPath: string | null;
    tagIds: string[];
    starred: boolean;
    notes: string;
    metadata: {
        layout: string;
        hasScreenshot: boolean;
        contentTypes: string[];
        wordCount: number;
    };
    screenshotUrl?: string | null;
}

export interface SlideFilters {
    sourceId?: string;
    tagId?: string;
    starred?: boolean;
    search?: string;
}

export interface PresentationSlide {
    slideOrder: number;
    title: string;
    layout: string;
    sectionTitle: string;
    hasScreenshot: boolean;
    screenshotUrl: string | null;
    contentTypes: string[];
    wordCount: number;
    promoted: boolean;
    promotedSlideId: string | null;
}

export interface PresentationSlidesResponse {
    sourceId: string;
    originalName: string;
    totalSlides: number;
    promotedCount: number;
    slides: PresentationSlide[];
}

export interface SlidePromoteData {
    slideOrder: number;
    title?: string;
    layout?: string;
    hasScreenshot?: boolean;
    contentTypes?: string[];
    wordCount?: number;
}

// Get all promoted slides with optional filters
export const getSlides = async (filters?: SlideFilters): Promise<Slide[]> => {
    const params = new URLSearchParams();
    if (filters?.sourceId) params.append('sourceId', filters.sourceId);
    if (filters?.tagId) params.append('tagId', filters.tagId);
    if (filters?.starred !== undefined) params.append('starred', String(filters.starred));
    if (filters?.search) params.append('search', filters.search);

    const res = await api.get(`/slides?${params.toString()}`);
    return res.data;
};

// Get a single slide by ID
export const getSlideById = async (id: string): Promise<Slide> => {
    const res = await api.get(`/slides/${id}`);
    return res.data;
};

// Get slide content (for editing)
export const getSlideContent = async (id: string): Promise<any> => {
    const res = await api.get(`/slides/${id}/content`);
    return res.data;
};

// Save edited slide content
export const saveSlideContent = async (id: string, content: any): Promise<Slide> => {
    const res = await api.put(`/slides/${id}/content`, content);
    return res.data;
};

// Update slide metadata (tags, starred, notes, title)
export const updateSlide = async (id: string, data: {
    title?: string;
    tagIds?: string[];
    starred?: boolean;
    notes?: string;
}): Promise<Slide> => {
    const res = await api.patch(`/slides/${id}`, data);
    return res.data;
};

// Delete a promoted slide
export const deleteSlide = async (id: string): Promise<{ success: boolean; id: string }> => {
    const res = await api.delete(`/slides/${id}`);
    return res.data;
};

// Get all slides from a presentation (for promotion UI)
export const getPresentationSlides = async (presentationId: string): Promise<PresentationSlidesResponse> => {
    const res = await api.get(`/presentations/${presentationId}/slides`);
    return res.data;
};

// Promote slides from a presentation to the library
export const promoteSlides = async (sourceId: string, slides: SlidePromoteData[]): Promise<Slide[]> => {
    const res = await api.post(`/slides/promote`, { sourceId, slides });
    return res.data;
};

// Demote a slide (remove from library)
export const demoteSlide = async (id: string): Promise<{ success: boolean; id: string }> => {
    const res = await api.post(`/slides/${id}/demote`);
    return res.data;
};

// Bulk add/remove tags from slides
export const bulkTagSlides = async (slideIds: string[], tagId: string, action: 'add' | 'remove'): Promise<{ success: boolean }> => {
    const res = await api.post(`/slides/bulk-tag`, { slideIds, tagId, action });
    return res.data;
};

// --- AI Functions ---

export interface ModelInfo {
    name: string;
    description: string;
}

export interface ModelsResponse {
    models: Record<string, ModelInfo>;
    default: string;
}

export const getAvailableModels = async (): Promise<ModelsResponse> => {
    const res = await api.get(`/ai/models`);
    return res.data;
};

export const analyzeSlide = async (slide: any, prompt?: string) => {
    const res = await api.post(`/ai/analyze`, { slide, prompt });
    return res.data;
};

export const fixWithScreenshot = async (screenshot: File, currentJson: any, prompt?: string) => {
    const formData = new FormData();
    formData.append('screenshot', screenshot);
    formData.append('currentJson', JSON.stringify(currentJson));
    if (prompt) formData.append('prompt', prompt);
    const res = await api.post(`/ai/fix`, formData);
    return res.data;
};

// Semantic Conversion - Transform screenshot + raw extraction into semantic content
export const semanticConvert = async (screenshot: File, rawExtraction: any) => {
    const formData = new FormData();
    formData.append('screenshot', screenshot);
    formData.append('rawExtraction', JSON.stringify(rawExtraction));
    const res = await api.post(`/ai/convert`, formData);
    return res.data;
};

// --- Screenshot Functions ---

export interface ScreenshotsStatus {
    hasScreenshots: boolean;
    count: number;
    screenshots: string[];
}

export const getScreenshotsStatus = async (id: string): Promise<ScreenshotsStatus> => {
    const res = await api.get(`/screenshots/${id}`);
    return res.data;
};

export const generateScreenshots = async (id: string) => {
    const res = await api.post(`/generate-screenshots/${id}`);
    return res.data;
};

export const getScreenshotUrl = (id: string, slideNumber: number) => {
    return `/media/${id}/screenshots/slide_${String(slideNumber).padStart(4, '0')}.png`;
};

// --- Utilities ---
export const getMediaUrl = (conversionId: string, pathOrUrl: string) => {
    return `/media/${conversionId}/${pathOrUrl}`;
};

// --- Settings & Git Sync ---

export interface GitSyncSettings {
    enabled: boolean;
    autoCommit: boolean;
    autoPush: boolean;
    commitMessage: string;
    remote: string;
    branch: string;
}

export interface AppSettings {
    dataPath: string | null;
    gitSync: GitSyncSettings;
    resolvedPaths: {
        basePath: string;
        uploadsPath: string;
        storagePath: string;
        dataJsonPath: string;
    };
    isGitRepo: boolean;
}

export interface GitStatus {
    enabled: boolean;
    isRepo?: boolean;
    branch?: string;
    hasRemote?: boolean;
    hasChanges?: boolean;
    changes?: string[];
    reason?: string;
}

export const getSettings = async (): Promise<AppSettings> => {
    const res = await api.get(`/settings`);
    return res.data;
};

export const updateSettings = async (settings: { dataPath?: string | null; gitSync?: Partial<GitSyncSettings> }): Promise<{ success: boolean; config: AppSettings }> => {
    const res = await api.post(`/settings`, settings);
    return res.data;
};

export const getGitStatus = async (): Promise<GitStatus> => {
    const res = await api.get(`/settings/git-status`);
    return res.data;
};

export const initGitRepo = async (): Promise<{ success: boolean; message?: string; error?: string }> => {
    const res = await api.post(`/settings/git-init`);
    return res.data;
};

export const addGitRemote = async (name: string, url: string): Promise<{ success: boolean; error?: string }> => {
    const res = await api.post(`/settings/git-remote`, { name, url });
    return res.data;
};

export const manualGitSync = async (message?: string): Promise<{ commit: any; push: any }> => {
    const res = await api.post(`/settings/git-sync`, { message });
    return res.data;
};

export const gitPush = async (): Promise<{ success: boolean; error?: string }> => {
    const res = await api.post(`/settings/git-push`);
    return res.data;
};

export const cloneGitRepo = async (url: string, targetPath: string): Promise<{ success: boolean; error?: string }> => {
    const res = await api.post(`/settings/git-clone`, { url, path: targetPath });
    return res.data;
};
