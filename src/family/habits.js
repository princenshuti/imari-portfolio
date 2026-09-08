// habits.js — Family module: the weekly scorecard definition and every pure
// calculation behind it (scores, ratings, streaks, month/year roll-ups, and
// the one-off importer for the 2026 standalone dashboard export).
//
// Rules:
//   * Habit ids are STABLE. Rename the label freely; never change an id or
//     history for that habit silently moves to another line.
//   * Week keys are local Monday dates 'YYYY-MM-DD' — never toISOString()
//     (UTC would shift late-evening Kigali entries to the previous day).
//   * No DOM, no Supabase here — this file is unit-tested in node.

export const SECTIONS = [
  { id: 'family',  title: 'Shared family life', color: 'var(--brand)', habits: [
    ['fam_time',     'Intentional family time achieved most days this week'],
    ['fam_day',      'One protected family day respected'],
    ['fam_routine',  'Child routine maintained (morning or bedtime)'],
    ['fam_prayer',   'Family prayer / reflection happened consistently'],
    ['fam_home',     'Home atmosphere stayed positive and connected'],
  ]},
  { id: 'marriage', title: 'Marriage', color: '#a54d67', habits: [
    ['mar_present',  'You were fully present with your spouse'],
    ['mar_talk',     'One meaningful conversation on goals, finances, or family direction'],
    ['mar_support',  'You supported one of your spouse’s priorities this week'],
    ['mar_date',     'Date night / dedicated couple time happened if planned'],
  ]},
  { id: 'health', title: 'Health & energy', color: '#3f7b5a', habits: [
    ['hea_exercise', 'Exercise completed 3 times'],
    ['hea_sleep',    'Sleep was mostly 7–8 hours'],
    ['hea_food',     'Nutrition improved / unhealthy intake reduced'],
    ['hea_screen',   'Screen time stayed controlled'],
    ['hea_rest',     'You protected one rest period properly'],
  ]},
  { id: 'money', title: 'Financial discipline', color: '#2f5f9b', habits: [
    ['fin_budget',   'Budget respected this week'],
    ['fin_impulse',  'No unnecessary impulse purchase'],
    ['fin_debt',     'Debt repayment stayed on track'],
    ['fin_save',     'Savings or investment contribution happened'],
    ['fin_review',   'Expenses were reviewed / recorded'],
  ]},
  { id: 'growth', title: 'Personal growth', color: '#5c4489', habits: [
    ['gro_cert',     'Worked on certification or technical growth'],
    ['gro_read',     'Read or progressed in a book / course'],
    ['gro_degree',   'Made progress on degree'],
    ['gro_lang',     'Practiced French or Swahili'],
    ['gro_sunday',   'Completed Sunday personal review'],
  ]},
  { id: 'control', title: 'Time & control', color: '#c18a2e', habits: [
    ['ctl_bounds',   'Clear boundaries between job, business, and family were maintained'],
    ['ctl_famday',   'Family day was not interrupted by work'],
    ['ctl_delegate', 'At least one task was delegated'],
    ['ctl_control',  'You felt in control instead of reactive'],
  ]},
  { id: 'partner', title: 'Partner goals support', color: '#875421', habits: [
    ['par_review',   'You reviewed one of your spouse’s current goals together'],
    ['par_support',  'You provided practical support for their progress'],
    ['par_budget',   'You discussed any resource / budget needed for their goals'],
    ['par_listen',   'You listened well to their concerns or priorities'],
    ['par_plan',     'You updated the shared plan together or agreed next action'],
  ]},
];

/** Flat, ordered habit list — the legacy export stores checks by this index. */
export const HABITS = SECTIONS.flatMap(s => s.habits.map(([id, label]) => ({ id, label, section: s.id })));
export const HABIT_IDS = new Set(HABITS.map(h => h.id));
export const MAX_SCORE = HABITS.length; // 33

export const MILESTONES = [
  ['ms_checkup',    'Medical check-up completed',                 'Q1'],
  ['ms_kinder',     'Child enrolled in kindergarten',             'Q1–Q2'],
  ['ms_edu_acct',   'Child education account opened',             'Q1'],
  ['ms_emergency',  'Family emergency fund account opened',       'Q1'],
  ['ms_values',     'Family values and vision defined',           'Q1'],
  ['ms_father',     'Fatherhood vision statement written',        'Q1'],
  ['ms_debt',       'Bank debt cleared',                          'Priority'],
  ['ms_plot',       'Plot of land purchased',                     'Q2–Q3'],
  ['ms_house_plan', 'House design and financing plan completed',  'Year'],
  ['ms_vehicle',    'Partner vehicle purchased',                  'Q4'],
  ['ms_pension',    'Retirement investment vehicle opened',       'Year'],
  ['ms_cert',       'Certification completed',                    'Year'],
  ['ms_couple_trip','Couple trip completed',                      'Q3'],
  ['ms_family_trip','Major family trip completed',                'Q3'],
  ['ms_vacation',   'Personal vacation completed',                'Year'],
  ['ms_legacy',     'Legacy statement documented',                'Year'],
  ['ms_asset',      'Additional income-generating asset acquired','Year'],
].map(([id, label, tag]) => ({ id, label, tag }));

/** Shared planning textareas — stored as family_notes under plan:<key>. */
export const PLAN_FIELDS = [
  ['shared_goals',   'Shared family goals',        'One goal per line — what you are building together this year.'],
  ['partner_goals',  'Partner’s goals',        'Their personal and financial goals, in their words.'],
  ['mutual_support', 'Support each other',         'Specific support commitments.'],
  ['meeting_notes',  'Family meeting notes',       'Decisions and follow-ups from the monthly family meeting.'],
  ['month_review',   'This month',                 'Wins · current issues · next month focus.'],
].map(([key, label, hint]) => ({ key, label, hint }));

export const NOTE_KEY = {
  plan:      k => `plan:${k}`,
  week:      w => `week:${w}`,
  milestone: id => `milestone:${id}`,
};

// ── Dates (local, Monday-based) ──────────────────────────────────────────────
const pad = n => String(n).padStart(2, '0');
export const toLocalISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const isISODate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(fromISO(s).getTime());
export function fromISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }

/** Monday of the week containing `date` (Date or 'YYYY-MM-DD'). */
export function weekStart(date = new Date()) {
  const d = typeof date === 'string' ? fromISO(date) : new Date(date);
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return toLocalISO(d);
}
export function addDays(iso, n) { const d = fromISO(iso); d.setDate(d.getDate() + n); return toLocalISO(d); }

/** Monday keys of every week that starts inside a given month. */
export function weeksInMonth(year, monthIdx) {
  const out = [];
  for (let d = new Date(year, monthIdx, 1); d.getMonth() === monthIdx; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 1) out.push(toLocalISO(d));
  }
  return out;
}

// ── Scoring ──────────────────────────────────────────────────────────────────
/** logs: Map<weekKey, Set<habitId>> — the canonical in-memory shape. */
export function weekScore(logs, week) {
  const done = logs.get(week);
  return done ? [...done].filter(id => HABIT_IDS.has(id)).length : 0;
}

export function sectionScores(logs, week) {
  const done = logs.get(week) || new Set();
  return SECTIONS.map(s => ({
    id: s.id, title: s.title, color: s.color, max: s.habits.length,
    done: s.habits.filter(([id]) => done.has(id)).length,
  }));
}

export const RATING = [
  { min: 0.85, label: 'Excellent', color: '#3f7b5a' },
  { min: 0.65, label: 'Good',      color: '#7c9c2b' },
  { min: 0.42, label: 'Moderate',  color: '#c18a2e' },
  { min: 0,    label: 'Reset',     color: '#a03838' },
];
export function rating(score, max = MAX_SCORE) {
  if (!max) return RATING[3];
  const p = score / max;
  return RATING.find(r => p >= r.min) || RATING[3];
}

/** Consecutive weeks (ending at `week`, walking back) scoring ≥ threshold. */
export function streak(logs, week, threshold = 23) {
  let n = 0, w = week;
  while (weekScore(logs, w) >= threshold) { n++; w = addDays(w, -7); if (n > 520) break; }
  return n;
}

/** Average score of the weeks that have any log, or null. */
export function monthSummary(logs, year, monthIdx) {
  const weeks = weeksInMonth(year, monthIdx);
  const scored = weeks.filter(w => logs.has(w)).map(w => weekScore(logs, w));
  const avg = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;
  return { weeks, logged: scored.length, avg, excellent: scored.filter(s => s / MAX_SCORE >= 0.85).length };
}

/** Per-section average across every logged week of `year`, plus year totals. */
export function yearSummary(logs, year) {
  const weeks = [...logs.keys()].filter(w => w.startsWith(`${year}-`));
  const totals = SECTIONS.map(() => 0);
  let sum = 0;
  for (const w of weeks) {
    sum += weekScore(logs, w);
    sectionScores(logs, w).forEach((s, i) => { totals[i] += s.done; });
  }
  const sections = SECTIONS.map((s, i) => ({
    id: s.id, title: s.title, color: s.color, max: s.habits.length,
    avg: weeks.length ? totals[i] / weeks.length : null,
  }));
  const best = sections.filter(s => s.avg != null).sort((a, b) => b.avg / b.max - a.avg / a.max)[0] || null;
  return { weeks: weeks.length, avg: weeks.length ? Math.round(sum / weeks.length) : null, sections, best };
}

// ── Text hygiene ─────────────────────────────────────────────────────────────
export const MAX_NOTE = 4000;
/** Strip control chars (keep tab/newline) and clamp — notes end up in AI context later. */
export function cleanText(v, max = MAX_NOTE) {
  if (typeof v !== 'string') return '';
  return v.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').slice(0, max);
}

// ── Legacy import (prince_family_2026_final_dashboard.html localStorage) ────
// Shape: { weeks: { 'YYYY-MM-DD': { checks: bool[33], notes: string[10] } },
//          shared: { shared_goal_1..4, wife_goal_1..4, mutual_support,
//                    family_notes, monthly_wins, monthly_issues, monthly_focus },
//          milestones: { '0'..'16': bool } }
const LEGACY_NOTE_LABELS = [
  'Family', 'Marriage', 'Health', 'Finance', 'Growth', 'Time & control', 'Partner goals',
  'Top wins', 'What slipped', 'Key adjustment',
];
export const MAX_IMPORT_BYTES = 1024 * 1024;
const MAX_IMPORT_WEEKS = 200;

export function mapLegacyExport(raw, { importedAt = new Date() } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Not a dashboard export');
  const logs = [];   // { week_start, habit_id, done }
  const notes = [];  // { key, body }

  const weeks = raw.weeks && typeof raw.weeks === 'object' ? Object.entries(raw.weeks) : [];
  if (weeks.length > MAX_IMPORT_WEEKS) throw new Error(`Too many weeks (max ${MAX_IMPORT_WEEKS})`);
  for (const [key, rec] of weeks) {
    if (!isISODate(key) || !rec || typeof rec !== 'object') continue;
    const week = weekStart(key); // normalise to Monday, local
    const checks = Array.isArray(rec.checks) ? rec.checks : [];
    HABITS.forEach((h, i) => { if (checks[i] === true) logs.push({ week_start: week, habit_id: h.id, done: true }); });
    const parts = (Array.isArray(rec.notes) ? rec.notes : [])
      .map((n, i) => [LEGACY_NOTE_LABELS[i] || `Note ${i + 1}`, cleanText(n, 800).trim()])
      .filter(([, n]) => n)
      .map(([l, n]) => `${l}: ${n}`);
    if (parts.length) notes.push({ key: NOTE_KEY.week(week), body: cleanText(parts.join('\n')) });
  }

  const shared = raw.shared && typeof raw.shared === 'object' ? raw.shared : {};
  const lines = prefix => [1, 2, 3, 4].map(i => cleanText(shared[`${prefix}_${i}`], 500).trim()).filter(Boolean).join('\n');
  const plan = {
    shared_goals:   lines('shared_goal'),
    partner_goals:  lines('wife_goal'),
    mutual_support: cleanText(shared.mutual_support).trim(),
    meeting_notes:  cleanText(shared.family_notes).trim(),
    month_review:   [['Wins', shared.monthly_wins], ['Issues', shared.monthly_issues], ['Focus', shared.monthly_focus]]
      .map(([l, v]) => [l, cleanText(v, 1200).trim()]).filter(([, v]) => v).map(([l, v]) => `${l}: ${v}`).join('\n'),
  };
  for (const [k, body] of Object.entries(plan)) if (body) notes.push({ key: NOTE_KEY.plan(k), body: cleanText(body) });

  const ms = raw.milestones && typeof raw.milestones === 'object' ? raw.milestones : {};
  const stamp = toLocalISO(importedAt);
  MILESTONES.forEach((m, i) => { if (ms[i] === true || ms[String(i)] === true) notes.push({ key: NOTE_KEY.milestone(m.id), body: stamp }); });

  return { logs, notes };
}
