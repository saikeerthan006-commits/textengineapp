from __future__ import annotations

import base64
import io
import os
import re
from pathlib import Path

from docx import Document
from openpyxl import load_workbook
from pptx import Presentation

MAX_EXTRACTED_CHARS = 180_000
TEXT_EXTENSIONS = {
    ".txt", ".md", ".csv", ".tsv", ".json", ".jsonl", ".xml", ".html", ".htm", ".css", ".js", ".jsx", ".ts",
    ".tsx", ".py", ".java", ".c", ".h", ".cpp", ".cs", ".go", ".rs", ".php", ".rb", ".swift", ".kt", ".sql",
    ".sh", ".ps1", ".r", ".dart", ".scala", ".lua", ".pl", ".yaml", ".yml", ".toml", ".ini", ".log", ".tex",
}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"}
MODEL_EXTENSIONS = {".obj", ".mtl", ".blend"}


def _obj_summary(data: bytes) -> str:
    text = data.decode("utf-8-sig", errors="replace")
    counts = {"vertices": 0, "texture coordinates": 0, "normals": 0, "faces": 0}
    names = []
    keys = {"v": "vertices", "vt": "texture coordinates", "vn": "normals", "f": "faces"}
    for line in text.splitlines():
        parts = line.strip().split(maxsplit=1)
        if not parts:
            continue
        if parts[0] in keys:
            counts[keys[parts[0]]] += 1
        elif parts[0] in {"o", "g"} and len(parts) > 1:
            names.append(parts[1])
    details = ", ".join(f"{label}: {count}" for label, count in counts.items())
    return "[OBJ mesh summary]\n" + details + "\nobjects/groups: " + (", ".join(dict.fromkeys(names)) or "unnamed") + "\nUse edit_3d_asset for geometry edits; the mesh source is preserved server-side."


def _blend_summary(data: bytes) -> str:
    if not data.startswith(b"BLENDER"):
        raise ValueError("This file does not have a valid Blender .blend header.")
    pointer_size = "64-bit" if len(data) > 7 and data[7:8] == b"_" else "32-bit"
    byte_order = "little-endian" if len(data) > 8 and data[8:9] == b"v" else "big-endian"
    version = data[9:12].decode("ascii", errors="ignore")
    strings = [value.decode("utf-8", errors="ignore") for value in re.findall(rb"[A-Za-z][A-Za-z0-9 _.-]{3,70}\x00", data)]
    useful = []
    for value in strings:
        normalized = value.strip()
        if normalized and normalized not in useful and normalized not in {"BLENDER", "DNA1"}:
            useful.append(normalized)
        if len(useful) >= 20:
            break
    return f"[Blender binary project summary]\nVersion: {version}\nFormat: {pointer_size}, {byte_order}\nEmbedded labels: {', '.join(useful) if useful else 'none detected'}\nBlender scene editing uses a generated Blender Python script; the server does not execute .blend files."


def _image_ocr(data: bytes, extension: str) -> str:
    try:
        from PIL import Image
    except ImportError as exc:
        raise ValueError("Image reading is unavailable because Pillow is not installed.") from exc
    image = Image.open(io.BytesIO(data)).convert("RGB")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    key = os.getenv("NVIDIA_TEXDEV_API_KEY", "").strip()
    if not key:
        raise ValueError("Image OCR needs NVIDIA_TEXDEV_API_KEY configured on the server.")
    import requests

    response = requests.post(
        "https://ai.api.nvidia.com/v1/cv/nvidia/nemotron-ocr-v2",
        headers={"Authorization": f"Bearer {key}", "Accept": "application/json", "Content-Type": "application/json"},
        json={"input": [{"type": "image_url", "url": "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")}]},
        timeout=(10, 60),
    )
    response.raise_for_status()
    payload = response.json()
    detections = payload.get("data", [{}])[0].get("text_detections", [])
    text = "\n".join(item.get("text_prediction", {}).get("text", "") for item in detections if isinstance(item, dict))
    if not text.strip():
        raise ValueError("No readable text was found in this image.")
    return text


def extract_uploaded_text(filename: str, data: bytes) -> str:
    extension = Path(filename).suffix.lower()
    if extension == ".obj":
        return _obj_summary(data)
    if extension == ".blend":
        return _blend_summary(data)
    if extension == ".mtl":
        return data.decode("utf-8-sig", errors="replace")
    if extension in TEXT_EXTENSIONS:
        return data.decode("utf-8-sig", errors="replace")
    if extension == ".pdf":
        try:
            from pypdf import PdfReader
        except ImportError as exc:
            raise ValueError("PDF reading is unavailable because pypdf is not installed.") from exc
        reader = PdfReader(io.BytesIO(data))
        return "\n\n".join(f"[Page {index + 1}]\n{page.extract_text() or ''}" for index, page in enumerate(reader.pages))
    if extension == ".docx":
        doc = Document(io.BytesIO(data))
        return "\n".join([*(paragraph.text for paragraph in doc.paragraphs), *("\t".join(cell.text for cell in row.cells) for table in doc.tables for row in table.rows)])
    if extension == ".pptx":
        deck = Presentation(io.BytesIO(data))
        return "\n\n".join(f"[Slide {index + 1}]\n" + "\n".join(shape.text for shape in slide.shapes if getattr(shape, "has_text_frame", False) and shape.text.strip()) for index, slide in enumerate(deck.slides))
    if extension == ".xlsx":
        workbook = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        return "\n\n".join(f"[Sheet: {sheet.title}]\n" + "\n".join("\t".join("" if value is None else str(value) for value in row) for row in sheet.iter_rows(values_only=True)) for sheet in workbook.worksheets)
    if extension in IMAGE_EXTENSIONS:
        return _image_ocr(data, extension)
    raise ValueError(f"Unsupported file type: {extension or 'unknown'}. Supported files include text/code, PDF, Word, PowerPoint, Excel, and common images.")


def uploaded_text(files: dict[str, str], filename: str) -> str:
    value = files.get(filename)
    if value is None:
        raise ValueError("That uploaded filename is not attached to this request.")
    return value[:MAX_EXTRACTED_CHARS]
