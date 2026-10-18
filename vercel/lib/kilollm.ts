export const KILO_BASE_URL = process.env.KILO_LLM_BASE_URL || "https://api.kilo.ai/v1"
export const KILO_MODEL = process.env.KILO_LLM_MODEL || "kilo-auto/free"

export async function callKiloLLM(apiKey: string, messages: { role: string; content: string }[]) {
  const response = await fetch(`${KILO_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: KILO_MODEL,
      messages,
      temperature: 0.7,
      stream: false,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Kilo LLM error ${response.status}: ${text}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || "ไม่ได้รับคำตอบจาก AI"
}
