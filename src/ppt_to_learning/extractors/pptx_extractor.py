import os
import logging
from datetime import datetime
from typing import List, Dict
from pptx import Presentation as PptxPresentation
# MSO_SHAPE_TYPE and PP_PLACEHOLDER not needed - we check for image.blob directly
from ..core.models import (
    Presentation, PresentationMetadata, Section, Slide,
    ContentBlock, HeadingBlock, ParagraphBlock, ListBlock, ListItem,
    ImageBlock, SmartArtBlock, SmartArtNode, TableBlock, LinkBlock, VideoBlock
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
        title_url = None
        if slide.shapes.title and slide.shapes.title.text.strip():
            title = slide.shapes.title.text.strip()
            # Extract hyperlink from title before adding heading
            if slide.shapes.title.has_text_frame:
                title_url = self._extract_hyperlink_from_text_frame(slide.shapes.title.text_frame)
            content.append(HeadingBlock(text=title, level=1))
            # If title has a URL, add it as a link block too
            if title_url:
                content.append(LinkBlock(text=title, url=title_url))

        shapes = list(slide.shapes)
        shapes.sort(key=lambda s: (s.top if hasattr(s, 'top') else 0, s.left if hasattr(s, 'left') else 0))

        for shape in shapes:
            # Check for embedded video in ANY shape type first
            video_info = self._extract_video_info(shape, order, file_id, media_dir)
            if video_info:
                if 'url' in video_info:
                    # External video (YouTube, etc.)
                    content.append(LinkBlock(text=video_info['title'], url=video_info['url']))
                elif 'src' in video_info:
                    # Embedded video (MP4, etc.)
                    content.append(VideoBlock(src=video_info['src'], title=video_info['title']))
                # Continue to also process other content in this shape if any

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
                content.append(TableBlock(rows=rows))
                continue

            # SmartArt
            is_graphic_frame = shape.shape_type == 6 or type(shape).__name__ == 'GraphicFrame'
            if is_graphic_frame:
                sa_data = self.smartart_extractor.extract(shape, slide.part, file_id, media_dir)
                if sa_data:
                    def dict_to_node(d):
                        return SmartArtNode(
                            id=d['id'], text=d['text'], level=d['level'], icon=d['icon'], icon_alt=d.get('icon_alt'),
                            children=[dict_to_node(c) for c in d['children']]
                        )
                    nodes = [dict_to_node(n) for n in sa_data['nodes']]
                    content.append(SmartArtBlock(layout=sa_data['layout'], nodes=nodes))
                    continue

            # Image - extract from ANY shape that has image.blob, not just PICTURE type
            # (Placeholder shapes with images are type 14, not 13, but still have image data)
            if hasattr(shape, "image") and hasattr(shape.image, "blob"):
                try:
                    image_filename = f"slide_{order}_{shape.shape_id}.png"
                    image_path = os.path.join(media_dir, image_filename)
                    with open(image_path, "wb") as f:
                        f.write(shape.image.blob)

                    src = f"media/{file_id}/{image_filename}"
                    alt = shape.name if hasattr(shape, 'name') else "Slide Image"
                    content.append(ImageBlock(src=src, alt=alt))
                    image_count += 1
                    continue
                except Exception as e:
                    logger.debug(f"Could not extract image from shape: {e}")

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

            # Extract hyperlink from paragraph
            url = self._extract_hyperlink_from_paragraph(p)
            current_list_items.append(ListItem(text=text, level=p.level, url=url))

        if current_list_items:
            blocks.append(ListBlock(style="bullet", items=current_list_items))

        return blocks

    def _extract_hyperlink_from_paragraph(self, paragraph) -> str:
        """Extract the first hyperlink URL from a paragraph's runs."""
        try:
            for run in paragraph.runs:
                if hasattr(run, 'hyperlink') and run.hyperlink:
                    address = run.hyperlink.address
                    if address:
                        return address
        except Exception as e:
            logger.debug(f"Could not extract hyperlink: {e}")
        return None

    def _extract_hyperlink_from_text_frame(self, text_frame) -> str:
        """Extract the first hyperlink URL from any paragraph in a text frame."""
        try:
            for p in text_frame.paragraphs:
                url = self._extract_hyperlink_from_paragraph(p)
                if url:
                    return url
        except Exception as e:
            logger.debug(f"Could not extract hyperlink from text frame: {e}")
        return None

    def _extract_video_info(self, shape, slide_order: int, file_id: str, media_dir: str) -> dict:
        """Extract video info from embedded media shape.

        Returns dict with 'url' (external) or 'src' (local saved file) and 'title'.
        """
        try:
            element = None
            if hasattr(shape, '_element'):
                element = shape._element

            if element is None:
                return None

            ns = {
                'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
                'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
                'p14': 'http://schemas.microsoft.com/office/powerpoint/2010/main'
            }

            # Look for videoFile in nvPicPr/nvPr (picture shapes)
            videoFile = None
            nvPr = None
            if hasattr(element, 'nvPicPr') and element.nvPicPr is not None:
                nvPr = element.nvPicPr.nvPr
                videoFile = nvPr.find('.//a:videoFile', ns)

            # Also check nvSpPr for other shape types
            if videoFile is None and hasattr(element, 'nvSpPr') and element.nvSpPr is not None:
                nvPr = element.nvSpPr.nvPr
                videoFile = nvPr.find('.//a:videoFile', ns)

            # Check the whole element tree as fallback
            if videoFile is None:
                videoFile = element.find('.//a:videoFile', ns)
                if videoFile is not None:
                    nvPr = element.find('.//p:nvPr', {'p': 'http://schemas.openxmlformats.org/presentationml/2006/main'})

            if videoFile is None:
                return None

            video_title = shape.name if hasattr(shape, 'name') else "Video"

            # Get the link rId (for external URLs like YouTube)
            video_link_rId = videoFile.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}link')
            if video_link_rId:
                target = shape.part.target_ref(video_link_rId)
                # Check if it's an external URL (http/https) or local path
                if target and (target.startswith('http://') or target.startswith('https://')):
                    return {'url': target, 'title': video_title}

            # Check for embedded media (p14:media element for local MP4s)
            if nvPr is not None:
                p14_media = nvPr.find('.//p14:media', ns)
                if p14_media is not None:
                    embed_rId = p14_media.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
                    if embed_rId:
                        # Get the related part (the actual video file)
                        try:
                            video_part = shape.part.related_part(embed_rId)
                            if video_part and hasattr(video_part, 'blob'):
                                # Determine file extension from content type
                                content_type = video_part.content_type if hasattr(video_part, 'content_type') else 'video/mp4'
                                ext_map = {
                                    'video/mp4': '.mp4',
                                    'video/x-m4v': '.m4v',
                                    'video/webm': '.webm',
                                    'video/quicktime': '.mov',
                                    'video/x-msvideo': '.avi',
                                }
                                ext = ext_map.get(content_type, '.mp4')

                                # Save the video file
                                video_filename = f"slide_{slide_order}_{shape.shape_id}{ext}"
                                video_path = os.path.join(media_dir, video_filename)
                                with open(video_path, 'wb') as f:
                                    f.write(video_part.blob)

                                src = f"media/{file_id}/{video_filename}"
                                logger.info(f"Extracted embedded video: {video_filename}")
                                return {'src': src, 'title': video_title}
                        except Exception as e:
                            logger.debug(f"Could not extract embedded video blob: {e}")

        except Exception as e:
            logger.debug(f"Could not extract video info: {e}")
        return None
