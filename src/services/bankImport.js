/**
 * bankImport.js — parse bank/MoMo statement CSV, TSV or Excel files and
 * suggest cashflow categories. Optional AI second pass for low-confidence rows.
 *
 * Handles common Rwandan formats (BK, Equity, I&M, MTN MoMo, Airtel Money).
 * Auto-detects columns; caller can override with a column map.
 */

import { completeText } from '../ai.js';

// ─── File-type dispatcher ────────────────────────────────────────────────────
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — covers a year of MoMo

export function parseFile(file) {
  if (!file) return Promise.reject(new Error('No file provided'));
  if (file.size > MAX_BYTES) {
    return Promise.reject(new Error(`File too large (max ${MAX_BYTES / 1024 / 1024} MB). Export a shorter date range.`));
  }
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return parseExcel(file);
  return readText(file).then(parseCSV);
}

function readText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error('Could not read file'));
    r.readAsText(file);
  });
}

// ─── CSV / TSV parser ────────────────────────────────────────────────────────
export function parseCSV(text) {
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

  // First row whose cells look like a recognisable header
  let headerIdx = 0;
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const lower = lines[i].toLowerCase();
    if (/date|amount|debit|credit|description|narrat|money in|money out|received|sent/.test(lower)) {
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

// ─── Excel parser (lazy-loaded — exceljs only fetched when used) ─────────────
export function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const ExcelJS = (await import('exceljs')).default;
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(ev.target.result);

        // Prefer a sheet that looks like a statement (has "statement" / "transaction"
        // in the name), otherwise take the first non-empty sheet.
        const ws =
          wb.worksheets.find(s => /statement|transaction|trans/i.test(s.name)) ||
          wb.worksheets.find(s => s.rowCount > 1) ||
          wb.worksheets[0];
        if (!ws) throw new Error('No usable sheet found in this workbook.');

        // Find the header row: scan first 12 rows for one with recognisable column names.
        let headerRowNum = 1;
        for (let r = 1; r <= Math.min(12, ws.rowCount); r++) {
          const cells = [];
          ws.getRow(r).eachCell({ includeEmpty: true }, c => cells.push(String(cellText(c.value) || '').toLowerCase()));
          const joined = cells.join(' | ');
          if (/date|amount|debit|credit|description|narrat|money in|money out|received|sent/.test(joined)) {
            headerRowNum = r;
            break;
          }
        }

        const headers = [];
        ws.getRow(headerRowNum).eachCell({ includeEmpty: true }, (c, idx) => {
          headers[idx - 1] = String(cellText(c.value) || '').trim();
        });
        // Trim empty trailing columns
        while (headers.length && !headers[headers.length - 1]) headers.pop();
        if (!headers.length) throw new Error('Could not find a header row in this Excel file.');

        const rows = [];
        const lastRow = ws.rowCount;
        for (let r = headerRowNum + 1; r <= lastRow; r++) {
          const row = {};
          let hasAny = false;
          headers.forEach((h, i) => {
            const v = cellText(ws.getRow(r).getCell(i + 1).value);
            row[h] = v;
            if (v !== '' && v != null) hasAny = true;
          });
          if (hasAny) rows.push(row);
        }

        resolve({ headers, rawHeaders: headers, rows });
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read Excel file'));
    reader.readAsArrayBuffer(file);
  });
}

// Unwrap ExcelJS rich-text / formula / date cell values into plain strings or dates.
function cellText(v) {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map(r => r.text || '').join('');
    if (v.result != null) return String(v.result);
    if (v.text != null)   return String(v.text);
    if (v.hyperlink && v.text) return String(v.text);
  }
  return String(v);
}

// ─── Column auto-detection ────────────────────────────────────────────────────
export function detectColumns(headers) {
  const hl = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim());

  const find = (...kws) => {
    const idx = hl.findIndex(h => kws.some(k => h.includes(k)));
    return idx >= 0 ? headers[idx] : null;
  };

  return {
    date:    find('date', 'txn date', 'trans date', 'value date', 'posting date', 'time', 'completion time'),
    desc:    find('description', 'narrative', 'narration', 'details', 'particulars', 'reference', 'remarks', 'transaction', 'trans desc', 'detail'),
    // MoMo "Money Out" / "Withdrawn" / "Paid Out" → debit
    debit:   find('debit', 'withdrawal', 'withdrawn', 'dr ', 'paid out', 'money out', 'amount out', 'sent', 'spent'),
    // MoMo "Money In" / "Received" / "Deposit" → credit
    credit:  find('credit', 'deposit', 'cr ', 'paid in', 'money in', 'amount in', 'receipt', 'received'),
    amount:  find('amount', 'amt', 'value', 'transaction amount'),
    type:    find('type', 'dr/cr', 'txn type', 'cr dr', 'direction', 'transaction type'),
    balance: find('balance', 'running balance', 'avail'),
    // MoMo service charge — surfaced as its own utilities expense draft
    fee:     find('charge', 'fee', 'commission', 'tariff'),
  };
}

// ─── Keyword → category (first match wins; specific before generic) ──────────
const INCOME_MAP = [
  { cat: 'salary',     kws: ['salary', 'payroll', 'wages', 'wage', 'remuneration', 'payslip', 'pay ref'] },
  { cat: 'rental',     kws: ['rent received', 'rental income', 'tenancy', 'lease income', 'house income'] },
  { cat: 'dividends',  kws: ['dividend', 'div ', 'share income'] },
  { cat: 'bond-int',   kws: ['interest income', 'coupon', 'bond int', 'yield', 'treasury bill'] },
  { cat: 'business',   kws: ['sales', 'revenue', 'business', 'collection', 'merchant', 'pos cr', 'invoice'] },
  { cat: 'freelance',  kws: ['freelance', 'consulting', 'contract fee', 'service fee', 'honorarium'] },
];
const EXPENSE_MAP = [
  { cat: 'food',         kws: ['supermarket', 'grocery', 'simba', 'nakumatt', 'carrefour', 'sawa', 'restaurant', 'cafe', 'café', 'food', 'meat', 'fruit', 'bakery', 'butcher'] },
  { cat: 'transport',    kws: ['petrol', 'fuel', 'gas station', 'shell', 'engen', 'total ', 'parking', 'taxi', 'uber', 'yego', 'bolt', 'moto', 'volcano', 'ritco'] },
  { cat: 'rent',         kws: ['rent ', 'rental payment', 'mortgage', 'housing', 'landlord'] },
  { cat: 'healthcare',   kws: ['pharmacy', 'clinic', 'hospital', 'medical', 'doctor', 'medicine', 'kims', 'kfh', 'rama'] },
  { cat: 'entertainment',kws: ['cinema', 'movie', 'spotify', 'apple music', 'gaming', 'bar ', 'nightclub', 'netflix subscription'] },
  { cat: 'loan-repay',   kws: ['loan', 'repayment', 'installment', 'instalment', 'emi ', 'debt service', 'borrow'] },
  { cat: 'sacco-cont',   kws: ['sacco', 'cooperative', 'umurenge', 'coopec', 'contribution', 'savings deduction'] },
  { cat: 'insurance',    kws: ['insurance', 'insur', 'premium', 'rssb', 'mutuelle', 'csr ', 'sanlam', 'sonarwa', 'radiant'] },
  { cat: 'school-fees',  kws: ['school', 'tuition', 'education', 'university', 'college', 'nursery', 'academic'] },
  { cat: 'utilities',    kws: ['electricity', 'reco', 'wasac', 'water bill', 'airtime', 'mtn ', 'airtel', 'internet', 'wifi', 'utility', 'tv sub', 'netflix', 'dstv', 'startimes', 'canal+', 'canalplus'] },
];

function suggestCategory(desc, isExpense) {
  const d = (desc || '').toLowerCase();
  const map = isExpense ? EXPENSE_MAP : INCOME_MAP;
  for (const { cat, kws } of map) {
    if (kws.some(k => d.includes(k))) return cat;
  }
  return isExpense ? 'other-exp' : 'other-inc';
}

// ─── Parse a date string (or Date) into YYYY-MM-DD ───────────────────────────
function normaliseDate(raw) {
  if (!raw) return new Date().toISOString().slice(0, 10);
  if (raw instanceof Date && !isNaN(raw)) return raw.toISOString().slice(0, 10);
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (dmy) {
    const y = dmy[3].length === 2 ? '20' + dmy[3] : dmy[3];
    return `${y}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
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
 * @param {object[]} rows       - parsed rows (object keyed by header name)
 * @param {object}   colMap     - { date, desc, debit, credit, amount, type, fee }
 * @param {string}   [currency] - default currency code
 * @returns {object[]}          - draft cashflow entries (caller reviews before save)
 *
 * Each draft has `_confidence`: 'high' when the keyword matcher found a hit,
 * 'low' when it fell back to other-exp/other-inc. The UI flags low-confidence
 * rows for manual review and optionally runs them through an AI second pass.
 */
export function rowsToDrafts(rows, colMap, currency = 'RWF') {
  const drafts = [];
  let key = 0;

  for (const row of rows) {
    const desc    = colMap.desc ? row[colMap.desc] || '' : '';
    const rawDate = colMap.date ? row[colMap.date] || '' : '';
    const date    = normaliseDate(rawDate);

    let amount = 0;
    let isExpense = false;

    if (colMap.debit && colMap.credit) {
      const dr = parseAmount(row[colMap.debit]);
      const cr = parseAmount(row[colMap.credit]);
      if (dr > 0) { amount = dr; isExpense = true; }
      else if (cr > 0) { amount = cr; isExpense = false; }
      else continue;
    } else if (colMap.amount && colMap.type) {
      amount = parseAmount(row[colMap.amount]);
      const t = (row[colMap.type] || '').toLowerCase();
      isExpense = t.startsWith('d') || t === 'dr' || t === 'debit' || t === 'withdrawal' || t.includes('out') || t.includes('sent') || t.includes('paid');
    } else if (colMap.amount) {
      const raw = String(row[colMap.amount] || '0').replace(/,/g, '');
      amount = Math.abs(parseFloat(raw) || 0);
      isExpense = parseFloat(raw) < 0;
    } else {
      continue;
    }

    if (!amount) continue;

    const category = suggestCategory(desc, isExpense);
    drafts.push({
      _key:        ++key,
      type:        isExpense ? 'expense' : 'income',
      category,
      _confidence: isCatalogued(category) ? 'high' : 'low',
      amount,
      currency,
      date,
      recurring:   'once',
      notes:       desc,
      accountId:   null,
      attachment:  null,
      _desc:       desc,
    });

    // MoMo service charge → its own utilities expense (so it doesn't get
    // silently lumped into the transaction itself).
    if (colMap.fee) {
      const fee = parseAmount(row[colMap.fee]);
      if (fee > 0) {
        drafts.push({
          _key:        ++key,
          type:        'expense',
          category:    'utilities',
          _confidence: 'high',
          amount:      fee,
          currency,
          date,
          recurring:   'once',
          notes:       `MoMo charge · ${desc}`.trim(),
          accountId:   null,
          attachment:  null,
          _desc:       `Service charge — ${desc}`,
          _isFee:      true,
        });
      }
    }
  }
  return drafts;
}

function isCatalogued(cat) {
  return cat !== 'other-exp' && cat !== 'other-inc';
}

// ─── AI second pass for low-confidence drafts ────────────────────────────────
//
// Cost & speed model:
//   • Only descriptions where the keyword matcher returned 'other-*' are sent.
//   • All such descriptions are batched into ONE Haiku call (not one per row).
//   • Each unique description hash is cached in sessionStorage so re-imports
//     don't re-pay. Cache survives the import flow but not the browser session.
//   • Returns the same drafts array, with category + _confidence updated and
//     _aiCategorized: true on rows the AI touched.
//
// The caller is free to skip this step entirely — the UI does so when the
// user opts out, or when the AI key isn't configured.

const CACHE_KEY = 'imari:bankImport:catCache:v1';

function loadCache() {
  try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}'); }
  catch { return {}; }
}
function saveCache(c) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch {}
}

// Stable, low-collision hash for cache keys (we don't need crypto strength).
function hash(s) {
  let h = 5381;
  const str = String(s).toLowerCase().trim();
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

const INCOME_CAT_IDS  = ['salary', 'rental', 'dividends', 'bond-int', 'business', 'freelance', 'other-inc'];
const EXPENSE_CAT_IDS = ['food', 'rent', 'transport', 'utilities', 'school-fees', 'healthcare', 'insurance', 'loan-repay', 'sacco-cont', 'entertainment', 'other-exp'];

/**
 * Run AI categorization on low-confidence drafts. Mutates a *copy* and returns it.
 *
 * @param {object[]} drafts   - output of rowsToDrafts()
 * @param {object}   [opts]
 * @param {function} [opts.onProgress] - called with (done, total) while running
 * @returns {Promise<object[]>} drafts with updated categories + _confidence
 */
export async function aiCategorize(drafts, opts = {}) {
  const onProgress = opts.onProgress || (() => {});
  const out = drafts.map(d => ({ ...d }));
  const cache = loadCache();

  // 1. Apply cache hits first.
  const remaining = [];
  out.forEach((d, i) => {
    if (d._confidence !== 'low') return;
    const cached = cache[hash(d._desc)];
    if (cached && cached.category) {
      d.category       = isAllowed(cached.category, d.type) ? cached.category : d.category;
      d._confidence    = cached.confidence >= 0.7 ? 'high' : 'low';
      d._aiCategorized = true;
    } else {
      remaining.push(i);
    }
  });

  onProgress(out.length - remaining.length, out.length);
  if (!remaining.length) return out;

  // 2. Batch every remaining description into ONE prompt.
  //    Dedupe by description so identical narrations don't repeat in the call.
  const descMap = new Map(); // desc → indices in `out`
  for (const i of remaining) {
    const d = out[i]._desc || '';
    if (!descMap.has(d)) descMap.set(d, []);
    descMap.get(d).push(i);
  }
  const uniqueDescs = Array.from(descMap.keys());

  const prompt = buildPrompt(uniqueDescs, out);
  let parsed;
  try {
    const resp = await completeText('', prompt);
    parsed = parseJsonish(resp);
  } catch (err) {
    // AI failed — leave drafts as 'low' so the UI flags them for manual review.
    onProgress(out.length, out.length);
    return out;
  }

  if (!Array.isArray(parsed)) {
    onProgress(out.length, out.length);
    return out;
  }

  // 3. Apply results, update cache.
  for (const r of parsed) {
    const descIdx = Number(r.idx);
    if (!Number.isInteger(descIdx) || descIdx < 0 || descIdx >= uniqueDescs.length) continue;
    const desc = uniqueDescs[descIdx];
    const indices = descMap.get(desc) || [];
    for (const i of indices) {
      const d = out[i];
      if (isAllowed(r.category, d.type)) {
        d.category       = r.category;
        d._confidence    = (Number(r.confidence) || 0) >= 0.7 ? 'high' : 'low';
        d._aiCategorized = true;
      }
    }
    cache[hash(desc)] = { category: r.category, confidence: Number(r.confidence) || 0 };
  }
  saveCache(cache);

  onProgress(out.length, out.length);
  return out;
}

function isAllowed(cat, type) {
  return type === 'income' ? INCOME_CAT_IDS.includes(cat) : EXPENSE_CAT_IDS.includes(cat);
}

function buildPrompt(descs, drafts) {
  // Pair each unique description with its type (income/expense) so the model
  // knows which category set to pick from.
  const typeByDesc = {};
  for (const d of drafts) {
    if (d._desc && !typeByDesc[d._desc]) typeByDesc[d._desc] = d.type;
  }
  const items = descs.map((desc, i) => `${i}\t${typeByDesc[desc] || 'expense'}\t${desc.slice(0, 200)}`).join('\n');

  return [
    'You categorise Rwandan bank / Mobile Money transactions for a personal-finance app.',
    'For each transaction, return one category id from the allowed list for its type.',
    '',
    'Income categories: ' + INCOME_CAT_IDS.join(', '),
    'Expense categories: ' + EXPENSE_CAT_IDS.join(', '),
    '',
    'Rules:',
    '- Pick the most specific category. Use other-inc / other-exp only when nothing else fits.',
    '- "confidence" is a number 0..1 — how sure you are. Below 0.7 will be flagged for the user to review.',
    '- Output STRICT JSON array only — no prose, no markdown fences. Schema: [{"idx": number, "category": string, "confidence": number}]',
    '',
    'Transactions (idx<TAB>type<TAB>description):',
    items,
  ].join('\n');
}

function parseJsonish(text) {
  if (!text) return null;
  let t = String(text).trim();
  // Strip ```json fences if the model wrapped its output
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  // Find the first '[' and last ']' as a defensive crop
  const a = t.indexOf('['), z = t.lastIndexOf(']');
  if (a >= 0 && z > a) t = t.slice(a, z + 1);
  try { return JSON.parse(t); } catch { return null; }
}
