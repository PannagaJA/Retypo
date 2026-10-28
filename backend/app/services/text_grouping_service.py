import math
import uuid
import re
from typing import List, Dict, Any, Tuple, Optional
import numpy as np

class TextGroupingService:
    """
    Groups individual OCR words into natural, accurately bounded text regions:
    1. Line-level grouping: words belonging to the same visual line or logical text field.
    2. Block/Paragraph grouping: multi-line wrapped sentences or field groups.
    3. Preserves word-level polygons, bboxes, and confidence scores for sub-word selection.
    """

    @classmethod
    def group_words(
        cls,
        raw_words: List[Dict[str, Any]],
        image_width: int,
        image_height: int
    ) -> List[Dict[str, Any]]:
        """
        Main entry point for grouping raw words into structured text line regions.
        Each raw_word must have:
          - text: str
          - polygon: List[List[float]] (4 vertices)
          - confidence: float
        Optional fields:
          - block_idx: int
          - paragraph_idx: int
          - break_type: str ('SPACE', 'SURE_SPACE', 'EOL_SURE_SPACE', 'LINE_BREAK', 'HYPHEN')
        
        Returns a list of grouped region dicts:
          - text: str (combined line text)
          - polygon: List[List[float]] (union bounding polygon)
          - bbox: Tuple[float, float, float, float] (left, top, width, height)
          - confidence: float
          - words: List[Dict[str, Any]] (constituent word regions)
          - lineId: str
          - paragraphId: str
          - blockId: str
          - groupLevel: 'line'
        """
        if not raw_words:
            return []

        # 1. Clean and normalize input word geometries
        cleaned_words: List[Dict[str, Any]] = []
        for idx, w in enumerate(raw_words):
            text = (w.get("text") or "").strip()
            if not text:
                continue
            poly = w.get("polygon")
            if not poly or len(poly) < 4:
                continue

            xs = [float(p[0]) for p in poly]
            ys = [float(p[1]) for p in poly]
            min_x, max_x = min(xs), max(xs)
            min_y, max_y = min(ys), max(ys)
            width = max_x - min_x
            height = max_y - min_y

            if width <= 0 or height <= 0:
                continue

            # If a single OCR item contains multiple spaces or tabs (e.g. "Label       Value"),
            # split it into separate words with estimated horizontal geometry
            if re.search(r'\s{2,}|\t', text):
                sub_segments = [seg for seg in re.split(r'(\s{2,}|\t)', text) if seg]
                total_chars = max(1, sum(len(s) for s in sub_segments))
                curr_x = min_x
                for seg in sub_segments:
                    seg_len = len(seg)
                    seg_w = (seg_len / total_chars) * width
                    if not seg.strip():
                        curr_x += seg_w
                        continue
                    seg_poly = [
                        [round(curr_x, 1), round(min_y, 1)],
                        [round(curr_x + seg_w, 1), round(min_y, 1)],
                        [round(curr_x + seg_w, 1), round(max_y, 1)],
                        [round(curr_x, 1), round(max_y, 1)],
                    ]
                    cleaned_words.append({
                        "wordId": f"w-{idx}-{uuid.uuid4().hex[:6]}",
                        "text": seg.strip(),
                        "polygon": seg_poly,
                        "bbox": (round(curr_x, 1), round(min_y, 1), round(seg_w, 1), round(height, 1)),
                        "confidence": float(w.get("confidence", 0.98)),
                        "center_x": curr_x + seg_w / 2.0,
                        "center_y": (min_y + max_y) / 2.0,
                        "min_x": curr_x,
                        "max_x": curr_x + seg_w,
                        "min_y": min_y,
                        "max_y": max_y,
                        "width": seg_w,
                        "height": height,
                        "block_idx": w.get("block_idx"),
                        "paragraph_idx": w.get("paragraph_idx"),
                        "break_type": w.get("break_type"),
                    })
                    curr_x += seg_w
                continue

            cleaned_words.append({
                "wordId": w.get("wordId") or f"w-{idx}-{uuid.uuid4().hex[:6]}",
                "text": text,
                "polygon": [[round(p[0], 1), round(p[1], 1)] for p in poly[:4]],
                "bbox": (round(min_x, 1), round(min_y, 1), round(width, 1), round(height, 1)),
                "confidence": float(w.get("confidence", 0.98)),
                "center_x": (min_x + max_x) / 2.0,
                "center_y": (min_y + max_y) / 2.0,
                "min_x": min_x,
                "max_x": max_x,
                "min_y": min_y,
                "max_y": max_y,
                "width": width,
                "height": height,
                "block_idx": w.get("block_idx"),
                "paragraph_idx": w.get("paragraph_idx"),
                "break_type": w.get("break_type"),
            })

        if not cleaned_words:
            return []

        # 2. Check if Google Vision paragraph/block hierarchy is available
        has_hierarchy = any(w["paragraph_idx"] is not None for w in cleaned_words)

        if has_hierarchy:
            lines = cls._group_by_hierarchy(cleaned_words, image_width, image_height)
        else:
            lines = cls._group_by_geometry(cleaned_words, image_width, image_height)

        # 3. Build structured region representations with tight union polygons
        grouped_regions: List[Dict[str, Any]] = []
        for line_idx, line in enumerate(lines):
            line_words = line["words"]
            if not line_words:
                continue

            # Sort words from left to right
            line_words.sort(key=lambda w: w["min_x"])

            # Compute combined text with natural spacing
            combined_text = cls._join_words_text(line_words)
            if not combined_text:
                continue

            # Compute tight union polygon and bbox
            union_poly, union_bbox = cls._compute_line_union_polygon(line_words)

            # Average confidence
            avg_conf = round(sum(w["confidence"] for w in line_words) / len(line_words), 3)

            p_id = line.get("paragraphId") or f"p-{line.get('paragraph_idx', line_idx)}"
            b_id = line.get("blockId") or f"b-{line.get('block_idx', 0)}"

            region_dict = {
                "text": combined_text,
                "polygon": union_poly,
                "bbox": union_bbox,
                "confidence": avg_conf,
                "words": [
                    {
                        "wordId": w["wordId"],
                        "text": w["text"],
                        "polygon": w["polygon"],
                        "bbox": w["bbox"],
                        "confidence": round(w["confidence"], 3),
                    }
                    for w in line_words
                ],
                "lineId": f"line-{line_idx + 1}",
                "paragraphId": p_id,
                "blockId": b_id,
                "groupLevel": "line",
            }
            grouped_regions.append(region_dict)

        # Final reading-order sort: top to bottom, left to right
        grouped_regions.sort(key=lambda r: (round(r["bbox"][1] / max(12, r["bbox"][3] * 0.8)), r["bbox"][0]))
        return grouped_regions

    @classmethod
    def _group_by_hierarchy(
        cls,
        words: List[Dict[str, Any]],
        image_width: int,
        image_height: int
    ) -> List[Dict[str, Any]]:
        """
        Groups words using Google Vision's paragraph and detectedBreak metadata.
        Words in different blocks or paragraphs are strictly kept in separate groups.
        Within a paragraph, words are split into lines upon encountering EOL_SURE_SPACE,
        LINE_BREAK, HYPHEN, or large geometric baseline shifts.
        """
        # Bucket by (block_idx, paragraph_idx)
        para_buckets: Dict[Tuple[int, int], List[Dict[str, Any]]] = {}
        for w in words:
            b_idx = w["block_idx"] if w["block_idx"] is not None else 0
            p_idx = w["paragraph_idx"] if w["paragraph_idx"] is not None else 0
            key = (b_idx, p_idx)
            if key not in para_buckets:
                para_buckets[key] = []
            para_buckets[key].append(w)

        lines: List[Dict[str, Any]] = []

        for (b_idx, p_idx), p_words in para_buckets.items():
            current_line_words: List[Dict[str, Any]] = []

            for w in p_words:
                break_type = w.get("break_type")

                # Check if current word baseline differs drastically from ongoing line
                if current_line_words:
                    prev_w = current_line_words[-1]
                    avg_h = sum(item["height"] for item in current_line_words) / len(current_line_words)
                    
                    # Vertical displacement check
                    y_diff = abs(w["center_y"] - prev_w["center_y"])
                    # If vertical shift > 55% of font height, it belongs to the next visual line
                    if y_diff > 0.55 * max(avg_h, w["height"]):
                        lines.append({
                            "words": current_line_words,
                            "paragraphId": f"p-{b_idx}-{p_idx}",
                            "blockId": f"b-{b_idx}",
                            "block_idx": b_idx,
                            "paragraph_idx": p_idx,
                        })
                        current_line_words = []
                    # Horizontal backwards jump (next word is to the left of ongoing line)
                    elif w["min_x"] < prev_w["min_x"] - 5:
                        lines.append({
                            "words": current_line_words,
                            "paragraphId": f"p-{b_idx}-{p_idx}",
                            "blockId": f"b-{b_idx}",
                            "block_idx": b_idx,
                            "paragraph_idx": p_idx,
                        })
                        current_line_words = []
                    # Column boundary protection: wide horizontal gap (> 1.4 * height or > 14px)
                    effective_h = (avg_h + w["height"]) / 2.0
                    gap = w["min_x"] - prev_w["max_x"]
                    if gap > max(14.0, 1.4 * effective_h) and len(current_line_words) >= 1:
                        # Split columns or fields separated by wide space
                        lines.append({
                            "words": current_line_words,
                            "paragraphId": f"p-{b_idx}-{p_idx}",
                            "blockId": f"b-{b_idx}",
                            "block_idx": b_idx,
                            "paragraph_idx": p_idx,
                        })
                        current_line_words = []

                current_line_words.append(w)

                # If this word specifies an explicit end-of-line break, close current line
                if break_type in {"LINE_BREAK", "EOL_SURE_SPACE", "HYPHEN"}:
                    lines.append({
                        "words": current_line_words,
                        "paragraphId": f"p-{b_idx}-{p_idx}",
                        "blockId": f"b-{b_idx}",
                        "block_idx": b_idx,
                        "paragraph_idx": p_idx,
                    })
                    current_line_words = []

            if current_line_words:
                lines.append({
                    "words": current_line_words,
                    "paragraphId": f"p-{b_idx}-{p_idx}",
                    "blockId": f"b-{b_idx}",
                    "block_idx": b_idx,
                    "paragraph_idx": p_idx,
                })

        return lines

    @classmethod
    def _group_by_geometry(
        cls,
        words: List[Dict[str, Any]],
        image_width: int,
        image_height: int
    ) -> List[Dict[str, Any]]:
        """
        Groups words using geometric line clustering and horizontal proximity.
        Works across all OCR engines (Google Vision fallback, PaddleOCR, etc.).
        """
        # Sort words primarily by y-center, secondarily by x-min
        sorted_words = sorted(words, key=lambda w: (w["center_y"], w["min_x"]))

        # Cluster words into lines based on vertical overlap and center distance
        line_clusters: List[List[Dict[str, Any]]] = []

        for w in sorted_words:
            matched_cluster: Optional[List[Dict[str, Any]]] = None
            best_y_diff = float("inf")

            for cluster in line_clusters:
                c_avg_y = sum(item["center_y"] for item in cluster) / len(cluster)
                c_avg_h = sum(item["height"] for item in cluster) / len(cluster)
                c_min_y = min(item["min_y"] for item in cluster)
                c_max_y = max(item["max_y"] for item in cluster)

                # 1. Height compatibility (prevent merging large headers with tiny subtext)
                h_ratio = min(w["height"], c_avg_h) / max(w["height"], c_avg_h)
                if h_ratio < 0.40:
                    continue

                # 2. Vertical overlap
                v_overlap = min(w["max_y"], c_max_y) - max(w["min_y"], c_min_y)
                y_center_diff = abs(w["center_y"] - c_avg_y)

                if v_overlap >= 0.35 * min(w["height"], c_avg_h) or y_center_diff <= 0.45 * c_avg_h:
                    if y_center_diff < best_y_diff:
                        best_y_diff = y_center_diff
                        matched_cluster = cluster

            if matched_cluster is not None:
                matched_cluster.append(w)
            else:
                line_clusters.append([w])

        lines: List[Dict[str, Any]] = []

        # Within each line cluster, sort words horizontally and split separated columns
        for c_idx, cluster in enumerate(line_clusters):
            cluster.sort(key=lambda w: w["min_x"])
            
            sub_line: List[Dict[str, Any]] = []
            for w in cluster:
                if sub_line:
                    prev_w = sub_line[-1]
                    avg_h = sum(item["height"] for item in sub_line) / len(sub_line)
                    effective_h = (avg_h + w["height"]) / 2.0
                    gap = w["min_x"] - prev_w["max_x"]

                    # Split columns or disconnected fields if gap > 1.4 * font height (or > 14px)
                    if gap > max(14.0, 1.4 * effective_h):
                        lines.append({
                            "words": sub_line,
                            "paragraphId": f"p-geo-{c_idx}",
                            "blockId": f"b-geo-0",
                        })
                        sub_line = []

                sub_line.append(w)

            if sub_line:
                lines.append({
                    "words": sub_line,
                    "paragraphId": f"p-geo-{c_idx}",
                    "blockId": f"b-geo-0",
                })

        return lines

    @classmethod
    def _compute_line_union_polygon(
        cls,
        words: List[Dict[str, Any]]
    ) -> Tuple[List[List[float]], Tuple[float, float, float, float]]:
        """
        Calculates an accurate quadrilateral bounding polygon from the constituent word polygons.
        Preserves the first word's complete leading edge and last word's complete trailing edge
        without clipping or arbitrary artificial padding.
        """
        if len(words) == 1:
            w = words[0]
            return w["polygon"], w["bbox"]

        # Collect all vertices from all constituent words
        all_pts: List[List[float]] = []
        for w in words:
            all_pts.extend(w["polygon"])

        xs = [p[0] for p in all_pts]
        ys = [p[1] for p in all_pts]

        min_x = round(min(xs), 1)
        max_x = round(max(xs), 1)
        min_y = round(min(ys), 1)
        max_y = round(max(ys), 1)

        width = round(max_x - min_x, 1)
        height = round(max_y - min_y, 1)

        # Standard oriented rectangle enclosing the line
        poly = [
            [min_x, min_y],
            [max_x, min_y],
            [max_x, max_y],
            [min_x, max_y]
        ]
        bbox = (min_x, min_y, width, height)
        return poly, bbox

    @classmethod
    def _join_words_text(cls, words: List[Dict[str, Any]]) -> str:
        """
        Joins words into clean line text, respecting hyphens, currency symbols, and punctuation.
        """
        tokens: List[str] = []
        for idx, w in enumerate(words):
            text = w["text"].strip()
            if not text:
                continue

            if not tokens:
                tokens.append(text)
                continue

            prev = tokens[-1]
            # If previous token is an opening currency symbol or hyphen attached to number
            if prev in {"₹", "$", "€", "£", "¥"} and text[0].isdigit():
                tokens[-1] = f"{prev}{text}"
            elif prev == "-" and idx == 1 and not tokens[0].isdigit():
                # e.g. "BHIM - Bharat's"
                tokens.append(text)
            elif text in {",", ".", ":", ";", "%", "'", "'s", "’s"}:
                tokens[-1] = f"{prev}{text}"
            elif prev.endswith("-") and len(prev) > 1 and prev[:-1].isalpha() and text.isalpha():
                # Hyphenated word wrap: "inter- national" -> "international"
                tokens[-1] = f"{prev[:-1]}{text}"
            else:
                tokens.append(text)

        return " ".join(tokens)
