/**
 * bankImport.js — parse bank statement CSV/TSV files and suggest cashflow categories.
 *
 * Handles common Rwandan bank statement formats (BK, Equity, I&M, MTN MoMo, etc.)
 * Auto-detects columns; caller can override with a column map.
 */

// ─── CSV parser ──────────────────────────────────────────────────────────────
export function parseCSV(text) {
  // Detect delimiter from first line
  const firstLine = text.split(/\r?\n/)[0] || '';
  const delim = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ',';

  const parseRow = (line) => {
    const fields = [];
    let inQ = false, cur = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === delim && !inQ) {
        fields.push(cur.trim()); cur = '';
      } else {
        cur += ch;
      }
    }
    fields.push(cur.trim());
    return fields;
  };

  const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'));
  if (!lines.length) return { headers: [], rows: [], rawHeaders: [] };

  // Try to find the header row (first row with recognisable column names)
  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes('date') || lower.includes('amount') || lower.includes('debit') || lower.includes('credit') || lower.includes('description')) {
      headerIdx = i;
      break;
    }
  }

  const rawHeaders = parseRow(lines[headerIdx]);
  const headers = rawHeaders.map(h => h.replace(/^["']|["']$/g, '').trim());
  const rows = lines.slice(headerIdx + 1).map(l => {
    const fields = parseRow(l);
    const row = {};
    headers.forEach((h, i) => { row[h] = (fields[i] || '').replace(/^["']|["']$/g, '').trim(); });
    return row;
  }).filter(r => Object.values(r).some(v => v));

  return { headers, rawHeaders, rows };
}

// ─── Column auto-detection ────────────────────────────────────────────────────
export function detectColumns(headers) {
  const hl = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim());

  const find = (...kws) => {
    const idx = hl.findIndex(h => kws.some(k => h.includes(k)));
    return idx >= 0 ? headers[idx] : null;
  };

  return {
    date:    find('date', 'txn date', 'trans date', 'value date', 'posting date', 'time'),
    desc:    find('description', 'narrative', 'details', 'particulars', 'reference', 'remarks', 'transaction', 'trans desc'),
    debit:   find('debit', 'withdrawal', 'dr ', 'paid out', 'charges', 'deduction', 'amount out', 'withdraw'),
    credit:  find('credit', 'deposit', 'cr ', 'paid in', 'amount in', 'receipt'),
    amount:  find('amount', 'amt', 'value', 'transaction amount'),
    type:    find('type', 'dr/cr', 'txn type', 'cr dr', 'direction'),
    balance: find('balance', 'running balance', 'avail'),
  };
}

// ─── Keyword → category ───────────────────────────────────────────────────────
const INCOME_MAP = [
  { cat: 'salary',     kws: ['salary', 'payroll', 'wages', 'wage', 'remuneration', 'payslip', 'pay ref'] },
  { cat: 'rental',     kws: ['rent', 'rental', 'tenancy', 'lease income', 'house income'] },
  { cat: 'dividends',  kws: ['dividend', 'div ', 'share income'] },
  { cat: 'bond-int',   kws: ['interest income', 'coupon', 'bond int', 'yield'] },
  { cat: 'business',   kws: ['sales', 'revenue', 'business', 'collection', 'merchant', 'pos cr'] },
  { cat: 'freelance',  kws: ['freelance', 'consulting', 'contract fee', 'service fee', 'honorarium'] },
];
const EXPENSE_MAP = [
  { cat: 'loan-repay', kws: ['loan', 'repayment', 'mortgage', 'installment', 'instalment', 'emi ', 'debt service', 'borrow'] },
  { cat: 'sacco-cont', kws: ['sacco', 'cooperative', 'umurenge', 'coopec', 'contribution', 'savings deduction'] },
  { cat: 'insurance',  kws: ['insurance', 'insur', 'premium', 'rssb', 'mutuelle', 'csr '] },
  { cat: 'school-fees',kws: ['school', 'tuition', 'education', 'university', 'college', 'fees', 'nursery', 'academic'] },
  { cat: 'utilities',  kws: ['electricity', 'reco', 'wasac', 'water', 'airtime', 'mtn ', 'airtel', 'internet', 'wifi', 'fuel', 'petrol', 'gas ', 'utility', 'tv sub', 'netflix', 'dstv', 'startimes'] },
];

function suggestCategory(desc, isExpense) {
  const d = (desc || '').toLowerCase();
  const map = isExpense ? EXPENSE_MAP : INCOME_MAP;
  for (const { cat, kws } of map) {
    if (kws.some(k => d.includes(k))) return cat;
  }
  return isExpense ? 'other-exp' : 'other-inc';
}

// ─── Parse a date string into YYYY-MM-DD ──────────────────────────────────────
function normaliseDate(raw) {
  if (!raw) return new Date().toISOString().slice(0, 10);
  const s = String(raw).trim();
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    const y = dmy[3].length === 2 ? '20' + dmy[3] : dmy[3];
    return `${y}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  // MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (mdy) {
    const y = mdy[3].length === 2 ? '20' + mdy[3] : mdy[3];
    return `${y}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed)) return parsed.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function parseAmount(raw) {
  if (!raw && raw !== 0) return 0;
  const n = parseFloat(String(raw).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : Math.abs(n);
}

// ─── Main: convert parsed rows → cashflow entry drafts ───────────────────────
/**
 * @param {object[]} rows       - parsed CSV rows (object keyed by header name)
 * @param {object}   colMap     - { date, desc, debit, credit, amount, type } column names
 * @param {string}   [currency] - default currency code
 * @returns {object[]}          - draft cashflow entries (no id yet, user reviews first)
 */
export function rowsToDrafts(rows, colMap, currency = 'RWF') {
  const drafts = [];
  for (const row of rows) {
    const desc   = colMap.desc   ? row[colMap.desc]   || '' : '';
    const rawDate = colMap.date  ? row[colMap.date]   || '' : '';
    const date   = normaliseDate(rawDate);

    let amount = 0;
    let isExpense = false;

    if (colMap.debit && colMap.credit) {
      // Separate debit / credit columns
      const dr = parseAmount(row[colMap.debit]);
      const cr = parseAmount(row[colMap.credit]);
      if (dr > 0) { amount = dr; isExpense = true; }
      else if (cr > 0) { amount = cr; isExpense = false; }
      else continue; // both zero → skip
    } else if (colMap.amount && colMap.type) {
      // Amount + type column
      amount = parseAmount(row[colMap.amount]);
      const t = (row[colMap.type] || '').toLowerCase();
      isExpense = t.startsWith('d') || t === 'dr' || t === 'debit' || t === 'withdrawal';
    } else if (colMap.amount) {
      // Single amount column — negative = expense
      const raw = String(row[colMap.amount] || '0').replace(/,/g, '');
      amount = Math.abs(parseFloat(raw) || 0);
      isExpense = parseFloat(raw) < 0;
    } else {
      continue;
    }

    if (!amount) continue;

    drafts.push({
      type:     isExpense ? 'expense' : 'income',
      category: suggestCategory(desc, isExpense),
      amount,
      currency,
      date,
      recurring: 'once',
      notes:    desc,
      accountId: null,
      attachment: null,
      _desc: desc, // keep original for display
    });
  }
  return drafts;
}
