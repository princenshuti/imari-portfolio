// context.js — Family module Sprint 3, pure logic shared by the AI advisor,
// the insight engine and the weekly review:
//   familySummary()      compact, budgeted JSON the advisor is grounded in
//   runFamilyTool()      executes one allow-listed advisor tool call against
//                        the family data layer (validation reused from the
//                        forms — the model gets no path the forms don't have)
//   FAMILY_RULES         cost-of-absence insight rules over family data
// No DOM, no Supabase — tested in node.
import { valueRWF } from '../data.js';
import { makeInsight, rwf } from '../engine/insights/_shared.js';
import {
  SECTIONS, MILESTONES, PLAN_FIELDS, NOTE_KEY, MAX_SCORE, HABIT_IDS, HABITS,
  weekStart, weekScore, sectionScores, rating, streak, isISODate, cleanText, toLocalISO,
} from './habits.js';
import { KINDS, deriveEvents, affordability, insuranceGaps, daysUntil, normalizeItem } from './planning.js';

const short = (s, n) => (typeof s === 'string' && s.length > n ? `${s.slice(0, n - 1)}…` : s || '');

/**
 * Compact family picture for the advisor's system prompt. Every number here is
 * computed by the same helpers the screens use, so the model narrates what the
 * user sees. Kept well under ~1.5 KB for any household.
 */
export function familySummary(family, state, now = new Date()) {
  if (!family) return null;
  const logs = family.logs || new Map(), notes = family.notes || {}, items = family.items || [];
  const week = weekStart(now);
  const score = weekScore(logs, week);
  const secs = sectionScores(logs, week);
  const weakest = secs.slice().sort((a, b) => a.done / a.max - b.done / b.max)[0];
  const events = deriveEvents(state, items, { now, days: 14 }).filter(e => e.in >= -7).slice(0, 6);
  const tasks = items.filter(i => i.kind === 'task' && i.status === 'open');
  const policies = items.filter(i => i.kind === 'policy' && i.status !== 'archived');
  const docs = items.filter(i => i.kind === 'document' && i.status !== 'archived');
  const wishes = items.filter(i => i.kind === 'wish' && i.status === 'open').slice(0, 4);
  const gaps = insuranceGaps(state.assets || [], items);
  return {
    weekOf: week,
    scorecard: { score, max: MAX_SCORE, rating: rating(score).label, streakWeeks: streak(logs, week), weakestArea: weakest ? `${weakest.title} ${weakest.done}/${weakest.max}` : null },
    milestones: { done: MILESTONES.filter(m => notes[NOTE_KEY.milestone(m.id)]).length, total: MILESTONES.length,
      open: MILESTONES.filter(m => !notes[NOTE_KEY.milestone(m.id)]).slice(0, 5).map(m => m.label) },
    upcoming14d: events.map(e => `${e.date} ${e.title}${e.in < 0 ? ' (overdue)' : ''}`),
    household: { openTasks: tasks.length, overdueTasks: tasks.filter(t => t.due_date && daysUntil(t.due_date, now) < 0).length },
    insurance: { policies: policies.length, renewingIn60d: policies.filter(p => { const d = daysUntil(p.due_date, now); return d != null && d <= 60; }).map(p => p.title),
      uninsuredAssets: gaps.map(a => a.name || a.kind) },
    documentsExpiringIn90d: docs.filter(d => { const n = daysUntil(d.due_date, now); return n != null && n <= 90; }).map(d => d.title),
    wishes: wishes.map(w => { const a = affordability(w, state, now); return { title: w.title, costRWF: Number(w.amount) || 0, verdict: a.status, monthsToAfford: a.monthsToAfford }; }),
    sharedGoals: short(notes[NOTE_KEY.plan('shared_goals')], 240) || null,
    thisMonthNotes: short(notes[NOTE_KEY.plan('month_review')], 240) || null,
  };
}

/** Advisor tool names the client executes locally (definitions live server-side in ai-proxy). */
export const FAMILY_TOOL_NAMES = new Set(['family_add_item', 'family_tick_habits', 'family_update_plan']);

/**
 * Execute one advisor tool call. `api` = { saveItem(form), setHabit(week, id, done), setNote(key, body) }
 * (the same functions the screens use, so RLS and validation are identical).
 * Returns a one-line human result; throws a readable message on bad input.
 */
export async function runFamilyTool(name, input = {}, api, now = new Date()) {
  if (!api) throw new Error('Family tools unavailable');
  switch (name) {
    case 'family_add_item': {
      if (!KINDS[input.kind]) throw new Error('Unknown item kind');
      const row = normalizeItem({ ...input, status: 'open' }); // drops anything the form would not accept
      const saved = await api.saveItem({ ...row, ...row.data, data: undefined });
      return `Added ${KINDS[row.kind].label.toLowerCase()} “${saved?.title || row.title}”${row.due_date ? ` for ${row.due_date}` : ''}.`;
    }
    case 'family_tick_habits': {
      const week = isISODate(input.week) ? weekStart(input.week) : weekStart(now);
      const ids = Array.isArray(input.habit_ids) ? input.habit_ids.filter(id => HABIT_IDS.has(id)).slice(0, MAX_SCORE) : [];
      if (!ids.length) throw new Error('No valid habit ids');
      const done = input.done !== false;
      for (const id of ids) await api.setHabit(week, id, done);
      const labels = ids.map(id => HABITS.find(h => h.id === id)?.label).filter(Boolean);
      return `${done ? 'Ticked' : 'Unticked'} ${ids.length} habit${ids.length === 1 ? '' : 's'} for the week of ${week}: ${labels.join('; ')}.`;
    }
    case 'family_update_plan': {
      const field = PLAN_FIELDS.find(f => f.key === input.field);
      if (!field) throw new Error('Unknown plan field');
      const body = cleanText(input.body, 4000).trim();
      if (!body) throw new Error('Nothing to write');
      await api.setNote(NOTE_KEY.plan(field.key), body);
      return `Updated “${field.label}”.`;
    }
    default:
      throw new Error('Tool not allowed');
  }
}

// ── Insight rules (cost-of-absence) over family data ─────────────────────────
// Signature matches engine rules: (state, { now, refs, family }). Each returns
// one insight or null. sourceRefs carry asset ids or family item ids; the
// engine's stale-ref guard accepts both (see engine/insights/index.js).
export const FAMILY_SCORECARD_REF = 'family-scorecard';

function uninsuredAsset(state, { now = new Date(), family } = {}) {
  if (!family) return null;
  const gaps = insuranceGaps(state.assets || [], family.items || []);
  if (!gaps.length) return null;
  const top = gaps.slice().sort((a, b) => valueRWF(b, now) - valueRWF(a, now))[0];
  const value = valueRWF(top, now);
  return makeInsight({
    id: 'family-uninsured-asset', type: 'foresight', category: 'family',
    headline: `${top.name || top.kind} has no insurance policy linked`,
    body: `${gaps.length} insurable asset${gaps.length === 1 ? '' : 's'} (vehicles, houses) carry no policy in the family vault.`,
    costOfAbsence: { severity: value > 0 ? 'warning' : 'info', amount: value,
      costStatement: `One accident or fire and ${rwf(value)} of ${top.name || 'this asset'} is a total loss paid from family cash.`,
      action: { label: 'Add a policy', to: 'insurance' } },
    sourceRefs: [top.id], dataAsOf: now, now,
  });
}

function renewalsDue(state, { now = new Date(), family } = {}) {
  if (!family) return null;
  const due = (family.items || []).filter(i => i.status !== 'archived' && i.due_date && (i.kind === 'policy' || i.kind === 'document'))
    .map(i => ({ i, d: daysUntil(i.due_date, now) }))
    .filter(x => x.d != null && x.d <= (x.i.kind === 'policy' ? 30 : 60))
    .sort((a, b) => a.d - b.d);
  if (!due.length) return null;
  const { i, d } = due[0];
  const premium = Number(i.amount) || 0;
  const when = d < 0 ? `${-d} day${d === -1 ? '' : 's'} ago` : d === 0 ? 'today' : `in ${d} day${d === 1 ? '' : 's'}`;
  return makeInsight({
    id: 'family-renewal-due', type: 'foresight', category: 'family',
    headline: i.kind === 'policy' ? `Insurance renewal ${when}: ${i.title}` : `Document expiry ${when}: ${i.title}`,
    body: `${due.length} family renewal${due.length === 1 ? '' : 's'} or expir${due.length === 1 ? 'y' : 'ies'} inside the warning window.`,
    costOfAbsence: { severity: d <= 7 ? 'critical' : 'warning', amount: premium,
      costStatement: i.kind === 'policy'
        ? `A lapsed policy means an uncovered loss plus a fresh underwriting cycle${premium ? ` on a ${rwf(premium)} premium` : ''}.`
        : `An expired ${i.title} blocks travel, school or bank steps and costs a rush renewal.`,
      action: { label: i.kind === 'policy' ? 'Review policies' : 'Open the vault', to: i.kind === 'policy' ? 'insurance' : 'documents' } },
    sourceRefs: [i.id], dataAsOf: now, now,
  });
}

function scorecardSlipping(state, { now = new Date(), family } = {}) {
  if (!family || !family.logs) return null;
  const week = weekStart(now);
  const score = weekScore(family.logs, week);
  const dow = now.getDay(); // 0 Sun … 6 Sat
  const lastWeek = weekScore(family.logs, weekStart(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)));
  // Late in the week (Fri–Sun) with a Moderate/Reset week, or nothing logged at all by Saturday.
  const late = dow === 0 || dow >= 5;
  if (!late) return null;
  const nothingLogged = score === 0 && dow >= 6 || (score === 0 && dow === 0);
  if (!nothingLogged && score / MAX_SCORE >= 0.65) return null;
  const secs = sectionScores(family.logs, week).slice().sort((a, b) => a.done / a.max - b.done / b.max);
  const weakest = secs[0];
  return makeInsight({
    id: 'family-scorecard-slipping', type: 'foresight', category: 'family',
    headline: nothingLogged ? 'This week’s family scorecard is still empty' : `Family scorecard at ${score}/${MAX_SCORE} with the week nearly over`,
    body: nothingLogged ? 'Nothing ticked yet for this week; last week closed at ' + `${lastWeek}/${MAX_SCORE}.` : `Weakest area: ${weakest.title} (${weakest.done}/${weakest.max}).`,
    costOfAbsence: { severity: 'info', amount: 0,
      costStatement: 'Unlogged weeks break the streak and hide the pattern the Sunday review is meant to catch.',
      action: { label: 'Open the scorecard', to: 'scorecard' } },
    sourceRefs: [FAMILY_SCORECARD_REF], dataAsOf: now, now,
  });
}

export const FAMILY_RULES = [renewalsDue, uninsuredAsset, scorecardSlipping];

/** Ids the engine may reference from family data (items + the scorecard pseudo-ref). */
export function familyIdSet(family) {
  const ids = new Set([FAMILY_SCORECARD_REF]);
  for (const i of family?.items || []) ids.add(i.id);
  return ids;
}

export { toLocalISO };
