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

    const baseURL = baseUrl || "https://api.kilo.ai/api/gateway";
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
        stream: true,
      }),
    });

    if (!response.ok) {
      const text = (await response.text()).slice(0, 500);
      return NextResponse.json(
        { error: `LLM Error ${response.status}: ${text}` },
        { status: 500 }
      );
    }

    // Stream the upstream SSE through to the client as plain text.
    // The client reads response.body as a raw text stream and appends chunks,
    // so we must forward only the content deltas — not the SSE framing.
    const upstream = response.body;
    if (!upstream) {
      const data = await response.json();
      return NextResponse.json({
        reply: data.choices?.[0]?.message?.content || "ไม่ได้รับคำตอบจาก AI",
        model,
        usage: data.usage,
      });
    }

    const reader = upstream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            // SSE frames are separated by a blank line
            const parts = buffer.split("\n\n");
            buffer = parts.pop() ?? "";

            for (const part of parts) {
              for (const line of part.split("\n")) {
                if (!line.startsWith("data:")) continue;
                const payload = line.slice(5).trim();
                if (!payload || payload === "[DONE]") continue;
                try {
                  const parsed = JSON.parse(payload);
                  const delta =
                    parsed.choices?.[0]?.delta?.content ??
                    parsed.choices?.[0]?.message?.content ??
                    "";
                  if (delta) {
                    fullContent += delta;
                    controller.enqueue(new TextEncoder().encode(delta));
                  }
                } catch {
                  // Ignore keep-alive / non-JSON frames
                }
              }
            }
          }
          controller.close();
        } catch (err: any) {
          controller.error(err);
        }
      },
      cancel() {
        reader.cancel();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" },
      { status: 500 }
    );
  }
}
