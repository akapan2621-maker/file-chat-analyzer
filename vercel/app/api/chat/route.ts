import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      message,
      files,
      apiKey,
      baseUrl,
      modelId,
      temperature,
      topK,
      systemPrompt,
      ragContextChunks,
    } = body;

    if (!message) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "API Key not provided" },
        { status: 400 }
      );
    }

    // Build system prompt with RAG context
    let fullSystemPrompt = systemPrompt || "คุณคือผู้ช่วย AI ที่เชี่ยวชาญ ตอบเป็นภาษาไทย กระชับ ได้ใจความ";

    if (ragContextChunks && ragContextChunks.length > 0) {
      const contextText = ragContextChunks
        .map((c: any) => `[เอกสาร: ${c.fileName}]\n${c.text}\n---`)
        .join("\n");
      fullSystemPrompt += `\n\n# ข้อมูลอ้างอิงจากเอกสารที่แนบมา\n${contextText}\nโปรดอ้างอิงเอกสารเหล่านี้เมื่อตอบคำถาม และระบุชื่อเอกสารที่ใช้เป็นแหล่งที่มา`;
    }

    const baseURL = baseUrl || "https://api.kilocode.ai/v1";
    const model = modelId || "kilo-auto/free";
    const temp = temperature ?? 0.7;

    const response = await fetch(`${baseURL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: fullSystemPrompt },
          { role: "user", content: message },
        ],
        temperature: temp,
        stream: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `LLM Error ${response.status}: ${text}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      reply: data.choices?.[0]?.message?.content || "ไม่ได้รับคำตอบจาก AI",
      model,
      usage: data.usage,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" },
      { status: 500 }
    );
  }
}
