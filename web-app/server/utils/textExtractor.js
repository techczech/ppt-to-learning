/**
 * Extract all searchable text from slide content blocks
 * Handles all semantic content types from the presentation JSON
 */

/**
 * Recursively extract text from SmartArt nodes
 */
function extractSmartArtText(nodes, textParts) {
    for (const node of nodes || []) {
        if (node.text) textParts.push(node.text);
        if (node.children) extractSmartArtText(node.children, textParts);
    }
}

/**
 * Extract all searchable text from a slide's content array
 * @param {Array} content - The slide's content array from JSON
 * @returns {string} Concatenated text for search indexing
 */
function extractSearchableText(content) {
    const textParts = [];

    for (const block of content || []) {
        switch (block.type) {
            case 'heading':
            case 'paragraph':
                if (block.text) textParts.push(block.text);
                break;

            case 'list':
                if (block.items) {
                    for (const item of block.items) {
                        if (typeof item === 'string') {
                            textParts.push(item);
                        } else if (item.text) {
                            textParts.push(item.text);
                        }
                    }
                }
                break;

            case 'table':
                if (block.headers) {
                    textParts.push(...block.headers);
                }
                if (block.rows) {
                    for (const row of block.rows) {
                        textParts.push(...row.filter(cell => typeof cell === 'string'));
                    }
                }
                break;

            case 'smart_art':
                if (block.nodes) {
                    extractSmartArtText(block.nodes, textParts);
                }
                break;

            case 'comparison':
                if (block.description) textParts.push(block.description);
                if (block.groups) {
                    for (const group of block.groups) {
                        if (group.label) textParts.push(group.label);
                        if (group.items) {
                            textParts.push(...group.items.filter(i => typeof i === 'string'));
                        }
                    }
                }
                break;

            case 'sequence':
                if (block.description) textParts.push(block.description);
                if (block.steps) {
                    for (const step of block.steps) {
                        if (step.text) textParts.push(step.text);
                        if (step.detail) textParts.push(step.detail);
                    }
                }
                break;

            case 'definition':
                if (block.term) textParts.push(block.term);
                if (block.definition) textParts.push(block.definition);
                if (block.examples) {
                    textParts.push(...block.examples.filter(e => typeof e === 'string'));
                }
                break;

            case 'image':
                if (block.alt) textParts.push(block.alt);
                if (block.caption) textParts.push(block.caption);
                break;

            case 'text_with_visual':
                if (block.text) textParts.push(block.text);
                if (block.visual_description) textParts.push(block.visual_description);
                break;

            case 'link':
                if (block.text) textParts.push(block.text);
                break;

            case 'video':
                if (block.title) textParts.push(block.title);
                if (block.description) textParts.push(block.description);
                break;
        }
    }

    // Join and clean up whitespace
    return textParts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Build searchable text object for a slide
 * @param {Object} slideData - Slide data with title, notes, and content
 * @returns {Object} Searchable text object
 */
function buildSearchableText(slideData) {
    return {
        title: slideData.title || '',
        notes: slideData.notes || '',
        content: extractSearchableText(slideData.content)
    };
}

module.exports = {
    extractSearchableText,
    buildSearchableText
};
