// Airtel Money SMS grammar. Airtel commonly writes "RWF 3,000" (currency first).
export const VERSION = 1;
export const SENDER_IDS = ['AirtelMoney', 'Airtel', 'Airtel Money'];

const num = (s) => Number(String(s).replace(/[,\s]/g, '')) || 0;

export function parseAirtel(text) {
  if (!text || typeof text !== 'string') return null;
  const t = text.replace(/\s+/g, ' ').trim();
  let m, direction = null, amount = 0, counterparty = '';

  if ((m = t.match(/received\s+(?:RWF\s*)?([\d,]+)\s*(?:RWF|Frw)?\s+from\s+([^.,]+)/i))) {
    direction = 'in'; amount = num(m[1]); counterparty = m[2];
  } else if ((m = t.match(/(?:sent|paid|payment of)\s+(?:RWF\s*)?([\d,]+)\s*(?:RWF|Frw)?\s+to\s+([^.,]+)/i))) {
    direction = 'out'; amount = num(m[1]); counterparty = m[2];
  } else if ((m = t.match(/(?:withdrawn|cash[- ]?out)\s+(?:of\s+)?(?:RWF\s*)?([\d,]+)/i))) {
    direction = 'out'; amount = num(m[1]); counterparty = 'Cash out';
  } else {
    return null;
  }

  const bal = t.match(/(?:bal(?:ance)?)[:\s]+(?:RWF\s*)?([\d,]+)/i);
  const fee = t.match(/(?:fee|charge)[:\s]+(?:RWF\s*)?([\d,]+)/i);
  return {
    provider: 'Airtel Money',
    direction,
    amount,
    counterparty: counterparty.replace(/\s*\(.*\)\s*$/, '').trim(),
    balanceAfter: bal ? num(bal[1]) : null,
    fee: fee ? num(fee[1]) : 0,
  };
}
