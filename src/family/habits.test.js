import { describe, it, expect } from 'vitest';
import {
  HABITS, HABIT_IDS, MAX_SCORE, MILESTONES, SECTIONS,
  weekStart, addDays, weeksInMonth, weekScore, sectionScores, rating, streak,
  monthSummary, yearSummary, cleanText, mapLegacyExport, NOTE_KEY,
} from './habits.js';

const logsOf = (obj) => new Map(Object.entries(obj).map(([w, ids]) => [w, new Set(ids)]));

describe('habit definitions', () => {
  it('has 33 unique, slug-safe ids across 7 sections', () => {
    expect(SECTIONS).toHaveLength(7);
    expect(MAX_SCORE).toBe(33);
    expect(HABIT_IDS.size).toBe(HABITS.length);
    for (const h of HABITS) expect(h.id).toMatch(/^[a-z0-9_-]{1,40}$/);
    for (const m of MILESTONES) expect(m.id).toMatch(/^[a-z0-9_-]{1,40}$/);
    expect(MILESTONES).toHaveLength(17);
  });
});

describe('week math (local, Monday-based)', () => {
  it('maps any day to its Monday', () => {
    expect(weekStart('2026-09-08')).toBe('2026-09-07'); // Tuesday
    expect(weekStart('2026-09-13')).toBe('2026-09-07'); // Sunday belongs to the prior Monday
    expect(weekStart('2026-09-07')).toBe('2026-09-07');
  });
  it('is not affected by UTC offsets (late-evening dates stay on their day)', () => {
    const late = new Date(2026, 8, 7, 23, 30); // Mon 7 Sep 23:30 local
    expect(weekStart(late)).toBe('2026-09-07');
  });
  it('lists Mondays inside a month and steps by days', () => {
    expect(weeksInMonth(2026, 8)).toEqual(['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']);
    expect(addDays('2026-09-07', -7)).toBe('2026-08-31');
  });
});

describe('scoring', () => {
  const logs = logsOf({
    '2026-09-07': ['fam_time', 'fam_day', 'mar_present', 'bogus_id'],
    '2026-08-31': HABITS.slice(0, 30).map(h => h.id),
    '2026-08-24': HABITS.slice(0, 23).map(h => h.id),
  });
  it('ignores unknown habit ids', () => {
    expect(weekScore(logs, '2026-09-07')).toBe(3);
    expect(weekScore(logs, '2000-01-03')).toBe(0);
  });
  it('rolls up per section', () => {
    const s = sectionScores(logs, '2026-09-07');
    expect(s[0]).toMatchObject({ id: 'family', done: 2, max: 5 });
    expect(s[1]).toMatchObject({ id: 'marriage', done: 1, max: 4 });
  });
  it('rates by ratio', () => {
    expect(rating(30).label).toBe('Excellent');
    expect(rating(23).label).toBe('Good');
    expect(rating(15).label).toBe('Moderate');
    expect(rating(0).label).toBe('Reset');
  });
  it('counts a streak of ≥23 weeks walking back from a week', () => {
    expect(streak(logs, '2026-08-31')).toBe(2);
    expect(streak(logs, '2026-09-07')).toBe(0);
  });
  it('summarises months and years from logged weeks only', () => {
    const m = monthSummary(logs, 2026, 7); // August: 24 + 31 logged, 3,10,17 not
    expect(m).toMatchObject({ logged: 2, avg: 27, excellent: 1 });
    expect(monthSummary(logs, 2026, 0).avg).toBeNull();
    const y = yearSummary(logs, 2026);
    expect(y.weeks).toBe(3);
    expect(y.best.id).toBe('family');
    expect(yearSummary(logs, 2025).avg).toBeNull();
  });
});

describe('cleanText', () => {
  it('strips control chars and clamps', () => {
    expect(cleanText('a\x00b\x07c\tD\n')).toBe('abc\tD\n');
    expect(cleanText('x'.repeat(5000)).length).toBe(4000);
    expect(cleanText(42)).toBe('');
  });
});

describe('legacy dashboard import', () => {
  const raw = {
    weeks: {
      '2026-03-30': { checks: [true, false, true, ...Array(30).fill(false)], notes: ['calm week', '', '', '', '', '', '', 'won a tender', '', 'sleep earlier'], total: 2 },
      '2026-04-01': { checks: [true], notes: [] },               // Wednesday → normalised to Monday 30 Mar
      'not-a-date': { checks: [true] },
      '2026-04-06': 'garbage',
    },
    shared: { shared_goal_1: 'Buy plot', shared_goal_3: 'Emergency fund', wife_goal_2: 'Finish course', monthly_wins: 'Debt down', monthly_focus: 'Kindergarten' },
    milestones: { 0: true, '6': true, 3: false, 99: true },
  };
  it('maps checks by position to stable ids and drops junk', () => {
    const { logs, notes } = mapLegacyExport(raw, { importedAt: new Date(2026, 8, 8) });
    expect(logs).toEqual(expect.arrayContaining([
      { week_start: '2026-03-30', habit_id: 'fam_time', done: true },
      { week_start: '2026-03-30', habit_id: 'fam_routine', done: true },
    ]));
    expect(logs.every(l => HABIT_IDS.has(l.habit_id) && /^\d{4}-\d{2}-\d{2}$/.test(l.week_start))).toBe(true);
    expect(logs.filter(l => l.week_start === '2026-03-30')).toHaveLength(3); // two records merged into one Monday
    const byKey = Object.fromEntries(notes.map(n => [n.key, n.body]));
    expect(byKey[NOTE_KEY.week('2026-03-30')]).toBe('Family: calm week\nTop wins: won a tender\nKey adjustment: sleep earlier');
    expect(byKey[NOTE_KEY.plan('shared_goals')]).toBe('Buy plot\nEmergency fund');
    expect(byKey[NOTE_KEY.plan('partner_goals')]).toBe('Finish course');
    expect(byKey[NOTE_KEY.plan('month_review')]).toBe('Wins: Debt down\nFocus: Kindergarten');
    expect(byKey[NOTE_KEY.milestone('ms_checkup')]).toBe('2026-09-08');
    expect(byKey[NOTE_KEY.milestone('ms_debt')]).toBe('2026-09-08');
    expect(byKey[NOTE_KEY.milestone('ms_emergency')]).toBeUndefined();
    expect(notes.every(n => /^[a-z0-9_:-]{1,60}$/.test(n.key) && n.body.length <= 4000)).toBe(true);
  });
  it('rejects non-objects and oversized week maps', () => {
    expect(() => mapLegacyExport(null)).toThrow();
    expect(() => mapLegacyExport([])).toThrow();
    const big = { weeks: Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`k${i}`, {}])) };
    expect(() => mapLegacyExport(big)).toThrow(/Too many/);
  });
});
