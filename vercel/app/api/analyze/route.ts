import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, files, apiKey } = body;

    if (!message) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "กรุณาใส่ API Key ในหน้าเว็บก่อนส่งข้อความ" },
        { status: 400 }
      );
    }

    const fileContexts = (files || []).map(
      (f: any) =>
        `\n### ไฟล์: ${f.originalName}\n- ขนาด: ${f.size} ไบต์\n- เนื้อหา: ${f.content?.slice(0, 6000) || "(ไม่สามารถอ่านเนื้อหาโดยอัตโนมัติได้)"}`
    ).join("");

    const prompt = `คุณคือผู้ช่วยวิเคราะห์ข้อมูลที่เชี่ยวชาญ ตอบเป็นภาษาไทย กระชับ ได้ใจความ ใช้ emoji ประกอบได้

${fileContexts ? `## ไฟล์ที่แนบมา${fileContexts}` : ""}

## คำถาม
${message}

โปรดวิเคราะห์และตอบคำถามโดยอ้างอิงจากไฟล์ที่แนบมา (ถ้ามี) หากไม่แน่ใจให้บอกว่าไม่สามารถระบุได้แทนที่จะเดา`;

    const baseURL = "https://api.kilo.ai/v1";
    const model = "kilo-auto/free";

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        stream: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `Kilo LLM error ${response.status}: ${text}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    return NextResponse.json({ reply: data.choices?.[0]?.message?.content || "ไม่ได้รับคำตอบจาก AI" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "AI วิเคราะห์ไม่สำเร็จ" }, { status: 500 });
  }
}
