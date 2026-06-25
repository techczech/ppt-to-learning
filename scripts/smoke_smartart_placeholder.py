#!/usr/bin/env python3
"""Smoke test SmartArt extraction from PlaceholderGraphicFrame slides."""

import argparse
import shutil
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = REPO_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from ppt_to_learning.extractors.pptx_extractor import PptxExtractor  # noqa: E402


DEFAULT_PPTX = Path("/Users/dominiklukes/Downloads/Love Research Data IPad Slides.pptx")


def _flatten_slides(presentation):
    return [slide for section in presentation.sections for slide in section.slides]


def _collect_node_texts(nodes):
    texts = []
    for node in nodes:
        if node.text:
            texts.append(node.text)
        texts.extend(_collect_node_texts(node.children))
    return texts


def _collect_node_icons(nodes):
    icons = []
    for node in nodes:
        if node.icon:
            icons.append(node.icon)
        icons.extend(_collect_node_icons(node.children))
    return icons


def _collect_smartart_text(slide):
    texts = []
    smartart_count = 0
    for block in slide.content:
        if getattr(block, "type", "") != "smart_art":
            continue
        smartart_count += 1
        texts.extend(_collect_node_texts(block.nodes))
    return smartart_count, " ".join(texts)


def _assert_slide8_icons(slide):
    smartart_blocks = [b for b in slide.content if getattr(b, "type", "") == "smart_art"]
    if len(smartart_blocks) < 2:
        raise AssertionError("Slide 8 should contain at least two smart_art blocks")

    icons = []
    for block in smartart_blocks:
        icons.extend(_collect_node_icons(block.nodes))

    if len(icons) < 6:
        raise AssertionError(f"Slide 8 expected at least 6 SmartArt icons, got {len(icons)}")
    if len(set(icons)) < 6:
        raise AssertionError("Slide 8 SmartArt icons are not unique (collision/overwrite detected)")


def _assert_keywords(slide_order, text, keywords):
    text_l = text.lower()
    missing = [kw for kw in keywords if kw.lower() not in text_l]
    if missing:
        raise AssertionError(f"Slide {slide_order} missing SmartArt keywords: {missing}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pptx", type=Path, default=DEFAULT_PPTX, help="Path to PPTX file")
    args = parser.parse_args()

    if not args.pptx.exists():
        print(f"PPTX not found: {args.pptx}", file=sys.stderr)
        return 2

    tmp_dir = Path(tempfile.mkdtemp(prefix="smoke_ppt_to_learning_"))
    try:
        extractor = PptxExtractor()
        presentation = extractor.extract(str(args.pptx), str(tmp_dir / "media"))
        slides = {slide.order: slide for slide in _flatten_slides(presentation)}

        for required in (3, 4, 8):
            if required not in slides:
                raise AssertionError(f"Slide {required} not found in extracted output")

        slide3_count, slide3_text = _collect_smartart_text(slides[3])
        slide4_count, slide4_text = _collect_smartart_text(slides[4])

        if slide3_count < 1:
            raise AssertionError("Slide 3 has no smart_art block")
        if slide4_count < 1:
            raise AssertionError("Slide 4 has no smart_art block")

        _assert_keywords(3, slide3_text, ["Supported", "ChatGPT", "Gemini", "NotebookLM", "Copilot"])
        _assert_keywords(4, slide4_text, ["Jargon-free sessions", "In Person", "Online", "Custom"])
        _assert_slide8_icons(slides[8])
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    print("PASS: ppt-to-learning extracted SmartArt text and unique SmartArt icons (slides 3, 4, 8).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
