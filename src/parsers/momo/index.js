// MoMo SMS parser dispatcher (§3). Regex-first across versioned grammar modules;
// callers route only UNMATCHED strings to a batched ai-proxy pass (cost control).
//
// NOTE: reading SMS requires the Android companion app (a PWA cannot). This
// module is the pure, testable parsing core that the companion POSTs into;
// manual entry always remains available.
import { parseMtn, SENDER_IDS as MTN_IDS } from './mtn.js';
import { parseAirtel, SENDER_IDS as AIRTEL_IDS } from './airtel.js';

const GRAMMARS = [
  { ids: MTN_IDS, parse: parseMtn },
  { ids: AIRTEL_IDS, parse: parseAirtel },
];

/**
 * Parse one MoMo confirmation SMS into structured fields, or null if unmatched.
 * Pass the SMS `sender` ID when known (the companion app has it) so the right
 * grammar is chosen — phrasing alone can be ambiguous across providers.
 * @returns {{ provider, direction:'in'|'out', amount, counterparty, balanceAfter, fee } | null}
 */
export function parseMomoSms(text, sender) {
  if (sender) {
    const lc = String(sender).toLowerCase();
    const g = GRAMMARS.find(x => x.ids.some(id => lc.includes(id.toLowerCase())));
    if (g) { const r = g.parse(text); return r && r.amount > 0 ? r : null; }
  }
  for (const g of GRAMMARS) {
    try {
      const r = g.parse(text);
      if (r && r.amount > 0) return r;
    } catch { /* a bad grammar must not break the batch */ }
  }
  return null;
}

/** Map a parsed SMS to a cashflow draft (source: 'momo-auto', confidence-flagged). */
export function momoToCashflowDraft(parsed, { date } = {}) {
  if (!parsed) return null;
  return {
    type: parsed.direction === 'in' ? 'income' : 'expense',
    amount: parsed.amount,
    currency: 'RWF',
    recurring: 'once',
    date: date || new Date().toISOString().slice(0, 10),
    notes: parsed.counterparty,
    source: 'momo-auto',
    confidence: 'high',
  };
}

export default parseMomoSms;
