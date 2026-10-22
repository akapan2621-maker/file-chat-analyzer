/**
 * Thai term extraction.
 *
 * Thai has no spaces between words, so naive whitespace tokenising makes a
 * whole sentence one giant token. A dictionary-driven longest-match scan
 * recovers real word boundaries without needing an LLM or a heavy NLP
 * dependency.
 *
 * The dictionary holds common Thai words. It is intentionally small and
 * extendable — unknown words fall back to a character n-gram.
 */

const THAI_COMMON = [
  // business / finance
  "ยอดขาย", "ยอดรวม", "รายได้", "กำไร", "ขาดทุน", "ต้นทุน", "งบประมาณ", "ราคา", "ราคาขาย",
  "ตลาด", "หุ้น", "ทอง", "อัตรา", "ดอกเบี้ย", "ภาษี", "เงิน", "บัญชี", "ธนาคาร", "เงินสด",
  "กำไรขั้นต้น", "ส่วนแบ่ง", "ลูกค้า", "คู่แข่ง", "อุตสาหกรรม", "ธุรกิจ", "บริษัท",
  // channels / operations
  "ช่องทาง", "ช่องทางขาย", "เว็บไซต์", "เว็บ", "ร้านค้า", "ตัวแทน", "ตัวแทนขาย", "แอป",
  "ช้อปปิ้ง", "ออเดอร์", "ส่งของ", "โลจิสติกส์", "คลังสินค้า", "สต็อก", "ซัพพลาย", "ผู้ผลิต",
  // time
  "ไตรมาส", "เดือน", "ปี", "วัน", "สัปดาห์", "ชั่วโมง", "วันที่", "เวลา", "ไตรมาสก่อน",
  // reporting
  "รายงาน", "สรุป", "ผล", "ผลการ", "การเติบโต", "เติบโต", "ลดลง", "เพิ่มขึ้น", "ลดลง",
  "สัดส่วน", "เปอร์เซ็นต์", "แนวโน้ม", "ผลการประมวลผล", "การตลาด", "ค่าใช้จ่าย",
  // generic verbs / connectors
  "และ", "หรือ", "ที่", "ซึ่ง", "ของ", "ใน", "บน", "กับ", "โดย", "เป็น", "มี", "ได้", "ให้",
  "จะ", "ไม่", "มา", "ไป", "ก็", "แล้ว", "ยัง", "อยู่", "ควร", "ต้อง", "คือ", "ถ้า", "เมื่อ",
  "เพราะ", "เพื่อ", "จาก", "แต่", "หรือไม่", "มาก", "น้อย", "ทั้งหมด", "ทุก", "บาง",
  // common nouns
  "ข้อมูล", "เอกสาร", "ระบบ", "โปรแกรม", "ทีม", "พนักงาน", "ลูกค้า", "สินค้า", "บริการ",
  "ผลิตภัณฑ์", "โปรโมชั่น", "โปรโมชัน", "การตลาด", "ยุค", "ฤดู", "ฝน",
  // adjectives
  "ดี", "ไม่ดี", "สูง", "ต่ำ", "มาก", "น้อย", "ใหม่", "เก่า", "สำคัญ", "จำเป็น",
  "โดยรวม", "รวม", "เฉพาะ", "ทั้ง", "รวมถึง",
  // connectors / verbs that glue words together
  "ผ่าน", "ผ่านช่องทาง", "สั่งซื้อ", "ที่สุด", "มากที่สุด", "เทียบกับ",
  "เมื่อเทียบกับ", "ต่อเนื่อง", "เพิ่มขึ้นต่อเนื่อง", "เพิ่มขึ้น", "ลดลง",
  "เฉลี่ย", "คิดเป็น", "ประมาณ", "รวมถึง", "ของทั้งหมด", "ในรอบ",
  "ปี", "เดือน", "ไตรมาส", "งวด", "ช่วง", "ตลอด", "เฉพาะ", "ถึง",
];

/** Characters that can never START a Thai word (combining marks). */
const NO_START = new Set([
  "่", "้", "๊", "๋", "์", "ั", "ิ", "ี", "�", "ื", "ุ", "ู", "็", "ํ",
]);

const THAI_RUN = /[฀-๿]+/g;

/**
 * Longest-match segmentation of a Thai run against the dictionary.
 * Returns the matched terms plus the unmatched leftovers (as n-grams).
 */
export function segmentThai(run: string, dict: string[] = THAI_COMMON): string[] {
  // Longest first so "ช่องทางขาย" wins over "ช่องทาง".
  const sorted = [...dict].sort((a, b) => b.length - a.length);
  const out: string[] = [];
  let i = 0;

  while (i < run.length) {
    if (NO_START.has(run[i])) {
      i += 1;
      continue;
    }
    let matched = "";
    for (const word of sorted) {
      if (run.startsWith(word, i)) {
        matched = word;
        break;
      }
    }
    if (matched) {
      out.push(matched);
      i += matched.length;
    } else {
      // Unknown word. Before falling back to a raw 3-char fragment, look
      // ahead for the next dictionary word — otherwise a blind fragment can
      // swallow the first characters of that word ("ช่องทาง" -> "นช่").
      let jump = -1;
      for (let k = i + 1; k < Math.min(i + 12, run.length); k++) {
        if (NO_START.has(run[k])) continue;
        if (sorted.some((w) => run.startsWith(w, k))) {
          jump = k;
          break;
        }
      }
      if (jump > i) {
        const frag = run.slice(i, jump);
        if (frag) out.push(frag);
        i = jump;
      } else {
        const end = Math.min(i + 3, run.length);
        const frag = run.slice(i, end);
        if (frag && !NO_START.has(frag[0])) out.push(frag);
        i = end;
      }
    }
  }
  return out;
}

/**
 * Tokenise mixed Thai/Latin text into word-like units.
 * Latin words stay whole; Thai runs are segmented against the dictionary.
 */
export function segmentMixed(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];

  // Latin/digit words
  const latin = text
    .toLowerCase()
    .replace(/[฀-๿]+/g, " ")
    .split(/[^a-z0-9'_-]+/i)
    .filter((w) => w.length > 0);
  out.push(...latin);

  // Thai runs, segmented
  for (const run of text.toLowerCase().match(THAI_RUN) ?? []) {
    out.push(...segmentThai(run));
  }
  return out;
}
