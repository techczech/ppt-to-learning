import os
import json
import logging
import shutil
from typing import List
from ..core.models import Presentation
from ..core.interfaces import ISiteGenerator

logger = logging.getLogger(__name__)

class SiteGenerator(ISiteGenerator):
    def generate(self, presentations: List[Presentation], output_dir: str):
        json_dir = os.path.join(output_dir, "json")
        os.makedirs(json_dir, exist_ok=True)
        
        index_items = []

        # 1. Save JSON files
        for p in presentations:
            json_filename = f"{p.metadata.id}.json"
            output_path = os.path.join(json_dir, json_filename)
            logger.info(f"Saving JSON to {output_path}")
            
            with open(output_path, "w", encoding='utf-8') as f:
                json.dump(p.to_dict(), f, indent=2, ensure_ascii=False)
            
            # Prepare data for index.html
            # Try to find the first title
            title = p.metadata.id
            if p.sections and p.sections[0].slides:
                title = p.sections[0].slides[0].title or title
            
            index_items.append({
                "id": p.metadata.id,
                "file": json_filename,
                "title": title
            })

        # 2. Generate HTML
        self._generate_index(index_items, output_dir)
        self._generate_viewer(output_dir)

    def _generate_index(self, index_items, output_dir):
        template_path = os.path.join(os.path.dirname(__file__), "templates", "index.html")
        output_path = os.path.join(output_dir, "index.html")
        
        with open(template_path, "r", encoding='utf-8') as f:
            content = f.read()
            
        list_html = ""
        for item in index_items:
            file_path = item["file"]
            title = item["title"]
            item_id = item["id"]
            list_html += f'<li><a href="viewer.html?file=json/{file_path}">{title} ({item_id})</a></li>\n'
            
        content = content.replace("<!-- COURSE_LIST_ITEMS_PLACEHOLDER -->", list_html)
        
        with open(output_path, "w", encoding='utf-8') as f:
            f.write(content)
            
    def _generate_viewer(self, output_dir):
        template_path = os.path.join(os.path.dirname(__file__), "templates", "viewer.html")
        output_path = os.path.join(output_dir, "viewer.html")
        shutil.copy(template_path, output_path)