const { GoogleGenerativeAI } = require("@google/generative-ai");

const EMBEDDING_MODEL = "text-embedding-004";

/**
 * Generate embedding for a document (slide content)
 * @param {string} text - Text to embed
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<number[]>} Embedding vector
 */
async function generateEmbedding(text, apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

    const result = await model.embedContent({
        content: { parts: [{ text }] },
        taskType: "RETRIEVAL_DOCUMENT"
    });

    return result.embedding.values;
}

/**
 * Generate embedding optimized for search queries
 * @param {string} query - Search query
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<number[]>} Embedding vector
 */
async function generateQueryEmbedding(query, apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

    const result = await model.embedContent({
        content: { parts: [{ text: query }] },
        taskType: "RETRIEVAL_QUERY"
    });

    return result.embedding.values;
}

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} a - First vector
 * @param {number[]} b - Second vector
 * @returns {number} Similarity score (0-1, higher = more similar)
 */
function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) {
        return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Build text for embedding from slide data
 * @param {Object} slide - Slide object
 * @returns {string} Text for embedding
 */
function buildEmbeddingText(slide) {
    const parts = [slide.title];

    if (slide.notes) {
        parts.push(slide.notes);
    }

    if (slide.searchableText?.content) {
        parts.push(slide.searchableText.content);
    }

    return parts.join(' ').substring(0, 10000); // Limit to avoid token limits
}

module.exports = {
    generateEmbedding,
    generateQueryEmbedding,
    cosineSimilarity,
    buildEmbeddingText,
    EMBEDDING_MODEL
};
