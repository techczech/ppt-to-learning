import axios from 'axios';

const API_URL = '/api';

// --- Types ---
export interface LegacyFile {
    id: string;
    filename: string;
}

export interface ManagedPresentation {
    id: string;
    filename: string;
    originalName: string;
    uploadedAt: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    resultId?: string;
}

// --- BYOK and Prompt Management ---
export const getStoredApiKey = () => localStorage.getItem('gemini_api_key') || '';
export const setStoredApiKey = (key: string) => localStorage.setItem('gemini_api_key', key);

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
    return config;
});

// --- API Functions ---

export const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post(`/upload`, formData);
    return res.data;
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

export const getManagedPresentations = async (): Promise<ManagedPresentation[]> => {
    const res = await api.get(`/presentations`);
    return res.data;
};

export const getLegacyFiles = async (): Promise<LegacyFile[]> => {
    const res = await api.get(`/legacy/list`);
    return res.data;
};

export const getLegacyPresentation = async (id: string) => {
    const res = await api.get(`/legacy/view/${id}`);
    return res.data;
};

// --- AI Functions ---

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

// --- Utilities ---
export const getMediaUrl = (conversionId: string, pathOrUrl: string) => {
    if (conversionId === 'legacy') {
        const cleanPath = pathOrUrl.startsWith('media/') ? pathOrUrl.substring(6) : pathOrUrl;
        return `/legacy-media/${cleanPath}`;
    }
    return `/media/${conversionId}/${pathOrUrl}`;
};
