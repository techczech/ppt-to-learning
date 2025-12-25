from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any, Union

# --- Content Blocks ---

@dataclass
class ContentBlock:
    type: str  # 'heading', 'paragraph', 'list', 'image', 'smart_art', 'table'
    
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
    children: List['ListItem'] = field(default_factory=list)
    
    def to_dict(self):
        return {
            "text": self.text,
            "level": self.level,
            "children": [c.to_dict() for c in self.children]
        }

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
