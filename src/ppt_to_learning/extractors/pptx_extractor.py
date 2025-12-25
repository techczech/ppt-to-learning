import os
import logging
from datetime import datetime
from typing import List, Dict
from pptx import Presentation as PptxPresentation
from pptx.enum.shapes import MSO_SHAPE_TYPE, PP_PLACEHOLDER
from ..core.models import (
    Presentation, PresentationMetadata, Section, Slide, 
    ContentBlock, HeadingBlock, ParagraphBlock, ListBlock, ListItem, 
    ImageBlock, SmartArtBlock, SmartArtNode
)
from ..core.interfaces import IPresentationExtractor
from .smartart_extractor import SmartArtExtractor

logger = logging.getLogger(__name__)

class PptxExtractor(IPresentationExtractor):
    def __init__(self):
        self.smartart_extractor = SmartArtExtractor()

    def extract(self, file_path: str, media_output_dir: str) -> Presentation:
        filename = os.path.basename(file_path)
        file_id = os.path.splitext(filename)[0]
        
        file_media_dir = os.path.join(media_output_dir, file_id)
        os.makedirs(file_media_dir, exist_ok=True)

        logger.info(f"Parsing {file_path}")
        prs = PptxPresentation(file_path)

        # 1. Sections
        sections_map = self._get_sections_mapping(prs)
        
        # 2. Iterate
        processed_sections = []
        slide_count = 0
        image_count = 0
        
        if not sections_map:
            sections_map = [{"title": "Default", "slides": list(prs.slides)}]

        for sec_data in sections_map:
            section_slides = []
            for pptx_slide in sec_data['slides']:
                slide_count += 1
                slide_obj, imgs = self._process_slide(pptx_slide, slide_count, file_id, file_media_dir)
                section_slides.append(slide_obj)
                image_count += imgs
            
            processed_sections.append(Section(
                title=sec_data['title'],
                slides=section_slides
            ))

        # 3. Metadata
        metadata = PresentationMetadata(
            id=file_id,
            source_file=filename,
            processed_at=datetime.now().isoformat(),
            stats={"slide_count": slide_count, "image_count": image_count}
        )

        return Presentation(metadata=metadata, sections=processed_sections)

    def _get_sections_mapping(self, prs) -> list:
        mapping = []
        # 1. Native Sections
        if hasattr(prs, 'sections') and len(prs.sections) > 0:
            try:
                for section in prs.sections:
                    slides = list(section.slides)
                    if slides:
                        mapping.append({"title": section.title, "slides": slides})
                return mapping
            except Exception as e:
                logger.warning(f"Error accessing native sections: {e}")
        
        # 2. XML Fallback
        try:
            slide_id_to_slide = {slide.slide_id: slide for slide in prs.slides}
            nsmap = {
                'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
                'p14': 'http://schemas.microsoft.com/office/powerpoint/2010/main'
            }
            ext_lst = prs.element.find("./p:extLst", namespaces=nsmap)
            if ext_lst is not None:
                for ext in ext_lst.findall("./p:ext", namespaces=nsmap):
                    section_list_xml = ext.find(".//p14:sectionLst", namespaces=nsmap)
                    if section_list_xml is not None:
                        for section in section_list_xml.findall("./p14:section", namespaces=nsmap):
                            section_name = section.get("name")
                            section_slides = []
                            sld_id_lst = section.find("./p14:sldIdLst", namespaces=nsmap)
                            if sld_id_lst is not None:
                                for sld_id_tag in sld_id_lst.findall("./p14:sldId", namespaces=nsmap):
                                    sid = int(sld_id_tag.get("id"))
                                    if sid in slide_id_to_slide:
                                        section_slides.append(slide_id_to_slide[sid])
                            if section_slides:
                                mapping.append({"title": section_name, "slides": section_slides})
                        return mapping
        except Exception as e:
            logger.warning(f"XML section extraction failed: {e}")

        return []

    def _process_slide(self, slide, order: int, file_id: str, media_dir: str):
        content = []
        notes = ""
        image_count = 0
        
        layout_name = slide.slide_layout.name if slide.slide_layout else "Unknown"
        
        title = ""
        if slide.shapes.title and slide.shapes.title.text.strip():
            title = slide.shapes.title.text.strip()
            content.append(HeadingBlock(text=title, level=1))

        shapes = list(slide.shapes)
        shapes.sort(key=lambda s: (s.top if hasattr(s, 'top') else 0, s.left if hasattr(s, 'left') else 0))

        for shape in shapes:
            if shape == slide.shapes.title:
                continue

            # Table
            if shape.has_table:
                table = shape.table
                rows = []
                for row in table.rows:
                    cells = []
                    for cell in row.cells:
                        cells.append(cell.text_frame.text.strip())
                    rows.append(cells)
                from ..core.models import TableBlock
                content.append(TableBlock(rows=rows))
                continue

            # SmartArt
            is_graphic_frame = shape.shape_type == 6 or type(shape).__name__ == 'GraphicFrame'
            if is_graphic_frame:
                sa_data = self.smartart_extractor.extract(shape, slide.part, file_id, media_dir)
                if sa_data:
                    def dict_to_node(d):
                        return SmartArtNode(
                            id=d['id'], text=d['text'], level=d['level'], icon=d['icon'],
                            children=[dict_to_node(c) for c in d['children']]
                        )
                    nodes = [dict_to_node(n) for n in sa_data['nodes']]
                    content.append(SmartArtBlock(layout=sa_data['layout'], nodes=nodes))
                    continue

            # Image
            if shape.shape_type == MSO_SHAPE_TYPE.PICTURE:
                if hasattr(shape, "image") and hasattr(shape.image, "blob"):
                    image_filename = f"slide_{order}_{shape.shape_id}.png"
                    image_path = os.path.join(media_dir, image_filename)
                    with open(image_path, "wb") as f:
                        f.write(shape.image.blob)
                    
                    src = f"media/{file_id}/{image_filename}"
                    content.append(ImageBlock(src=src, alt="Slide Image"))
                    image_count += 1
                    continue

            # Text
            if shape.has_text_frame:
                if not shape.text_frame.text.strip():
                    continue
                blocks = self._process_text_frame(shape.text_frame)
                content.extend(blocks)

        if slide.has_notes_slide and slide.notes_slide.notes_text_frame:
            notes = slide.notes_slide.notes_text_frame.text

        slide_obj = Slide(
            order=order,
            title=title,
            layout=layout_name,
            notes=notes,
            content=content
        )
        
        return slide_obj, image_count

    def _process_text_frame(self, text_frame) -> List[ContentBlock]:
        blocks = []
        current_list_items = []
        
        for p in text_frame.paragraphs:
            text = p.text.strip()
            if not text:
                continue
            
            # For now, treat all body paragraphs as list items
            # This makes the output structured
            current_list_items.append(ListItem(text=text, level=p.level))
        
        if current_list_items:
            blocks.append(ListBlock(style="bullet", items=current_list_items))
            
        return blocks
