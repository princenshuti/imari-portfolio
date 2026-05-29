// MTN MoMo (M-Money) SMS grammar. Pure + versioned so format drift is tracked
// against fixtures. Handles received / sent / payment / withdrawal variants.
export const VERSION = 1;
export const SENDER_IDS = ['M-Money', 'MTN', 'MoMo'];

const num = (s) => Number(String(s).replace(/[,\s]/g, '')) || 0;

export function parseMtn(text) {
  if (!text || typeof text !== 'string') return null;
  const t = text.replace(/\s+/g, ' ').trim();
  let m, direction = null, amount = 0, counterparty = '';

  if ((m = t.match(/received\s+(?:RWF\s*)?([\d,]+)\s*(?:RWF|Frw)?\s+from\s+([^.,]+)/i))) {
    direction = 'in'; amount = num(m[1]); counterparty = m[2];
  } else if ((m = t.match(/(?:sent|paid|payment of|transferred)\s+(?:RWF\s*)?([\d,]+)\s*(?:RWF|Frw)?\s+to\s+([^.,]+)/i))) {
    direction = 'out'; amount = num(m[1]); counterparty = m[2];
  } else if ((m = t.match(/(?:withdrawn|withdrawal of)\s+(?:RWF\s*)?([\d,]+)/i))) {
    direction = 'out'; amount = num(m[1]); counterparty = 'Cash withdrawal';
  } else {
    return null;
  }

  const bal = t.match(/(?:new balance|balance)[:\s]+(?:RWF\s*)?([\d,]+)/i);
  const fee = t.match(/fee[:\s]+(?:RWF\s*)?([\d,]+)/i);
  return {
    provider: 'MTN MoMo',
    direction,
    amount,
    counterparty: counterparty.replace(/\s*\(.*\)\s*$/, '').trim(),
    balanceAfter: bal ? num(bal[1]) : null,
    fee: fee ? num(fee[1]) : 0,
  };
}
