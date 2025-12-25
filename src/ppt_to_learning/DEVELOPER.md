# Developer Guide: PPT to Learning

This package converts PowerPoint presentations (`.pptx`) into semantic JSON structures for use in web applications or LLM contexts.

## Architecture

The system is modularized into three main components:

1.  **Core (`src/ppt_to_learning/core`)**: Contains data models (`PresentationData`, `Slide`, `Section`, `SmartArtNode`) and interfaces (`IPresentationExtractor`).
2.  **Extractors (`src/ppt_to_learning/extractors`)**: Handles parsing of file formats.
    *   `PptxExtractor`: Main entry point for PPTX files using `python-pptx`.
    *   `SmartArtExtractor`: Specialized extractor for SmartArt diagrams using low-level XML parsing.
3.  **Generators (`src/ppt_to_learning/generators`)**: Produces output files (JSON, HTML).

## Key Components

### PptxExtractor (`pptx_extractor.py`)

*   **Slide Processing**: Iterates through slides and shapes. Shapes are sorted by position (top-to-bottom, left-to-right) to maintain reading order.
*   **Shape Handling**:
    *   **Text**: Extracted from TextFrames.
    *   **Images**: Extracted from Picture shapes and saved to the media directory.
    *   **SmartArt**: Detected via `GraphicFrame` type (ID 6). Delegated to `SmartArtExtractor`.
*   **Section Extraction**: Supports both native `python-pptx` sections (preferred) and a raw XML fallback for compatibility.

### SmartArtExtractor (`smartart_extractor.py`)

SmartArt is complex because the semantic text is stored in a separate XML part (`drawingml/2006/diagram`) from the visual representation.

**Logic:**
1.  **Detection**: Checks `graphicData` URI for the diagram namespace.
2.  **Data Part**: Resolves the relationship (`r:dm`) to find the underlying XML data.
3.  **Parsing**:
    *   **Points (`dgm:pt`)**: Represents nodes. Text is often nested deep in `dgm:t` -> `a:p` -> `a:r` -> `a:t` or `dgm:txBody`.
    *   **Connections (`dgm:cxn`)**: Defines parent-child relationships (`type="parOf"`).
4.  **Tree Building**: Constructs a recursive tree of `SmartArtNode`s.
5.  **Filtering**: Prunes empty leaf nodes (no text/icon) to clean up the output.
6.  **Icons**: Extracts embedded images (`a:blip`) referenced in the points.

## Common Issues & Fixes

*   **Missing Text**: Text in SmartArt is often inside a `dgm:txBody` or nested paragraphs. The extractor searches multiple locations.
*   **Empty Nodes**: SmartArt contains "pres" (presentation) points for layout. These are filtered out by type or by the post-processing filter.
*   **Missing Sections**: If `python-pptx` native sections fail, the XML fallback traverses `p:extLst` to find the section list.

## Adding New Features

1.  **New Shape Type**: Add a check in `PptxExtractor._process_slide`.
2.  **Output Format**: Implement `ISiteGenerator` in a new generator class.

## Testing

Run tests via:
```bash
python -m unittest discover tests
```
