/**
 * receiptOcr.js — the SINGLE ai-proxy vision pipeline for receipt + statement
 * capture (§8 OCR / B13 photo expense). Both entry points call parseReceiptImage
 * so there's no duplicate pipeline (B21 DoD).
 */
import { completeVision } from '../ai.js';
import { EXPENSE_CATEGORIES } from '../data.js';

/** Read a File into the { data, mediaType } shape completeVision expects. */
export function fileToImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('Please choose an image (PNG or JPG).'));
    if (file.size > 5 * 1024 * 1024) return reject(new Error('Image too large (max 5 MB).'));
    const reader = new FileReader();
    reader.onload = () => {
      const m = /^data:(.+?);base64,(.+)$/.exec(reader.result);
      if (!m) return reject(new Error('Could not read that image.'));
      resolve({ mediaType: m[1], data: m[2] });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Extract a structured expense from a receipt image via vision. */
export async function parseReceiptImage(image) {
  const cats = EXPENSE_CATEGORIES.map(c => c.id).join(', ');
  const prompt = `You are reading a Rwandan purchase receipt. Reply with STRICT JSON only, no prose, no code fences:
{"merchant": string, "amount": number, "date": "YYYY-MM-DD", "category": one of [${cats}], "confidence": number between 0 and 1}
Amounts are in RWF unless the receipt clearly shows another currency. If a field is unclear, still return your best guess and lower the confidence.`;
  const text = await completeVision(prompt, image);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Could not read the receipt — try a clearer photo.');
  let obj;
  try { obj = JSON.parse(match[0]); } catch { throw new Error('Could not parse the receipt.'); }
  const validCat = EXPENSE_CATEGORIES.some(c => c.id === obj.category) ? obj.category : 'other-exp';
  return {
    merchant: String(obj.merchant || '').slice(0, 120),
    amount: Number(obj.amount) || 0,
    date: /^\d{4}-\d{2}-\d{2}$/.test(obj.date) ? obj.date : new Date().toISOString().slice(0, 10),
    category: validCat,
    confidence: Math.max(0, Math.min(1, Number(obj.confidence) || 0)),
  };
}
