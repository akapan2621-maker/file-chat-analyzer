"""ไฟล์หลักของเว็บแชท File Chat Analyzer (Streamlit)"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

import streamlit as st

from src.file_handler import FileHandler
from src.analyzer import build_analysis_prompt, summarize_uploaded_file

# ---------------------------------------------------------------------------
# ตั้งค่าหน้าเว็บ
# ---------------------------------------------------------------------------
st.set_page_config(
    page_title="File Chat Analyzer",
    page_icon="📎",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ---------------------------------------------------------------------------
# Session state เริ่มต้น
# ---------------------------------------------------------------------------
if "messages" not in st.session_state:
    st.session_state.messages = []  # list[dict]: {"role": "user"/"assistant", "content": str, "files": list}

if "uploaded_files_meta" not in st.session_state:
    st.session_state.uploaded_files_meta = []  # list of file metadata dicts

if "file_handler" not in st.session_state:
    st.session_state.file_handler = FileHandler(uploads_dir="uploads", output_dir="output")

# ---------------------------------------------------------------------------
# หัวเรื่อง
# ---------------------------------------------------------------------------
st.title("📎 File Chat Analyzer")
st.caption("อัปโหลดไฟล์ใดๆ ก็ได้ แล้วคุยกับ AI เพื่อวิเคราะห์ข้อมูล รองรับภาษาไทยเต็มรูปแบบ")

# ---------------------------------------------------------------------------
# Sidebar: จัดการไฟล์ที่อัปโหลด
# ---------------------------------------------------------------------------
with st.sidebar:
    st.header("📂 ไฟล์ที่อัปโหลด")

    uploaded = st.file_uploader(
        "เลือกไฟล์ (หลายไฟล์ได้)",
        accept_multiple_files=True,
        key="uploader",
        help="รองรับ CSV, TXT, JSON, PNG, JPG, PDF, PY, MQ4/MQ5, LOG และอื่นๆ",
    )

    if uploaded:
        for uf in uploaded:
            # ตรวจซ้ำกัน (กันอัปโหลดไฟล์เดิมซ้ำ)
            already = any(m["original_name"] == uf.name for m in st.session_state.uploaded_files_meta)
            if not already:
                meta = st.session_state.file_handler.save_uploaded_file(uf)
                st.session_state.uploaded_files_meta.append(meta)
                st.success(f"อัปโหลดแล้ว: {uf.name}")

    if st.session_state.uploaded_files_meta:
        st.divider()
        for meta in st.session_state.uploaded_files_meta:
            col1, col2 = st.columns([4, 1])
            with col1:
                st.write(f"📄 {meta['original_name']}")
                st.caption(f"{meta['size']:,} ไบต์ · {meta['uploaded_at'][:16]}")
            with col2:
                if st.button("ลบ", key=f"del_{meta['file_id']}"):
                    st.session_state.file_handler.delete_file(meta["path"])
                    st.session_state.uploaded_files_meta = [
                        m for m in st.session_state.uploaded_files_meta if m["file_id"] != meta["file_id"]
                    ]
                    st.rerun()

        if st.button("🗑️ ลบไฟล์ทั้งหมด", type="secondary"):
            for meta in st.session_state.uploaded_files_meta:
                st.session_state.file_handler.delete_file(meta["path"])
            st.session_state.uploaded_files_meta = []
            st.rerun()

# ---------------------------------------------------------------------------
# แสดงประวัติแชท
# ---------------------------------------------------------------------------
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])
        if msg.get("files"):
            with st.expander("ไฟล์ที่แนบมาในข้อความนี้", expanded=False):
                for f in msg["files"]:
                    st.write(f"• {f['original_name']} ({f['size']:,} ไบต์)")

# ---------------------------------------------------------------------------
# Input แชท
# ---------------------------------------------------------------------------
prompt = st.chat_input("พิมพ์คำถามที่นี่... เช่น 'ช่วยวิเคราะห์ไฟล์นี้ว่ามีจุดอ่อนตรงไหนบ้าง'")

if prompt:
    # เลือกไฟล์ที่จะแนบในคำถามนี้ (ใช้ไฟล์ทั้งหมดที่อัปโหลดไว้ใน session)
    files_for_this_msg = list(st.session_state.uploaded_files_meta)

    # อ่านเนื้อหาไฟล์สำหรับส่งให้ AI
    file_contexts: list[dict[str, Any]] = []
    for meta in files_for_this_msg:
        p = Path(meta["path"])
        mime = meta.get("type", "")
        content = ""

        if mime.startswith("image/") or p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
            try:
                info = st.session_state.file_handler.get_image_info(p)
                content = f"[รูปภาพ] {info['format']} {info['width']}x{info['height']} พิกเซล — โปรดอธิบายสิ่งที่เห็นในภาพ"
            except Exception as exc:  # noqa: BLE001
                content = f"[รูปภาพ] อ่านข้อมูลภาพไม่สำเร็จ: {exc}"
        elif p.suffix.lower() in FileHandler.EXTENSIONS_TEXT or p.suffix.lower() in FileHandler.EXTENSIONS_TABLE:
            try:
                content = st.session_state.file_handler.read_text_file(p)
            except Exception as exc:  # noqa: BLE001
                content = f"อ่านไฟล์ไม่สำเร็จ: {exc}"
        else:
            content = f"[ไฟล์ทั่วไป] {meta['original_name']} — ไม่สามารถอ่านเนื้อหาโดยอัตโนมัติได้"

        file_contexts.append(
            {
                "original_name": meta["original_name"],
                "mime_type": mime,
                "size": meta["size"],
                "content": content,
            }
        )

    # สร้าง prompt สำหรับ AI
    full_prompt = build_analysis_prompt(prompt, file_contexts)

    # แสดงข้อความผู้ใช้
    with st.chat_message("user"):
        st.markdown(prompt)
        if files_for_this_msg:
            with st.expander("ไฟล์ที่แนบมา", expanded=False):
                for f in files_for_this_msg:
                    st.write(f"• {f['original_name']} ({f['size']:,} ไบต์)")

    # บันทึกข้อความผู้ใช้
    st.session_state.messages.append(
        {"role": "user", "content": prompt, "files": files_for_this_msg, "ts": datetime.now().isoformat()}
    )

    # ตอบกลับจาก AI (ในที่นี้จะสะท้อนกลับว่า AI จะตอบอะไร — ส่วนจริงจะเชื่อมต่อ LLM ต่อไป)
    with st.chat_message("assistant"):
        with st.spinner("AI กำลังวิเคราะห์..."):
            # ถ้ามีไฟล์แนบ ให้แสดงสรุปไฟล์ก่อน
            if file_contexts:
                st.markdown("### 📋 ไฟล์ที่ได้รับแล้ว")
                for ctx in file_contexts:
                    st.markdown(summarize_uploaded_file(
                        {"original_name": ctx["original_name"], "size": ctx["size"]},
                        ctx["content"],
                    ))

            # ส่วนนี้คือจุดที่เชื่อมต่อกับ LLM จริง
            # ปัจจุบันจะแสดง prompt ที่สร้างขึ้น เพื่อให้นำไปใช้กับ LLM ต่อได้
            st.info("💡 ข้างล่างนี้คือเนื้อหาที่ถูกเตรียมไว้ส่งให้ AI วิเคราะห์ คุณสามารถคัดลอกไปใช้กับ LLM ที่ต้องการได้")
            with st.expander("ดู Prompt ที่ส่งให้ AI", expanded=False):
                st.code(full_prompt, language="markdown")

            # ตัวอย่างคำตอบเบื้องต้น (สามารถลบออกเมื่อเชื่อม LLM จริงแล้ว)
            st.markdown("---")
            st.markdown("### 🤖 คำตอบจาก AI")
            st.markdown(
                "ขณะนี้ยังไม่ได้เชื่อมต่อกับ LLM backend จริง\n\n"
                "หากต้องการให้ตอบอัตโนมัติ ให้เชื่อมต่อกับ API ของ OpenAI, Anthropic, Google Gemini "
                "หรือใช้ Hermes agent ตามโค้ดตัวอย่างด้านล่าง"
            )
            st.code(
                "# ตัวอย่างการเรียก LLM (เช่น OpenAI)\n"
                "import openai\n"
                "response = openai.chat.completions.create(\n"
                "    model=\"gpt-4o-mini\",\n"
                "    messages=[{\"role\": \"user\", \"content\": full_prompt}]\n"
                ")\n"
                "print(response.choices[0].message.content)"
            )

    # บันทึกข้อความผู้ช่วย
    st.session_state.messages.append(
        {
            "role": "assistant",
            "content": "ได้รับไฟล์แล้ว กำลังเตรียมวิเคราะห์...",
            "files": files_for_this_msg,
            "ts": datetime.now().isoformat(),
        }
    )

# ---------------------------------------------------------------------------
# ปุ่มล้างประวัติแชท
# ---------------------------------------------------------------------------
if st.session_state.messages:
    if st.button("🗑️ ล้างประวัติแชท", type="secondary"):
        st.session_state.messages = []
        st.rerun()
