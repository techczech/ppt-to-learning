const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

// Timeout in milliseconds for API calls (90 seconds)
const API_TIMEOUT_MS = 90000;

/**
 * Wrap a promise with a timeout.
 * @param {Promise} promise - The promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @param {string} operation - Description of the operation for error message
 */
function withTimeout(promise, ms, operation = 'API call') {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error(`${operation} timed out after ${ms / 1000} seconds`));
        }, ms);

        promise
            .then((result) => {
                clearTimeout(timeoutId);
                resolve(result);
            })
            .catch((error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
    });
}

// Available Gemini models - updated December 2025
// See: https://ai.google.dev/gemini-api/docs/models
const AVAILABLE_MODELS = {
    "gemini-3-flash-preview": { name: "Gemini 3 Flash", description: "Latest flash model (recommended)" },
    "gemini-3-pro-preview": { name: "Gemini 3 Pro", description: "Most capable reasoning model" },
    "gemini-2.5-flash": { name: "Gemini 2.5 Flash", description: "Stable, fast and efficient" },
    "gemini-2.5-flash-lite": { name: "Gemini 2.5 Flash Lite", description: "Lightweight, fastest, lowest cost" },
    "gemini-2.5-pro": { name: "Gemini 2.5 Pro", description: "Stable pro with adaptive thinking" },
    "gemini-2.0-flash": { name: "Gemini 2.0 Flash", description: "Previous generation flash" },
    "gemini-2.0-flash-lite": { name: "Gemini 2.0 Flash Lite", description: "Previous generation lite" }
};

const DEFAULT_MODEL = "gemini-3-flash-preview";

function getModel(userKey, modelName = DEFAULT_MODEL) {
    const key = userKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error("No Gemini API Key provided.");
    const genAI = new GoogleGenerativeAI(key);
    // Use provided model or fall back to default
    const model = AVAILABLE_MODELS[modelName] ? modelName : DEFAULT_MODEL;
    return genAI.getGenerativeModel({ model });
}

function getAvailableModels() {
    return { models: AVAILABLE_MODELS, default: DEFAULT_MODEL };
}

/**
 * Extract all images/icons from raw extraction content.
 * Recursively collects images from nested structures like SmartArt.
 */
function extractImageList(rawExtraction) {
    const images = [];
    const content = rawExtraction.content || rawExtraction;

    if (!Array.isArray(content)) return images;

    function collectFromBlock(block) {
        if (!block || typeof block !== 'object') return;

        // Direct image blocks
        if (block.type === 'image' && block.src) {
            images.push({ src: block.src, alt: block.alt || 'Image' });
        }

        // SmartArt nodes may have icons
        if (block.type === 'smart_art' && block.nodes) {
            collectFromNodes(block.nodes);
        }

        // Check for nested content arrays
        if (Array.isArray(block.content)) {
            block.content.forEach(collectFromBlock);
        }
    }

    function collectFromNodes(nodes) {
        if (!Array.isArray(nodes)) return;
        for (const node of nodes) {
            if (node.icon) {
                images.push({ src: node.icon, alt: node.text || 'Icon' });
            }
            if (node.image) {
                images.push({ src: node.image, alt: node.text || 'Image' });
            }
            // Recurse into child nodes
            if (node.children) {
                collectFromNodes(node.children);
            }
        }
    }

    content.forEach(collectFromBlock);
    return images;
}

// Simple prompt for semantic conversion - no schema constraint
const SEMANTIC_PROMPT = `
Analyze this slide screenshot and convert it to semantic learning content.

Current extracted content (may be incomplete or in wrong order):
{{RAW_EXTRACTION}}

Available images/icons extracted from this slide:
{{IMAGE_LIST}}

TASK: Look at the VISUAL LAYOUT to understand how content is organized:
- What groups exist? (identified by position, color, icons, visual containers)
- What is the relationship between groups? (comparison, sequence, hierarchy)
- What visual cues convey meaning? (cyclic icons = repetition, arrows = sequence, columns = comparison)

IMAGES: If images/icons from the list above are semantically relevant:
- Include them in the appropriate content blocks using the "icon" field
- Use the exact "src" path from the image list
- Icons can be added to: comparison groups, sequence steps, list items
- Use "image" type for standalone images that need to be preserved
- Only include images that add meaning - decorative images can be omitted

OUTPUT: Return ONLY valid JSON (no markdown, no explanation) in this exact format:

{
  "title": "slide title if visible",
  "summary": "one sentence describing what this slide teaches",
  "semantic_type": "comparison|sequence|definition|list|mixed",
  "content": [
    // For COMPARISON (side-by-side groups with optional icons):
    {
      "type": "comparison",
      "description": "what is being compared",
      "groups": [
        { "label": "Group 1 name", "icon": "path/to/icon.png", "visual_cue": "what marks this group", "items": ["item 1", "item 2"] },
        { "label": "Group 2 name", "visual_cue": "what marks this group", "items": ["item 1", "item 2"] }
      ]
    },
    // For SEQUENCE (ordered steps with optional icons):
    {
      "type": "sequence",
      "description": "what process this shows",
      "steps": [
        { "step": 1, "icon": "path/to/icon.png", "text": "First step" },
        { "step": 2, "text": "Second step" }
      ]
    },
    // For DEFINITION:
    { "type": "definition", "term": "word", "definition": "meaning", "examples": ["ex1"] },
    // For simple LIST (items can have icons):
    { "type": "list", "items": [{ "text": "item 1", "icon": "path/to/icon.png" }, "item 2"] },
    // For HEADING:
    { "type": "heading", "text": "Section title", "level": 1 },
    // For PARAGRAPH:
    { "type": "paragraph", "text": "Body text content" },
    // For standalone IMAGE:
    { "type": "image", "src": "path/to/image.png", "alt": "Description", "placement": "inline" }
  ]
}

CRITICAL: Preserve ALL text from the slide in the original language. Do not translate.
Keep responses concise - focus on the actual slide content, not lengthy descriptions.
`;

/**
 * Extract JSON from model response, handling markdown fences and edge cases.
 */
function extractJSON(text) {
    let cleaned = text.trim();

    // Remove markdown code fences if present
    cleaned = cleaned.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');

    // Try direct parse first
    try {
        return JSON.parse(cleaned);
    } catch (e) {
        console.log('[AI] Direct parse failed, trying regex extraction...');
    }

    // Extract JSON object with regex
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
        try {
            return JSON.parse(match[0]);
        } catch (e) {
            console.log('[AI] Regex extraction failed:', e.message);
        }
    }

    throw new Error('Could not parse response as JSON. The model may have returned invalid output. Try a different model.');
}

/**
 * Interpret slide content and suggest improvements.
 */
async function analyzeSlide(slideData, userKey, customPrompt) {
    const model = getModel(userKey);
    
    // Default fallback if no custom prompt provided
    const defaultPrompt = `
        Analyze the following slide data from a learning module.
        Provide:
        1. A concise interpretation of the slide's educational purpose.
        2. Three specific suggestions for improvement (pedagogical or clarity-wise).
        
        Slide Data:
        ${JSON.stringify(slideData, null, 2)}
        
        Return the result as a clean text.
    `;

    let finalPrompt = defaultPrompt;
    if (customPrompt) {
        finalPrompt = customPrompt.replace('{{SLIDE_DATA}}', JSON.stringify(slideData, null, 2));
    }

    const result = await withTimeout(
        model.generateContent(finalPrompt),
        API_TIMEOUT_MS,
        'Slide analysis'
    );
    const response = await result.response;
    return response.text();
}

/**
 * Compare a screenshot with existing JSON and suggest fixes.
 */
async function fixWithScreenshot(screenshotBuffer, mimeType, currentJson, userKey, customPrompt) {
    const model = getModel(userKey);
    
    const defaultPrompt = `
        You are an expert OCR and instructional design agent. 
        Attached is a screenshot of a PowerPoint slide. 
        Below is the current semantic JSON extraction of that slide.
        
        TASK:
        1. Compare the image with the JSON.
        2. Identify any missing text, misordered elements, or incorrect semantic types.
        3. Suggest a corrected "content" array for the JSON that perfectly matches the image.
        
        Current JSON Content:
        ${JSON.stringify(currentJson.content, null, 2)}
        
        Output only the suggested "content" array in valid JSON format.
    `;

    let finalPrompt = defaultPrompt;
    if (customPrompt) {
        finalPrompt = customPrompt.replace('{{CURRENT_JSON}}', JSON.stringify(currentJson.content, null, 2));
    }

    const imagePart = {
        inlineData: {
            data: screenshotBuffer.toString("base64"),
            mimeType
        }
    };

    const result = await withTimeout(
        model.generateContent([finalPrompt, imagePart]),
        API_TIMEOUT_MS,
        'Screenshot comparison'
    );
    const response = await result.response;
    const text = response.text();

    // Extract JSON block if LLM included markdown
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(text);
}

/**
 * Convert a slide screenshot + raw extraction into semantic content.
 * This is the core function for transforming visual slide layouts into meaningful structured content.
 */
async function semanticConvert(screenshotBuffer, mimeType, rawExtraction, userKey, modelName = DEFAULT_MODEL) {
    const key = userKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error("No Gemini API Key provided.");

    const genAI = new GoogleGenerativeAI(key);
    const selectedModel = AVAILABLE_MODELS[modelName] ? modelName : DEFAULT_MODEL;

    console.log(`[AI] Semantic conversion with model: ${selectedModel}`);
    console.log(`[AI] Image size: ${screenshotBuffer.length} bytes, type: ${mimeType}`);

    // NO responseSchema - let the model generate freely to avoid truncation/hallucination issues
    const model = genAI.getGenerativeModel({ model: selectedModel });

    // Extract images/icons from raw extraction to inform the AI
    const imageList = extractImageList(rawExtraction);
    const imageListStr = imageList.length > 0
        ? imageList.map(img => `- ${img.src} (${img.alt})`).join('\n')
        : '(no images found)';

    console.log(`[AI] Found ${imageList.length} images/icons in extraction`);

    const prompt = SEMANTIC_PROMPT
        .replace('{{RAW_EXTRACTION}}', JSON.stringify(rawExtraction.content || rawExtraction, null, 2))
        .replace('{{IMAGE_LIST}}', imageListStr);

    console.log(`[AI] Prompt length: ${prompt.length} chars`);

    const imagePart = {
        inlineData: {
            data: screenshotBuffer.toString("base64"),
            mimeType
        }
    };

    try {
        console.log(`[AI] Sending request to Gemini API (timeout: ${API_TIMEOUT_MS / 1000}s)...`);
        const result = await withTimeout(
            model.generateContent([prompt, imagePart]),
            API_TIMEOUT_MS,
            'Semantic conversion'
        );
        const response = await result.response;
        const text = response.text();
        console.log(`[AI] Response received, length: ${text.length} chars`);

        // Use lenient JSON extraction
        return extractJSON(text);
    } catch (error) {
        console.error(`[AI] Gemini API error:`, error.message);
        if (error.message?.includes('fetch failed')) {
            throw new Error(`Network error calling Gemini API. Check your internet connection and API key.`);
        }
        if (error.status === 404) {
            throw new Error(`Model "${selectedModel}" not found. Try a different model in Settings.`);
        }
        throw error;
    }
}

module.exports = { analyzeSlide, fixWithScreenshot, semanticConvert, getAvailableModels };