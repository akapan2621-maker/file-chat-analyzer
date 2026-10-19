import type { NextApiRequest, NextApiResponse } from "next"
import { callKiloLLM } from "../../lib/kilollm"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const apiKey = process.env.KILO_LLM_API_KEY || req.body.apiKey
  if (!apiKey) {
    return res.status(500).json({ error: "KILO_LLM_API_KEY not configured" })
  }

  const { message, files } = req.body
  if (!message) {
    return res.status(400).json({ error: "Missing message" })
  }

  // สร้าง prompt รวมข้อมูลไฟล์ที่แนบมา
  const fileContexts = (files || []).map((f: any) => {
    return `\n### ไฟล์: ${f.originalName}\n- ขนาด: ${f.size} ไบต์\n- เนื้อหา/คำอธิบาย: ${f.content?.slice(0, 6000) || "(ไม่สามารถอ่านเนื้อหาโดยอัตโนมัติได้)"}`
  }).join("")

  const prompt = `คุณคือผู้ช่วยวิเคราะห์ข้อมูลที่เชี่ยวชาญ ตอบเป็นภาษาไทย กระชับ ได้ใจความ ใช้ emoji ประกอบได้

${fileContexts ? `## ไฟล์ที่แนบมา${fileContexts}` : ""}

## คำถาม
${message}

โปรดวิเคราะห์และตอบคำถามโดยอ้างอิงจากไฟล์ที่แนบมา (ถ้ามี) หากไม่แน่ใจให้บอกว่าไม่สามารถระบุได้แทนที่จะเดา`

  try {
    const reply = await callKiloLLM(apiKey, [
      { role: "user", content: prompt },
    ])
    return res.status(200).json({ reply })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "AI วิเคราะห์ไม่สำเร็จ" })
  }
}
