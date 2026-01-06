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
const IMAGE_MODEL = "gemini-3-pro-image-preview";

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

// Additional instructions when "Preserve visual patterns" is enabled
const VISUAL_PATTERN_INSTRUCTIONS = `

VISUAL PATTERN REPRODUCTION (REQUIRED):
In addition to semantic conversion, you MUST reproduce any visual patterns visible in the screenshot:
- If there are icon sequences or patterns (like repeated symbols with variations), recreate them
- Use emoji or Unicode symbols to represent visual elements: ● ○ ◆ ◇ ■ □ ▶ ▷ 🔴 ⚪ 🟢 ⬛ ⬜
- Preserve the visual rhythm and spacing of patterns
- Include a "visual_pattern" block type to show the pattern

Example - for a rhythm pattern with large/small drums:
{
  "type": "visual_pattern",
  "description": "Stress pattern visualization",
  "rows": [
    "🔴 ⚪ 🔴 ⚪ 🔴 ⚪ 🔴",
    "🔴 ⚪ ⚪ ⚪ 🔴 ⚪ ⚪ ⚪ 🔴 ⚪ ⚪ ⚪ 🔴"
  ],
  "legend": "🔴 = stressed/large, ⚪ = unstressed/small",
  "labels": ["Pattern 1: Simple", "Pattern 2: Compressed"]
}

Visual pattern output format:
{
  "type": "visual_pattern",
  "description": "what the pattern represents",
  "rows": ["row 1 symbols", "row 2 symbols"],  // each row is a string of symbols
  "legend": "symbol meanings",
  "labels": ["label for row 1", "label for row 2"]  // optional labels
}

IMPORTANT: Look at the screenshot carefully. If you see repeated visual elements forming a pattern, you MUST include a visual_pattern block to reproduce it.
`;

// Lucide icons catalog for AI to use when generating icons
const LUCIDE_ICONS_CATALOG = `
AVAILABLE LUCIDE ICONS:
Use these icons by specifying "lucide:IconName" format in the icon field.

CATEGORIES & ICONS:
- Actions: Check, X, Plus, Minus, Edit, Pencil, Trash2, Save, Download, Upload, RefreshCw, Search, Eye, EyeOff, Copy, Clipboard
- Arrows: ArrowRight, ArrowLeft, ArrowUp, ArrowDown, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, ArrowRightCircle, MoveRight, CornerDownRight
- Communication: Mail, MessageCircle, MessageSquare, Phone, Send, Bell, Megaphone, AtSign, Share2
- Files: File, FileText, Folder, FolderOpen, Clipboard, Book, BookOpen, FileCheck, FileX, FilePlus, Archive
- Media: Image, Camera, Video, Music, Play, Pause, Volume2, Mic, Film, Headphones
- People: User, Users, UserPlus, UserCheck, UserX, Heart, ThumbsUp, ThumbsDown, Smile, Frown, Meh
- Objects: Home, Building, Building2, Car, Plane, Globe, Globe2, Map, MapPin, Calendar, Clock, Watch, Key, Lock, Unlock, Gift, ShoppingCart, ShoppingBag
- Shapes: Circle, Square, Triangle, Star, Hexagon, Pentagon, Diamond, Octagon
- Status: AlertCircle, AlertTriangle, Info, HelpCircle, CheckCircle, CheckCircle2, XCircle, XOctagon, Loader, Loader2, Ban
- Nature: Sun, Moon, Cloud, CloudRain, Zap, Flame, Leaf, TreeDeciduous, TreePine, Flower, Flower2, Bug, Bird
- Technology: Laptop, Smartphone, Monitor, Cpu, Database, Server, Wifi, Bluetooth, Code, Terminal, HardDrive, Printer, Mouse, Keyboard
- Money: DollarSign, CreditCard, Wallet, PiggyBank, Receipt, Banknote, Coins, TrendingUp, TrendingDown, BarChart, PieChart
- Education: GraduationCap, BookOpen, Lightbulb, Pencil, PenTool, Ruler, Calculator, School, Library, Brain
- Sports: Trophy, Medal, Target, Dumbbell, Bike, Mountain
- Science: Beaker, FlaskConical, Atom, Microscope, Dna, TestTube, Stethoscope
- Food: Coffee, Pizza, Apple, Cookie, Utensils, UtensilsCrossed, Wine, Beer, Cake, IceCream
- Medical: Heart, HeartPulse, Activity, Stethoscope, Pill, Syringe, Thermometer, Ambulance, Hospital
- Tools: Wrench, Hammer, Scissors, PaintBrush, Brush, Ruler, Settings, Cog, SlidersHorizontal
- Misc: Flag, Bookmark, Tag, Tags, Paperclip, Link, Link2, ExternalLink, QrCode, Fingerprint, Shield, ShieldCheck
`;

const LUCIDE_ICON_INSTRUCTIONS = `

LUCIDE ICONS (REQUIRED):
You MUST add appropriate Lucide icons to enhance the semantic content:
1. For LIST items: Add an icon field using "lucide:IconName" format based on the item's meaning
2. For COMPARISON groups: Add an icon to each group that represents its category
3. For SEQUENCE steps: Add an icon that represents each action or concept
4. Choose icons that semantically match the content meaning

${LUCIDE_ICONS_CATALOG}

ICON FORMAT:
Use the format "lucide:IconName" exactly, for example:
- "icon": "lucide:Check" for checkmarks/success
- "icon": "lucide:AlertTriangle" for warnings
- "icon": "lucide:BookOpen" for educational content
- "icon": "lucide:ArrowRight" for progression/next steps

ICON SELECTION GUIDELINES:
- Match the icon to the semantic meaning of the content
- Use consistent icons for similar concepts within the same slide
- Prefer simple, recognizable icons over obscure ones
- If an existing image icon path is present and meaningful, you can either:
  a) Keep the original image path (like "media/icon.png")
  b) Replace it with "lucide:IconName" if a Lucide icon better represents the concept
- Add icons even to items that don't have them, when appropriate

EXAMPLES:
- Benefits list → use "lucide:CheckCircle" or "lucide:ThumbsUp"
- Warnings/risks → use "lucide:AlertTriangle" or "lucide:AlertCircle"
- Steps in a process → use "lucide:ArrowRight", "lucide:Play", or contextual icons
- Categories being compared → use icons that represent each category's concept
`;

// Context slides prompt template - explains surrounding slides to the AI
const CONTEXT_SLIDES_PROMPT = `

CONTEXT SLIDES:
You are provided with context from surrounding slides to help understand relationships and narrative flow.
This slide is part of a sequence - it does NOT stand alone.

{{CONTEXT_BEFORE}}

>>> CURRENT SLIDE (the one you are converting) <<<

{{CONTEXT_AFTER}}

Use this context to:
1. Understand how this slide relates to previous topics
2. Recognize continuation of themes, definitions, or examples
3. Identify if this slide is a conclusion, expansion, or introduction of a topic
4. Maintain consistency in terminology and concepts
5. Understand progressive disclosure patterns (e.g., slides that build on each other)

CRITICAL: Only output content for the CURRENT SLIDE being converted, not the context slides.
The context is just to inform your understanding of relationships and flow.
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
 * Generate an alternative image based on an existing image and context.
 * Uses the gemini-3-pro-image-preview model for image generation.
 * @param {Buffer} imageBuffer - Original image buffer
 * @param {string} mimeType - Image MIME type
 * @param {string} context - Context about what the image should represent
 * @param {string} userKey - Optional Gemini API key
 * @returns {Promise<{buffer: Buffer, mimeType: string} | null>} Generated image or null if failed
 */
async function generateAlternativeImage(imageBuffer, mimeType, context, userKey) {
    const key = userKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error("No Gemini API Key provided.");

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: IMAGE_MODEL });

    const prompt = `Based on this image and the following context, generate an improved or alternative educational illustration.

Context: ${context}

Requirements:
- Create a clear, professional image suitable for learning materials
- Maintain the educational intent of the original
- Use clean, simple graphics that are easy to understand
- If the original has text, do NOT include text in the generated image`;

    console.log(`[AI] Generating alternative image with context: ${context.substring(0, 100)}...`);

    try {
        const result = await withTimeout(
            model.generateContent([
                prompt,
                {
                    inlineData: {
                        data: imageBuffer.toString('base64'),
                        mimeType
                    }
                }
            ]),
            API_TIMEOUT_MS * 2, // Image generation may take longer
            'Image generation'
        );

        const response = await result.response;

        // Check if the response contains an image
        if (response.candidates && response.candidates[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    console.log(`[AI] Generated image: ${part.inlineData.mimeType}`);
                    return {
                        buffer: Buffer.from(part.inlineData.data, 'base64'),
                        mimeType: part.inlineData.mimeType
                    };
                }
            }
        }

        console.log('[AI] No image in response');
        return null;
    } catch (error) {
        console.error('[AI] Image generation failed:', error.message);
        return null;
    }
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
 * @param {Buffer} screenshotBuffer - Screenshot image data
 * @param {string} mimeType - Screenshot MIME type
 * @param {Object} rawExtraction - Raw extraction JSON from the slide
 * @param {string} userKey - Optional Gemini API key
 * @param {string} modelName - Model to use
 * @param {Array} mediaFiles - Optional array of {path, buffer, mimeType} for slide media
 * @param {string} additionalPrompt - Optional additional instructions from user
 * @param {boolean} preserveVisuals - Whether to preserve visual patterns
 * @param {boolean} generateImages - Whether to generate alternative images
 * @param {string} storageDir - Directory to save generated images
 * @param {boolean} useLucideIcons - Whether to add Lucide icons to content
 * @param {Object} contextSlides - Context slides metadata {before: [], after: []}
 * @param {Array} contextScreenshots - Array of {position, order, buffer, mimeType} for context screenshots
 */
async function semanticConvert(screenshotBuffer, mimeType, rawExtraction, userKey, modelName = DEFAULT_MODEL, mediaFiles = [], additionalPrompt = '', preserveVisuals = false, generateImages = false, storageDir = null, useLucideIcons = false, contextSlides = null, contextScreenshots = []) {
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

    // Build additional prompt section when media files are included
    let attachedImagesSection = '';
    if (mediaFiles.length > 0) {
        attachedImagesSection = `\n\nATTACHED IMAGES: The following ${mediaFiles.length} images from this slide are attached and you can see them:\n` +
            mediaFiles.map((m, i) => `- Image ${i + 2}: ${m.path}`).join('\n') +
            '\n\nFor each attached image:\n' +
            '1. Note the file name (e.g., media/image1.png) and use this exact path in the output\n' +
            '2. Position the image in the correct semantic location based on where it appears in the slide screenshot\n' +
            '3. Generate descriptive alt text based on what you actually see in the image\n' +
            '4. If the image contains text (labels, captions, titles), extract that text and include it in a semantically linked field (e.g., "label", "caption", or within the parent structure\'s text fields)\n' +
            '5. Match each image to its logical place in comparisons, sequences, or other semantic structures';
    }

    // Build visual pattern instructions section
    let visualInstructionsSection = '';
    if (preserveVisuals) {
        visualInstructionsSection = VISUAL_PATTERN_INSTRUCTIONS;
        console.log(`[AI] Visual pattern preservation enabled`);
    }

    // Build Lucide icon instructions section
    let lucideInstructionsSection = '';
    if (useLucideIcons) {
        lucideInstructionsSection = LUCIDE_ICON_INSTRUCTIONS;
        console.log(`[AI] Lucide icon mode enabled`);
    }

    // Build context slides section
    let contextSection = '';
    if (contextSlides && (contextSlides.before?.length > 0 || contextSlides.after?.length > 0)) {
        let beforeText = '';
        let afterText = '';

        if (contextSlides.before?.length > 0) {
            beforeText = 'SLIDES BEFORE (shown earlier):\n' + contextSlides.before.map(s =>
                `  - Slide ${s.order}: "${s.title}" - ${s.contentSummary}`
            ).join('\n');
        } else {
            beforeText = '(This is the first slide or no context before)';
        }

        if (contextSlides.after?.length > 0) {
            afterText = 'SLIDES AFTER (shown later):\n' + contextSlides.after.map(s =>
                `  - Slide ${s.order}: "${s.title}" - ${s.contentSummary}`
            ).join('\n');
        } else {
            afterText = '(This is the last slide or no context after)';
        }

        contextSection = CONTEXT_SLIDES_PROMPT
            .replace('{{CONTEXT_BEFORE}}', beforeText)
            .replace('{{CONTEXT_AFTER}}', afterText);

        console.log(`[AI] Including context: ${contextSlides.before?.length || 0} before, ${contextSlides.after?.length || 0} after`);
    }

    // Build additional user instructions section
    let userInstructionsSection = '';
    if (additionalPrompt) {
        userInstructionsSection = `\n\nADDITIONAL USER INSTRUCTIONS:\n${additionalPrompt}`;
        console.log(`[AI] Additional prompt: ${additionalPrompt.substring(0, 100)}...`);
    }

    const prompt = SEMANTIC_PROMPT
        .replace('{{RAW_EXTRACTION}}', JSON.stringify(rawExtraction.content || rawExtraction, null, 2))
        .replace('{{IMAGE_LIST}}', imageListStr) + contextSection + visualInstructionsSection + lucideInstructionsSection + attachedImagesSection + userInstructionsSection;

    console.log(`[AI] Prompt length: ${prompt.length} chars`);

    // Build image parts array - screenshot first, then context screenshots, then media files
    const imageParts = [
        {
            inlineData: {
                data: screenshotBuffer.toString("base64"),
                mimeType
            }
        }
    ];

    // Add context screenshots (ordered: before slides first, then after slides)
    if (contextScreenshots && contextScreenshots.length > 0) {
        const beforeScreenshots = contextScreenshots.filter(c => c.position === 'before')
            .sort((a, b) => a.order - b.order);
        const afterScreenshots = contextScreenshots.filter(c => c.position === 'after')
            .sort((a, b) => a.order - b.order);

        for (const ctx of [...beforeScreenshots, ...afterScreenshots]) {
            imageParts.push({
                inlineData: {
                    data: ctx.buffer.toString("base64"),
                    mimeType: ctx.mimeType
                }
            });
        }
        console.log(`[AI] Including ${contextScreenshots.length} context screenshots in request`);
    }

    // Add media files if provided
    for (const media of mediaFiles) {
        imageParts.push({
            inlineData: {
                data: media.buffer.toString("base64"),
                mimeType: media.mimeType
            }
        });
    }

    if (mediaFiles.length > 0) {
        console.log(`[AI] Including ${mediaFiles.length} media files in request`);
    }

    try {
        console.log(`[AI] Sending request to Gemini API (timeout: ${API_TIMEOUT_MS / 1000}s)...`);
        const result = await withTimeout(
            model.generateContent([prompt, ...imageParts]),
            API_TIMEOUT_MS,
            'Semantic conversion'
        );
        const response = await result.response;
        const text = response.text();
        console.log(`[AI] Response received, length: ${text.length} chars`);

        // Use lenient JSON extraction
        const semanticContent = extractJSON(text);

        // Generate alternative images if requested
        if (generateImages && storageDir && mediaFiles.length > 0) {
            console.log(`[AI] Generating alternative images for ${mediaFiles.length} media files...`);
            const fs = require('fs');
            const path = require('path');

            // Create generated images directory
            const generatedDir = path.join(storageDir, 'generated');
            if (!fs.existsSync(generatedDir)) {
                fs.mkdirSync(generatedDir, { recursive: true });
            }

            // Build context from semantic content
            const context = `Slide: ${semanticContent.title || 'Untitled'}. ${semanticContent.summary || ''}`;

            for (let i = 0; i < mediaFiles.length; i++) {
                const media = mediaFiles[i];
                try {
                    const generated = await generateAlternativeImage(
                        media.buffer,
                        media.mimeType,
                        context,
                        userKey
                    );

                    if (generated) {
                        // Save generated image
                        const ext = generated.mimeType.includes('png') ? '.png' : '.jpg';
                        const filename = `generated_${i + 1}${ext}`;
                        const filepath = path.join(generatedDir, filename);
                        fs.writeFileSync(filepath, generated.buffer);
                        console.log(`[AI] Saved generated image: ${filepath}`);

                        // Add to semantic content as new image block
                        if (!semanticContent.generatedImages) {
                            semanticContent.generatedImages = [];
                        }
                        semanticContent.generatedImages.push({
                            original: media.path,
                            generated: `generated/${filename}`,
                            mimeType: generated.mimeType
                        });
                    }
                } catch (err) {
                    console.error(`[AI] Failed to generate alternative for ${media.path}:`, err.message);
                }
            }
        }

        return semanticContent;
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

// Group conversion prompt - for converting multiple slides as a progressive sequence
const GROUP_SEMANTIC_PROMPT = `
Analyze these {{SLIDE_COUNT}} slide screenshots and convert them to semantic learning content as a PROGRESSIVE SEQUENCE.

These slides are meant to be viewed in order and BUILD ON EACH OTHER. The content should:
- Show progression or development of ideas
- Reference earlier slides where appropriate (e.g., "building on the previous...", "as mentioned...")
- Maintain consistency in terminology and concepts across slides
- Be coherent as a sequence - each slide's content should connect to its neighbors

SLIDES DATA:
{{SLIDES_DATA}}

For EACH slide, analyze:
1. How it relates to the previous slide(s)
2. What new information it adds
3. How it sets up the next slide(s)
4. What visual cues indicate the relationship (same colors, continuing arrows, numbered steps)

OUTPUT: Return ONLY valid JSON (no markdown) as an ARRAY of slide objects:

[
  {
    "order": 1,
    "title": "slide title",
    "summary": "one sentence describing what this slide teaches",
    "semantic_type": "comparison|sequence|definition|list|mixed",
    "relationship": "introduces|builds_on|parallels|concludes|contrasts",
    "content": [
      // Same content block types as single conversion:
      // comparison, sequence, definition, list, heading, paragraph, image, etc.
    ]
  },
  {
    "order": 2,
    "title": "second slide title",
    // ...same structure
  }
  // ...more slides
]

RELATIONSHIP types:
- "introduces": First slide, introduces new topic
- "builds_on": Adds detail/depth to previous slide's concepts
- "parallels": Shows alternative or parallel concept
- "concludes": Wraps up or summarizes the sequence
- "contrasts": Shows opposing viewpoint or counterexample

CRITICAL:
- Output ALL slides in order
- Preserve ALL text in original language
- Make content cohesive across the sequence
- Each slide's "order" must match the input slide order
`;

// Group semantic conversion - convert multiple slides as a sequence
async function groupSemanticConvert(slidesWithScreenshots, userKey, modelName = DEFAULT_MODEL, mediaFiles = [], additionalPrompt = '', preserveVisuals = false, useLucideIcons = false) {
    const key = userKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error("No Gemini API Key provided.");

    const genAI = new GoogleGenerativeAI(key);
    const selectedModel = AVAILABLE_MODELS[modelName] ? modelName : DEFAULT_MODEL;

    console.log(`[AI] Group semantic conversion: ${slidesWithScreenshots.length} slides with model: ${selectedModel}`);

    const model = genAI.getGenerativeModel({ model: selectedModel });

    // Build slides data section
    const slidesDataStr = slidesWithScreenshots.map((slide, idx) => {
        const imageList = extractImageList(slide.rawExtraction);
        const imageListStr = imageList.length > 0
            ? imageList.map(img => `  - ${img.src} (${img.alt})`).join('\n')
            : '  (no images found)';

        return `
=== SLIDE ${idx + 1} (Order: ${slide.order}, Title: "${slide.title || 'Untitled'}") ===
Image ${idx + 1} in the attached images shows this slide's screenshot.

Extracted content:
${JSON.stringify(slide.rawExtraction.content || slide.rawExtraction, null, 2)}

Available images/icons:
${imageListStr}
`;
    }).join('\n');

    // Build visual pattern instructions section
    let visualInstructionsSection = '';
    if (preserveVisuals) {
        visualInstructionsSection = VISUAL_PATTERN_INSTRUCTIONS;
    }

    // Build Lucide icon instructions section
    let lucideInstructionsSection = '';
    if (useLucideIcons) {
        lucideInstructionsSection = LUCIDE_ICON_INSTRUCTIONS;
    }

    // Build additional user instructions section
    let userInstructionsSection = '';
    if (additionalPrompt) {
        userInstructionsSection = `\n\nADDITIONAL USER INSTRUCTIONS:\n${additionalPrompt}`;
    }

    // Build media files section
    let attachedImagesSection = '';
    if (mediaFiles.length > 0) {
        const imageStartIdx = slidesWithScreenshots.length + 1;
        attachedImagesSection = `\n\nATTACHED MEDIA: Images ${imageStartIdx}+ are extracted media files from the slides:\n` +
            mediaFiles.map((m, i) => `- Image ${imageStartIdx + i}: ${m.path} (from slide ${m.slideOrder})`).join('\n') +
            '\n\nFor each attached media, include it in the appropriate slide with correct alt text.';
    }

    const prompt = GROUP_SEMANTIC_PROMPT
        .replace('{{SLIDE_COUNT}}', slidesWithScreenshots.length.toString())
        .replace('{{SLIDES_DATA}}', slidesDataStr) + visualInstructionsSection + lucideInstructionsSection + attachedImagesSection + userInstructionsSection;

    console.log(`[AI] Group prompt length: ${prompt.length} chars`);

    // Build image parts array - screenshots in order, then media files
    const imageParts = [];

    for (const slide of slidesWithScreenshots) {
        imageParts.push({
            inlineData: {
                data: slide.screenshotBuffer.toString("base64"),
                mimeType: slide.screenshotMimeType
            }
        });
    }

    // Add media files
    for (const media of mediaFiles) {
        imageParts.push({
            inlineData: {
                data: media.buffer.toString("base64"),
                mimeType: media.mimeType
            }
        });
    }

    console.log(`[AI] Total images in request: ${imageParts.length}`);

    try {
        console.log(`[AI] Sending group request to Gemini API (timeout: ${API_TIMEOUT_MS / 1000}s)...`);
        const result = await withTimeout(
            model.generateContent([prompt, ...imageParts]),
            API_TIMEOUT_MS * 2, // Double timeout for group conversion
            'Group semantic conversion'
        );
        const response = await result.response;
        const text = response.text();
        console.log(`[AI] Group response received, length: ${text.length} chars`);

        // Extract JSON array
        const results = extractJSON(text);

        // Validate it's an array
        if (!Array.isArray(results)) {
            console.error('[AI] Expected array response for group conversion');
            throw new Error('Invalid response format: expected array of slide results');
        }

        console.log(`[AI] Successfully parsed ${results.length} slide results`);
        return results;
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

module.exports = { analyzeSlide, fixWithScreenshot, semanticConvert, groupSemanticConvert, getAvailableModels, extractImageList };