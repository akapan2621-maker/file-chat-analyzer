"""จัดการอัปโหลดและอ่านไฟล์สำหรับ File Chat Analyzer"""

from __future__ import annotations

import hashlib
import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd
from PIL import Image


class FileHandler:
    """จัดการไฟล์ที่ผู้ใช้อัปโหลดเข้ามาในแชท"""

    EXTENSIONS_TEXT = {".txt", ".csv", ".json", ".py", ".mq4", ".mq5", ".log", ".md", ".html", ".xml", ".yaml", ".yml"}
    EXTENSIONS_IMAGE = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"}
    EXTENSIONS_TABLE = {".csv", ".xlsx", ".xls", ".tsv"}

    def __init__(self, uploads_dir: str | Path = "uploads", output_dir: str | Path = "output"):
        self.uploads_dir = Path(uploads_dir)
        self.output_dir = Path(output_dir)
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def save_uploaded_file(self, uploaded_file) -> dict[str, Any]:
        """บันทึกไฟล์จาก streamlit UploadedFile คืนค่า metadata"""
        file_id = hashlib.md5(f"{uploaded_file.name}{datetime.now().isoformat()}".encode()).hexdigest()[:12]
        safe_name = f"{file_id}_{uploaded_file.name}"
        dest_path = self.uploads_dir / safe_name

        with open(dest_path, "wb") as f:
            f.write(uploaded_file.getbuffer())

        return {
            "file_id": file_id,
            "original_name": uploaded_file.name,
            "saved_name": safe_name,
            "path": str(dest_path),
            "size": uploaded_file.size,
            "type": uploaded_file.type,
            "uploaded_at": datetime.now().isoformat(),
        }

    def read_text_file(self, path: str | Path) -> str:
        """อ่านไฟล์ข้อความ คืนค่าเป็นสตริง"""
        p = Path(path)
        if p.suffix.lower() == ".csv":
            df = pd.read_csv(p, nrows=50)
            return df.to_markdown(index=False) + f"\n\n(แสดง 50 แถวแรกจากทั้งหมด {len(df)} แถว)"
        if p.suffix.lower() in {".xlsx", ".xls"}:
            df = pd.read_excel(p, nrows=50)
            return df.to_markdown(index=False) + f"\n\n(แสดง 50 แถวแรกจากทั้งหมด {len(df)} แถว)"
        if p.suffix.lower() == ".json":
            with open(p, encoding="utf-8") as f:
                data = json.load(f)
            return json.dumps(data, ensure_ascii=False, indent=2)[:8000]
        # ข้อความธรรมดา
        with open(p, encoding="utf-8", errors="replace") as f:
            return f.read()

    def get_image_info(self, path: str | Path) -> dict[str, Any]:
        """ดึงข้อมูลภาพเบื้องต้น"""
        with Image.open(path) as img:
            return {
                "format": img.format,
                "mode": img.mode,
                "size": img.size,  # (width, height)
                "width": img.width,
                "height": img.height,
            }

    def list_uploaded_files(self) -> list[dict[str, Any]]:
        """ดึงรายการไฟล์ที่อัปโหลดไว้ทั้งหมด"""
        files = []
        for p in sorted(self.uploads_dir.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
            if p.is_file():
                files.append(
                    {
                        "name": p.name,
                        "path": str(p),
                        "size": p.stat().st_size,
                        "modified": datetime.fromtimestamp(p.stat().st_mtime).isoformat(),
                    }
                )
        return files

    def delete_file(self, path: str | Path) -> bool:
        """ลบไฟล์ที่อัปโหลด"""
        try:
            Path(path).unlink()
            return True
        except FileNotFoundError:
            return False
