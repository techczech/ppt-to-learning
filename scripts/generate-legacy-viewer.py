#!/usr/bin/env python3
"""Generate legacy index.html/viewer.html from unified extractor output."""

import argparse
import json
import shutil
from pathlib import Path


def find_presentations(input_path: Path) -> list[Path]:
    if input_path.is_file():
        if input_path.name == "presentation.json":
            return [input_path.parent]
        raise SystemExit(f"Input file is not presentation.json: {input_path}")

    if (input_path / "presentation.json").exists():
        return [input_path]

    direct_children = [p for p in input_path.iterdir() if p.is_dir()]
    direct_presentations = [p for p in direct_children if (p / "presentation.json").exists()]
    if direct_presentations:
        return sorted(direct_presentations)

    # Fallback: search recursively, but avoid deep scans by limiting to 2 levels
    matches = []
    for candidate in input_path.glob("**/presentation.json"):
        matches.append(candidate.parent)
    return sorted(set(matches))


def normalize_list_items(items, indent=0):
    lines = []
    for item in items or []:
        level = item.get("level")
        indent_level = level if level is not None else indent
        prefix = "  " * indent_level + "- "
        text = (item.get("text") or "").strip()
        if text:
            lines.append(f"{prefix}{text}")
        children = item.get("children") or []
        if children:
            lines.extend(normalize_list_items(children, indent_level + 1))
    return lines


def normalize_smartart_nodes(nodes, indent=0):
    lines = []
    for node in nodes or []:
        level = node.get("level")
        indent_level = level if level is not None else indent
        prefix = "  " * indent_level + "- "
        text = (node.get("text") or "").strip()
        if text:
            lines.append(f"{prefix}{text}")
        children = node.get("children") or []
        if children:
            lines.extend(normalize_smartart_nodes(children, indent_level + 1))
    return lines


def resolve_media_path(src: str, presentation_id: str) -> str:
    if src.startswith("http://") or src.startswith("https://"):
        return src
    if src.startswith("media/"):
        return f"{presentation_id}/{src}"
    return src


def build_legacy_slide(slide: dict, presentation_id: str) -> dict:
    slide_title = slide.get("title") or f"Slide {slide.get('order', '')}".strip()
    elements = []
    text_blocks = []
    media_items = []

    if slide_title:
        elements.append({"type": "title", "content": slide_title})

    for block in slide.get("content") or []:
        btype = block.get("type")
        if btype == "heading":
            if not slide.get("title") and block.get("text"):
                elements.append({"type": "title", "content": block.get("text")})
            continue
        if btype == "list":
            lines = normalize_list_items(block.get("items"))
            if lines:
                elements.append({"type": "text", "content": "\n".join(lines)})
                text_blocks.append("\n".join(lines))
            continue
        if btype == "smart_art":
            lines = normalize_smartart_nodes(block.get("nodes"))
            if lines:
                elements.append({"type": "text", "content": "\n".join(lines)})
                text_blocks.append("\n".join(lines))
            continue
        if btype == "table":
            rows = block.get("rows") or []
            row_lines = []
            for row in rows:
                row_text = []
                for cell in row:
                    if isinstance(cell, str):
                        row_text.append(cell)
                    elif isinstance(cell, dict):
                        row_text.append(cell.get("text") or "")
                row_lines.append(" | ".join([r for r in row_text if r]))
            if row_lines:
                elements.append({"type": "text", "content": "\n".join(row_lines)})
                text_blocks.append("\n".join(row_lines))
            continue
        if btype == "link":
            text = block.get("text") or block.get("url")
            url = block.get("url")
            if text and url:
                line = f"{text} ({url})"
                elements.append({"type": "text", "content": line})
                text_blocks.append(line)
            continue
        if btype == "video":
            src = block.get("src") or ""
            title = block.get("title") or "Video"
            line = f"{title}: {src}" if src else title
            elements.append({"type": "text", "content": line})
            text_blocks.append(line)
            continue
        if btype == "image":
            src = block.get("src")
            if src:
                resolved = resolve_media_path(src, presentation_id)
                elements.append({"type": "image", "content": resolved})
                media_items.append({"type": "image", "url": resolved})
            continue
        if btype == "shape":
            text = (block.get("text") or "").strip()
            if text:
                elements.append({"type": "text", "content": text})
                text_blocks.append(text)
            continue

    return {
        "slide_number": slide.get("order"),
        "title": slide_title,
        "elements": elements,
        "text": text_blocks,
        "media": media_items,
        "notes": slide.get("notes") or "",
    }


def build_legacy_presentation(presentation_path: Path) -> dict:
    with open(presentation_path / "presentation.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    metadata = data.get("metadata", {})
    presentation_id = metadata.get("id") or presentation_path.name
    display_title = metadata.get("title") or presentation_id

    sections = data.get("sections") or []
    sections_sorted = sorted(sections, key=lambda s: s.get("order", 0))

    slides = []
    for section in sections_sorted:
        slides_raw = section.get("slides") or []
        slides_sorted = sorted(slides_raw, key=lambda s: s.get("order", 0))
        for slide in slides_sorted:
            slides.append(build_legacy_slide(slide, presentation_path.name))

    return {
        "id": display_title,
        "presentation_id": presentation_id,
        "slides": slides,
    }


def generate_index(items, output_dir: Path, template_path: Path):
    with open(template_path, "r", encoding="utf-8") as f:
        content = f.read()

    list_html = ""
    for item in items:
        list_html += f'<li><a href="viewer.html?file=legacy-json/{item["file"]}">{item["title"]} ({item["id"]})</a></li>\n'

    content = content.replace("<!-- COURSE_LIST_ITEMS_PLACEHOLDER -->", list_html)

    with open(output_dir / "index.html", "w", encoding="utf-8") as f:
        f.write(content)


def main():
    parser = argparse.ArgumentParser(description="Generate legacy viewer for unified extractor output")
    parser.add_argument("--input", "-i", required=True, help="Unified output folder or presentation folder")
    parser.add_argument("--output", "-o", required=True, help="Output folder for index/viewer")

    args = parser.parse_args()
    input_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()

    if not input_path.exists():
        raise SystemExit(f"Input not found: {input_path}")

    presentations = find_presentations(input_path)
    if not presentations:
        raise SystemExit(f"No presentation.json found under: {input_path}")

    template_root = Path(__file__).resolve().parents[1] / "src" / "ppt_to_learning" / "generators" / "templates"
    index_template = template_root / "index.html"
    viewer_template = template_root / "viewer.html"

    output_path.mkdir(parents=True, exist_ok=True)
    legacy_json_dir = output_path / "legacy-json"
    legacy_json_dir.mkdir(parents=True, exist_ok=True)

    index_items = []
    for presentation_dir in presentations:
        legacy = build_legacy_presentation(presentation_dir)
        pres_id = legacy.get("presentation_id") or presentation_dir.name
        filename = f"{pres_id}.json"
        with open(legacy_json_dir / filename, "w", encoding="utf-8") as f:
            json.dump(legacy, f, indent=2)

        index_items.append({
            "id": pres_id,
            "file": filename,
            "title": legacy.get("id") or pres_id,
        })

    generate_index(index_items, output_path, index_template)
    shutil.copy(viewer_template, output_path / "viewer.html")

    print(f"Generated legacy viewer in: {output_path}")
    print(f"Presentations: {len(index_items)}")


if __name__ == "__main__":
    main()
