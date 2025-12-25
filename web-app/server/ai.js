const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

function getModel(userKey) {
    const key = userKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error("No Gemini API Key provided.");
    const genAI = new GoogleGenerativeAI(key);
    return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
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

    const result = await model.generateContent(finalPrompt);
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

    const result = await model.generateContent([finalPrompt, imagePart]);
    const response = await result.response;
    const text = response.text();
    
    // Extract JSON block if LLM included markdown
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(text);
}

module.exports = { analyzeSlide, fixWithScreenshot };