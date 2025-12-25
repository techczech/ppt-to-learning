# Proposed JSON Schema for PPT to Learning

## Root Object
```typescript
interface Presentation {
  metadata: {
    id: string;           // Derived from filename or title
    source_file: string;  // Original filename
    processed_at: string; // ISO Timestamp
    stats: {
      slide_count: number;
      image_count: number;
    }
  };
  sections: Section[];    // Top-level organization
}
```

## Section
A container for slides. If the PPTX uses no sections, a single "Default" section is created.
```typescript
interface Section {
  title: string;
  slides: Slide[];
}
```

## Slide
A container for content elements.
```typescript
interface Slide {
  order: number;          // 1-based index
  title: string;          // Extracted from the slide title placeholder
  layout: string;         // e.g., "Title and Content"
  notes: string;          // Speaker notes (plain text)
  content: ContentBlock[]; // Ordered list of semantic elements
}
```

## Content Blocks
The `content` array is a polymorphic list of blocks.

### 1. Heading
Derived from the Slide Title or explicit header styles.
```typescript
{
  "type": "heading",
  "level": 1, // Usually 1 for Slide Title, 2 for subtitles
  "text": "Introduction to Physics"
}
```

### 2. Paragraph
Standard text blocks.
```typescript
{
  "type": "paragraph",
  "text": "Physics is the natural science that studies matter..."
}
```

### 3. List
Consecutive bullet points or numbered lists.
```typescript
{
  "type": "list",
  "style": "bullet" | "numbered",
  "items": [
    {
      "text": "First item",
      "level": 0,
      "children": [] // Nested sub-items if applicable
    }
  ]
}
```

### 4. Image
```typescript
{
  "type": "image",
  "src": "media/PresentationID/slide_1_pic.png",
  "alt": "Description if available",
  "caption": ""
}
```

### 5. SmartArt
```typescript
{
  "type": "smart_art",
  "layout": "Vertical Process",
  "data": {
    "id": "node_id",
    "text": "Process Start",
    "icon": "media/.../icon.png",
    "children": [ ... ] // Recursive nodes
  }
}
```

### 6. Table (Future)
```typescript
{
  "type": "table",
  "rows": [
    ["Header 1", "Header 2"],
    ["Cell A", "Cell B"]
  ]
}
```
