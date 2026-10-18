# Deploy บน Vercel

## ขั้นตอนการติดตั้ง

```bash
# เข้าโฟลเดอร์ vercel
cd /opt/data/projects/file-chat-analyzer/vercel

# ติดตั้ง dependency
npm install

# รันทดสอบในเครื่อง
npm run dev
```

## Deploy 上 Vercel

```bash
# ล็อกอิน Vercel (ครั้งแรก)
npx vercel login

# Deploy ชั่วคราว (URL ใช้ได้ 60 นาที)
npx vercel deploy

# Deploy ถาวร (ต้องมี token และ repo ถูกผูกกับ GitHub แล้ว)
npx vercel --prod
```

## ตั้งค่า Environment Variables บน Vercel

ไปที่ **Vercel Dashboard → 项目 → Settings → Environment Variables** เพิ่ม:

| Key | ตัวอย่างค่า |
|-----|-------------|
| `KILO_LLM_API_KEY` | API key ของ kilo LLM |
| `KILO_LLM_BASE_URL` | `https://api.kilo.ai/v1` (แก้ตามจริง) |
| `KILO_LLM_MODEL` | `kilo-auto/free` |

## หมายเหตุ

- Streamlit รันบน Vercel **ไม่ได้** (ต้องการ server ถาวร) → ใช้ Next.js แทนแล้ว
- API route `/api/analyze` จะเรียก kilo LLM ผ่าน `lib/kilollm.ts`
- ถ้า kilo LLM ใช้ endpoint หรือ auth รูปแบบอื่น ให้แก้ไขที่ `lib/kilollm.ts` และ `pages/api/analyze.ts`
