// planning.js — Family module Sprint 2, pure logic: the five item kinds
// (event, task, policy, document, wish) with their field specs and
// normalisation, the derived family calendar, wish affordability and
// insurance gap detection. No DOM, no Supabase — tested in node.
import { toBase } from '../data.js';
import { nextOccurrence, parseLocalDate } from '../engine/recurrence.js';
import { liquidValueRWF, monthlyFlowsRWF } from '../engine/insights/_shared.js';
import { toLocalISO, fromISO, isISODate, cleanText } from './habits.js';

const opt = (id, label) => ({ id, label });

// Field spec: key = typed column ('title' | 'due_date' | 'amount') or a data.* key.
export const KINDS = {
  event: { label: 'Event', plural: 'Events', glyph: '◷', nav: 'calendar', fields: [
    { key: 'title',    label: 'What',          type: 'text', max: 120, required: true },
    { key: 'due_date', label: 'Date',          type: 'date', required: true },
    { key: 'repeat',   label: 'Repeats',       type: 'select', options: [opt('none', 'Once'), opt('yearly', 'Every year (birthday, anniversary)')], def: 'none' },
    { key: 'notes',    label: 'Notes',         type: 'textarea', max: 1000 },
  ]},
  task: { label: 'Task', plural: 'Tasks', glyph: '☐', nav: 'household', fields: [
    { key: 'title',    label: 'Task',          type: 'text', max: 120, required: true },
    { key: 'due_date', label: 'Due',           type: 'date' },
    { key: 'assignee', label: 'Who',           type: 'select', options: [opt('me', 'Me'), opt('partner', 'Partner'), opt('help', 'House help'), opt('other', 'Other')], def: 'me' },
    { key: 'repeat',   label: 'Repeats',       type: 'select', options: [opt('none', 'Once'), opt('weekly', 'Weekly'), opt('monthly', 'Monthly')], def: 'none' },
    { key: 'notes',    label: 'Notes',         type: 'textarea', max: 1000 },
  ]},
  policy: { label: 'Insurance policy', plural: 'Policies', glyph: '☂', nav: 'insurance', fields: [
    { key: 'title',     label: 'Policy name',  type: 'text', max: 120, required: true, hint: 'e.g. Family health · RSSB' },
    { key: 'type',      label: 'Type',         type: 'select', options: [opt('health', 'Health'), opt('motor', 'Motor'), opt('home', 'Home / property'), opt('life', 'Life'), opt('other', 'Other')], def: 'health' },
    { key: 'insurer',   label: 'Insurer',      type: 'text', max: 80 },
    { key: 'policy_no', label: 'Policy reference', type: 'text', max: 40, hint: 'Reference only — keep the full document in the vault' },
    { key: 'amount',    label: 'Premium (RWF)', type: 'number' },
    { key: 'frequency', label: 'Premium paid',  type: 'select', options: [opt('monthly', 'Monthly'), opt('quarterly', 'Quarterly'), opt('annually', 'Annually')], def: 'annually' },
    { key: 'cover',     label: 'Cover amount (RWF)', type: 'number' },
    { key: 'due_date',  label: 'Renewal date', type: 'date', required: true },
    { key: 'asset_id',  label: 'Covers asset', type: 'asset', hint: 'Link the vehicle or house this policy protects' },
    { key: 'beneficiaries', label: 'Beneficiaries', type: 'text', max: 200 },
    { key: 'cashflow_id', type: 'asset', hidden: true }, // set when the premium is pushed to Cash Flow
  ]},
  document: { label: 'Document', plural: 'Documents', glyph: '▤', nav: 'documents', fields: [
    { key: 'title',    label: 'Document',      type: 'text', max: 120, required: true, hint: 'e.g. Passport · Prince' },
    { key: 'type',     label: 'Type',          type: 'select', options: [opt('id', 'National ID'), opt('passport', 'Passport'), opt('title', 'Land title / UPI'), opt('contract', 'Contract'), opt('school', 'School'), opt('medical', 'Medical'), opt('vehicle', 'Vehicle papers'), opt('other', 'Other')], def: 'other' },
    { key: 'holder',   label: 'Belongs to',    type: 'text', max: 60 },
    { key: 'due_date', label: 'Expiry date',   type: 'date' },
    { key: 'ref_hint', label: 'Reference (last 4 characters only)', type: 'text', max: 4, hint: 'Never store a full ID or passport number here' },
    { key: 'notes',    label: 'Notes',         type: 'textarea', max: 1000 },
  ]},
  wish: { label: 'Wish', plural: 'Wish list', glyph: '✦', nav: 'wishlist', fields: [
    { key: 'title',    label: 'Wish',          type: 'text', max: 120, required: true },
    { key: 'amount',   label: 'Estimated cost (RWF)', type: 'number', required: true },
    { key: 'due_date', label: 'Target date',   type: 'date' },
    { key: 'priority', label: 'Priority',      type: 'select', options: [opt('must', 'Must have'), opt('should', 'Should have'), opt('nice', 'Nice to have')], def: 'should' },
    { key: 'for',      label: 'For',           type: 'select', options: [opt('family', 'Family'), opt('me', 'Me'), opt('partner', 'Partner'), opt('child', 'Child'), opt('home', 'Home')], def: 'family' },
    { key: 'link',     label: 'Link',          type: 'url', max: 300 },
    { key: 'notes',    label: 'Notes',         type: 'textarea', max: 1000 },
    { key: 'goal_id',  type: 'asset', hidden: true }, // set when converted to a Goal
  ]},
};
export const KIND_IDS = Object.keys(KINDS);
const COLUMN_KEYS = new Set(['title', 'due_date', 'amount']);

/** Blank form values for a kind (typed columns + data keys flattened). */
export function blankItem(kind) {
  const out = { kind, status: 'open' };
  for (const f of KINDS[kind].fields) if (!f.hidden) out[f.key] = f.def ?? '';
  return out;
}

/** DB row → flat form values. */
export function itemToForm(row) {
  return { id: row.id, kind: row.kind, status: row.status, title: row.title, due_date: row.due_date || '', amount: row.amount ?? '', ...(row.data || {}) };
}

/**
 * Flat form → validated DB row. Throws with a user-readable message.
 * Unknown keys are dropped, strings are control-stripped and clamped,
 * selects must be one of their options, urls must be http(s).
 */
export function normalizeItem(form) {
  const spec = KINDS[form.kind];
  if (!spec) throw new Error('Unknown item kind');
  const row = { kind: form.kind, status: ['open', 'done', 'archived'].includes(form.status) ? form.status : 'open', title: '', due_date: null, amount: null, data: {} };
  if (form.id) row.id = form.id;
  for (const f of spec.fields) {
    let v = form[f.key];
    switch (f.type) {
      case 'text': case 'textarea':
        v = cleanText(v, f.max || 200).trim(); break;
      case 'number': {
        const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[,\s]/g, ''));
        v = Number.isFinite(n) && n >= 0 ? n : null; break;
      }
      case 'date':
        v = isISODate(v) ? v : null; break;
      case 'select':
        v = f.options.some(o => o.id === v) ? v : (f.def ?? null); break;
      case 'url':
        v = cleanText(v, f.max || 300).trim();
        if (v && !/^https?:\/\/[^\s]+$/i.test(v)) throw new Error('Link must start with http:// or https://');
        break;
      case 'asset':
        v = typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v) ? v : null; break;
      default: v = null;
    }
    if (f.required && (v === null || v === '')) throw new Error(`${f.label} is required`);
    if (COLUMN_KEYS.has(f.key)) row[f.key] = v === '' ? null : v;
    else if (v !== null && v !== '') row.data[f.key] = v;
  }
  // File descriptor is set by the upload flow (never typed by the user); keep only its known shape.
  const f = form.file;
  if (f && typeof f === 'object' && typeof f.path === 'string' && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,100}$/.test(f.path)) {
    row.data.file = { path: f.path, name: cleanText(f.name, 120), size: Number.isFinite(f.size) ? Math.max(0, Math.floor(f.size)) : 0, mime: cleanText(f.mime, 60) };
  }
  return row;
}

// ── Derived calendar ─────────────────────────────────────────────────────────
const dayDiff = (iso, now) => Math.round((fromISO(iso) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);

/** Move a yearly date to its next occurrence on/after today. */
export function nextYearly(iso, now) {
  const d = fromISO(iso); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setFullYear(today.getFullYear());
  if (d < today) d.setFullYear(today.getFullYear() + 1);
  return toLocalISO(d);
}

/**
 * Everything with a date the family should see, from every source, within
 * `days` (past-due open items are included with negative `in`). Each entry:
 * { date, in, title, kind, source, to, id, meta }.
 */
export function deriveEvents(state, items = [], { now = new Date(), days = 90 } = {}) {
  const out = [];
  const push = (date, title, kind, source, to, id, meta = '') => {
    if (!isISODate(date)) return;
    const diff = dayDiff(date, now);
    if (diff > days || diff < -60) return;
    out.push({ date, in: diff, title, kind, source, to, id, meta });
  };

  for (const it of items) {
    if (!it.due_date || it.status === 'archived') continue;
    const d = it.data || {};
    if (it.kind === 'event') push(d.repeat === 'yearly' ? nextYearly(it.due_date, now) : it.due_date, it.title, 'event', 'family', 'calendar', it.id, d.repeat === 'yearly' ? 'yearly' : '');
    else if (it.kind === 'task' && it.status !== 'done') push(it.due_date, it.title, 'task', 'family', 'household', it.id, d.assignee || '');
    else if (it.kind === 'policy') push(it.due_date, `Renew: ${it.title}`, 'policy', 'family', 'insurance', it.id, d.insurer || '');
    else if (it.kind === 'document') push(it.due_date, `Expires: ${it.title}`, 'document', 'family', 'documents', it.id, d.holder || '');
    else if (it.kind === 'wish' && it.status !== 'done') push(it.due_date, `Wish target: ${it.title}`, 'wish', 'family', 'wishlist', it.id, '');
  }
  for (const g of state.goals || []) if (!g.achieved && g.deadline) push(g.deadline, `Goal: ${g.title || 'Untitled'}`, 'goal', 'portfolio', 'goals', g.id);
  for (const l of state.liabilities || []) if (l.endDate) push(l.endDate, `Loan ends: ${l.name || l.lender || 'Loan'}`, 'loan', 'portfolio', 'liabilities', l.id);
  for (const cf of state.cashflows || []) {
    if (cf.type !== 'expense' || !cf.recurring || cf.recurring === 'once') continue;
    const next = nextOccurrence(cf, now);
    if (next) push(toLocalISO(next), `Bill: ${cf.notes || cf.category || 'expense'}`, 'bill', 'portfolio', 'cashflow', cf.id, cf.recurring);
  }
  // Rwanda statutory dates that follow from what the family owns.
  const assets = state.assets || [];
  if (assets.some(a => String(a.kind).startsWith('realestate'))) push(nextYearly(`${now.getFullYear()}-03-31`, now), 'RRA fixed-asset tax declaration due', 'tax', 'rwanda', 'tax', 'rra-fat', 'yearly');
  if (assets.some(a => a.kind === 'vehicle')) push(nextYearly(`${now.getFullYear()}-12-31`, now), 'Vehicle road levy due', 'tax', 'rwanda', 'tax', 'rra-levy', 'yearly');

  return out.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.title.localeCompare(b.title));
}

// ── Wish affordability ───────────────────────────────────────────────────────
/**
 * Can the household buy this now without breaking the 3-month buffer?
 * Returns { investable, gap, monthsToAfford, pace, status: 'now'|'soon'|'stretch'|'unknown' }.
 */
export function affordability(wish, state, now = new Date(), bufferMonths = 3) {
  const cost = toBase(wish.amount || 0, 'RWF');
  const { monthlyIncome, monthlyExpense } = monthlyFlowsRWF(state.cashflows || [], now);
  const liquid = liquidValueRWF(state.assets || [], now);
  const investable = Math.max(0, liquid - monthlyExpense * bufferMonths);
  const pace = monthlyIncome - monthlyExpense;
  const gap = Math.max(0, cost - investable);
  if (!(cost > 0)) return { investable, gap: 0, monthsToAfford: 0, pace, status: 'unknown' };
  if (gap === 0) return { investable, gap, monthsToAfford: 0, pace, status: 'now' };
  const monthsToAfford = pace > 0 ? Math.ceil(gap / pace) : null;
  return { investable, gap, monthsToAfford, pace, status: monthsToAfford != null && monthsToAfford <= 6 ? 'soon' : 'stretch' };
}

// ── Insurance gaps ───────────────────────────────────────────────────────────
const INSURABLE = new Set(['vehicle', 'realestate-house']);
/** Assets that normally carry a policy but have none linked. */
export function insuranceGaps(assets = [], items = []) {
  const covered = new Set(items.filter(i => i.kind === 'policy' && i.status !== 'archived').map(i => i.data?.asset_id).filter(Boolean));
  return assets.filter(a => INSURABLE.has(a.kind) && !covered.has(a.id));
}

/** Days until a date (negative when past). */
export function daysUntil(iso, now = new Date()) { return isISODate(iso) ? dayDiff(iso, now) : null; }
export { parseLocalDate };
