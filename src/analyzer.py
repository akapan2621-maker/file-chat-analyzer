"""สร้างคำถามส่งไปให้ AI วิเคราะห์ไฟล์ที่อัปโหลด"""

from __future__ import annotations

from typing import Any


def build_analysis_prompt(question: str, file_contexts: list[dict[str, Any]]) -> str:
    """รวมคำถามของผู้ใช้กับเนื้อหาไฟล์ที่แนบมาเป็น prompt เดียว"""
    parts: list[str] = []

    parts.append("คุณคือผู้ช่วยวิเคราะห์ข้อมูลที่เชี่ยวชาญด้านการเงิน, การเทรด, โปรแกรมมิ่ง, และข้อมูลทั่วไป")
    parts.append("ตอบเป็นภาษาไทย กระชับ ได้ใจความ ใช้ emoji ประกอบได้")
    parts.append("")

    if file_contexts:
        parts.append("## ไฟล์ที่ผู้ใช้แนบมาพร้อมคำถามนี้")
        for ctx in file_contexts:
            parts.append(f"\n### ไฟล์: {ctx['original_name']}")
            parts.append(f"- ประเภท: {ctx['mime_type']}")
            parts.append(f"- ขนาด: {ctx['size']:,} ไบต์")
            parts.append(f"- neื้อหา/คำอธิบาย:\n{ctx['content'][:6000]}")
            parts.append("")

    parts.append("## คำถามของผู้ใช้")
    parts.append(question)
    parts.append("")

    parts.append("## คำแนะนำ")
    parts.append("- ถ้าไฟล์เป็นข้อมูลตัวเลข (backtest, รายรับรายจ่าย,log) ให้คำนวณและสรุปสถิติสำคัญ")
    parts.append("- ถ้าไฟล์เป็นโค้ด (Python, MQL4/MQL5) ให้ตรวจ logic, หาจุดเสี่ยง, เสนอแนะการปรับปรุง")
    parts.append("- ถ้าไฟล์เป็นรูปภาพ ให้อธิบายสิ่งที่เห็นในภาพ และเชื่อมโยงกับคำถาม")
    parts.append("- ถ้าไม่แน่ใจ ให้บอกว่าไม่สามารถระบุได้แทนที่จะเดา")
    parts.append("- จัดรูปแบบด้วย Markdown หัวข้อ รายละเอียด และข้อเสนอแนะท้ายสุด")

    return "\n".join(parts)


def summarize_uploaded_file(file_info: dict[str, Any], content: str) -> str:
    """สร้างสรุปสั้นๆ ของไฟล์สำหรับแสดงในแชท"""
    lines = [
        f"📎 **{file_info['original_name']}**",
        f"  • ขนาด: {file_info['size']:,} ไบต์",
        f"  • อัปโหลด: {file_info['uploaded_at'][:16]}",
    ]
    return "\n".join(lines)
