import logging
import os
from typing import Dict, List, Optional, Any
from pptx.shapes.graphfrm import GraphicFrame
from ..core.models import SmartArtNode
from lxml import etree

logger = logging.getLogger(__name__)

class SmartArtExtractor:
    NAMESPACES = {
        'dgm': 'http://schemas.openxmlformats.org/drawingml/2006/diagram',
        'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
        'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
    }

    def extract(self, shape: GraphicFrame, slide_part, file_id: str, media_output_dir: str) -> Optional[Dict[Any, Any]]:
        """
        Extracts structured data from a SmartArt GraphicFrame.
        """
        try:
            if not self._is_smartart(shape): return None
            rel_id = self._get_rel_id(shape)
            if not rel_id: return None
            try:
                data_part = slide_part.related_part(rel_id)
            except KeyError as e:
                logger.warning(f"SmartArt relationship not found: {rel_id} - {e}")
                return None

            root = etree.fromstring(data_part.blob)

            # 1. Extract all raw points
            nodes_map = self._parse_points(root, data_part, file_id, media_output_dir)
            
            # 2. Build relationship maps
            visual_to_data = {}
            visual_parent = {}
            visual_children = {}
            data_root_id = None
            
            # Find data root (type='doc')
            doc_pt = root.find(".//dgm:pt[@type='doc']", self.NAMESPACES)
            if doc_pt is not None: data_root_id = doc_pt.get("modelId")

            for cxn in root.findall(".//dgm:cxn", self.NAMESPACES):
                s, d, t = cxn.get("srcId"), cxn.get("destId"), cxn.get("type", "")
                if t == "presOf": 
                    visual_to_data[d] = s
                elif t == "presParOf": 
                    visual_parent[d] = s
                    visual_children.setdefault(s, []).append(d)

            # 3. Explicit associations from XML (presAssocID is a strong hint)
            for pt in root.findall(".//dgm:pt", self.NAMESPACES):
                mid = pt.get("modelId")
                pr_set = pt.find("dgm:prSet", self.NAMESPACES)
                if pr_set is not None:
                    assoc_id = pr_set.get("presAssocID")
                    if assoc_id:
                        visual_to_data[mid] = assoc_id

            # 4. Assign icons to owners (Sibling-Aware Trace)
            for mid, node in nodes_map.items():
                if node.icon:
                    owner_id = self._find_data_owner(mid, visual_to_data, visual_parent, visual_children, data_root_id)
                    if owner_id and owner_id != mid and owner_id in nodes_map:
                        # Move icon to owner if owner doesn't have one
                        if not nodes_map[owner_id].icon:
                            nodes_map[owner_id].icon = node.icon
                            nodes_map[owner_id].icon_alt = node.icon_alt
                            node.icon = None
                            node.icon_alt = None

            # 5. Build Structural Tree (parOf)
            structural_conns = []
            for cxn in root.findall(".//dgm:cxn", self.NAMESPACES):
                if cxn.get("type", "parOf") == "parOf":
                    structural_conns.append((cxn.get("srcId"), cxn.get("destId")))
            
            presentation_points = set(visual_to_data.keys()) | set(visual_parent.keys())
            root_nodes = self._build_tree(nodes_map, structural_conns, presentation_points)
            
            filtered = self._filter_empty_nodes(root_nodes)
            return {
                "layout": self._get_layout_name(slide_part, shape),
                "nodes": [n.to_dict() for n in filtered]
            }

        except Exception as e:
            logger.error(f"SmartArt Error: {e}", exc_info=True)
            return None

    def _find_data_owner(self, vid, v2d, vpar, vchild, root_id) -> Optional[str]:
        curr = vid
        visited = set()
        while curr and curr not in visited:
            visited.add(curr)
            if curr in v2d:
                did = v2d[curr]
                if did != root_id: return did
            parent = vpar.get(curr)
            if parent:
                for sib in vchild.get(parent, []):
                    if sib != curr and sib in v2d:
                        did = v2d[sib]
                        if did != root_id: return did
            curr = parent
        return None

    def _is_smartart(self, shape) -> bool:
        try:
            return shape.element.graphic.graphicData.get("uri") == "http://schemas.openxmlformats.org/drawingml/2006/diagram"
        except AttributeError:
            return False

    def _get_rel_id(self, shape) -> Optional[str]:
        try:
            return shape.element.graphic.graphicData.find("dgm:relIds", self.NAMESPACES).get(f"{{{self.NAMESPACES['r']}}}dm")
        except AttributeError:
            return None

    def _parse_points(self, root, data_part, file_id, media_dir) -> Dict[str, SmartArtNode]:
        nodes = {}
        for pt in root.findall(".//dgm:pt", self.NAMESPACES):
            mid = pt.get("modelId")
            text = self._extract_text(pt)
            icon, icon_alt = self._extract_icon_and_alt(pt, data_part, file_id, media_dir)
            nodes[mid] = SmartArtNode(id=mid, text=text, icon=icon, icon_alt=icon_alt)
        return nodes

    def _extract_text(self, pt) -> str:
        def get_t(el):
            if el is None: return ""
            return "\n".join(["".join([t.text for t in p.findall(".//a:t", self.NAMESPACES) if t.text]) 
                             for p in el.findall(".//a:p", self.NAMESPACES)])
        txt = get_t(pt.find(".//dgm:t", self.NAMESPACES))
        if not txt: txt = get_t(pt.find(".//dgm:txBody", self.NAMESPACES))
        return txt

    def _extract_icon_and_alt(self, pt, data_part, file_id, media_dir) -> (Optional[str], Optional[str]):
        icon, icon_alt = None, None
        cnvpr = pt.find(".//a:cNvPr", self.NAMESPACES)
        if cnvpr is not None:
            icon_alt = cnvpr.get('descr') or cnvpr.get('title')
        blip = pt.find(".//a:blip", self.NAMESPACES)
        if blip is not None:
            rid = blip.get(f"{{{self.NAMESPACES['r']}}}embed")
            if rid:
                try:
                    p = data_part.related_part(rid)
                    ext = p.content_type.split('/')[-1].replace('x-', '').replace('+xml', '')
                    # Sanitize modelId for filename
                    mid = pt.get('modelId').replace('{','').replace('}','').replace('-','')
                    fname = f"sa_{mid}.{ext}"
                    path = os.path.join(media_dir, fname)
                    with open(path, "wb") as f: f.write(p.blob)
                    icon = f"media/{file_id}/{fname}"
                except (KeyError, IOError) as e:
                    logger.debug(f"Could not extract SmartArt icon: {e}")
        return icon, icon_alt

    def _build_tree(self, nodes_map, conns, pres_points) -> List[SmartArtNode]:
        children = {mid: [] for mid in nodes_map}; has_parent = set()
        for s, d in conns:
            if s in nodes_map and d in nodes_map: children[s].append(d); has_parent.add(d)
        def build(mid, lvl):
            n = nodes_map[mid]; n.level = lvl; n.children = []
            for cid in children[mid]:
                if cid not in pres_points: n.children.append(build(cid, lvl + 1))
            return n
        roots = [build(m, 0) for m in nodes_map if m not in has_parent and m not in pres_points]
        final = []
        for r in roots:
            if not r.text.strip() and not r.icon and r.children: final.extend(r.children)
            else: final.append(r)
        return final

    def _filter_empty_nodes(self, nodes: List[SmartArtNode]) -> List[SmartArtNode]:
        res = []
        for n in nodes:
            n.children = self._filter_empty_nodes(n.children)
            if n.text.strip() or n.icon or n.children: res.append(n)
        return res

    def _get_layout_name(self, slide_part, shape) -> str:
        try:
            rid = shape.element.graphic.graphicData.find("dgm:relIds", self.NAMESPACES).get(f"{{{self.NAMESPACES['r']}}}lo")
            return etree.fromstring(slide_part.related_part(rid).blob).find("dgm:title", self.NAMESPACES).get("val")
        except (AttributeError, KeyError, TypeError) as e:
            logger.debug(f"Could not get SmartArt layout name: {e}")
            return ""