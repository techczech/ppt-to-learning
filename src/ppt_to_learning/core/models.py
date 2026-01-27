from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any, Union

# --- Text Formatting ---

@dataclass
class TextRun:
    """A run of text with formatting."""
    text: str
    bold: bool = False
    italic: bool = False
    underline: bool = False
    url: Optional[str] = None
    font_size: Optional[float] = None  # In points
    font_color: Optional[str] = None  # Hex color

    def to_dict(self):
        result = {"text": self.text}
        if self.bold:
            result["bold"] = True
        if self.italic:
            result["italic"] = True
        if self.underline:
            result["underline"] = True
        if self.url:
            result["url"] = self.url
        if self.font_size:
            result["font_size"] = self.font_size
        if self.font_color:
            result["font_color"] = self.font_color
        return result

# --- Content Blocks ---

@dataclass
class ContentBlock:
    type: str  # 'heading', 'paragraph', 'list', 'image', 'smart_art', 'table', 'shape'

    def to_dict(self):
        return {"type": self.type}

@dataclass
class HeadingBlock(ContentBlock):
    text: str = ""
    level: int = 1
    type: str = "heading"
    
    def to_dict(self):
        return {"type": "heading", "text": self.text, "level": self.level}

@dataclass
class ParagraphBlock(ContentBlock):
    text: str = ""
    type: str = "paragraph"
    
    def to_dict(self):
        return {"type": "paragraph", "text": self.text}

@dataclass
class ListItem:
    text: str
    level: int = 0
    url: Optional[str] = None
    runs: List[TextRun] = field(default_factory=list)  # Formatted text runs
    children: List['ListItem'] = field(default_factory=list)

    def to_dict(self):
        result = {
            "text": self.text,
            "level": self.level,
            "children": [c.to_dict() for c in self.children]
        }
        if self.url:
            result["url"] = self.url
        if self.runs:
            result["runs"] = [r.to_dict() for r in self.runs]
        return result

@dataclass
class ListBlock(ContentBlock):
    items: List[ListItem] = field(default_factory=list)
    style: str = "bullet" # 'bullet' or 'numbered'
    type: str = "list"
    
    def to_dict(self):
        return {
            "type": "list",
            "style": self.style,
            "items": [i.to_dict() for i in self.items]
        }

@dataclass
class ImageBlock(ContentBlock):
    src: str = ""
    alt: str = ""
    caption: str = ""
    type: str = "image"

    def to_dict(self):
        return {"type": "image", "src": self.src, "alt": self.alt, "caption": self.caption}

@dataclass
class LinkBlock(ContentBlock):
    text: str = ""
    url: str = ""
    type: str = "link"

    def to_dict(self):
        return {"type": "link", "text": self.text, "url": self.url}

@dataclass
class VideoBlock(ContentBlock):
    src: str = ""
    title: str = ""
    type: str = "video"

    def to_dict(self):
        return {"type": "video", "src": self.src, "title": self.title}

@dataclass
class ShapeBlock(ContentBlock):
    """An auto shape (arrow, connector, symbol, etc.)."""
    shape_type: str = ""  # e.g., "arrow", "rectangle", "notEqual", "connector"
    shape_name: str = ""  # PowerPoint shape name
    text: str = ""  # Text inside the shape if any
    runs: List[TextRun] = field(default_factory=list)  # Formatted text
    # Position (in EMUs)
    left: int = 0
    top: int = 0
    width: int = 0
    height: int = 0
    # Visual properties
    fill_color: Optional[str] = None
    line_color: Optional[str] = None
    rotation: float = 0.0
    # Animation
    animation_order: Optional[int] = None  # Entry order in animations
    type: str = "shape"

    def to_dict(self):
        result = {
            "type": "shape",
            "shape_type": self.shape_type,
            "shape_name": self.shape_name,
            "position": {
                "left": self.left,
                "top": self.top,
                "width": self.width,
                "height": self.height,
            },
        }
        if self.text:
            result["text"] = self.text
        if self.runs:
            result["runs"] = [r.to_dict() for r in self.runs]
        if self.fill_color:
            result["fill_color"] = self.fill_color
        if self.line_color:
            result["line_color"] = self.line_color
        if self.rotation:
            result["rotation"] = self.rotation
        if self.animation_order is not None:
            result["animation_order"] = self.animation_order
        return result

@dataclass
class SmartArtNode:
    id: str
    text: str
    children: List['SmartArtNode'] = field(default_factory=list)
    level: int = 0
    icon: Optional[str] = None
    icon_alt: Optional[str] = None

    def to_dict(self):
        return {
            "id": self.id,
            "text": self.text,
            "children": [c.to_dict() for c in self.children],
            "level": self.level,
            "icon": self.icon,
            "icon_alt": self.icon_alt
        }

@dataclass
class SmartArtBlock(ContentBlock):
    layout: str = ""
    nodes: List[SmartArtNode] = field(default_factory=list)
    type: str = "smart_art"
    
    def to_dict(self):
        return {
            "type": "smart_art",
            "layout": self.layout,
            "nodes": [n.to_dict() for n in self.nodes]
        }

@dataclass
class TableBlock(ContentBlock):
    rows: List[List[str]] = field(default_factory=list)
    type: str = "table"
    
    def to_dict(self):
        return {
            "type": "table",
            "rows": self.rows
        }

# --- Hierarchy ---

@dataclass
class Slide:
    order: int
    title: str
    layout: str
    notes: str
    content: List[ContentBlock]
    
    def to_dict(self):
        return {
            "order": self.order,
            "title": self.title,
            "layout": self.layout,
            "notes": self.notes,
            "content": [c.to_dict() for c in self.content]
        }

@dataclass
class Section:
    title: str
    slides: List[Slide] = field(default_factory=list)
    
    def to_dict(self):
        return {
            "title": self.title,
            "slides": [s.to_dict() for s in self.slides]
        }

@dataclass
class PresentationMetadata:
    id: str
    source_file: str
    processed_at: str
    stats: Dict[str, int] = field(default_factory=dict)
    
    def to_dict(self):
        return {
            "id": self.id,
            "source_file": self.source_file,
            "processed_at": self.processed_at,
            "stats": self.stats
        }

@dataclass
class Presentation:
    metadata: PresentationMetadata
    sections: List[Section]
    
    def to_dict(self):
        return {
            "metadata": self.metadata.to_dict(),
            "sections": [s.to_dict() for s in self.sections]
        }