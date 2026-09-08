import { describe, it, expect, vi } from 'vitest';
import { familySummary, runFamilyTool, FAMILY_RULES, familyIdSet, FAMILY_SCORECARD_REF, FAMILY_TOOL_NAMES } from './context.js';
import { HABITS, NOTE_KEY } from './habits.js';

const now = new Date(2026, 8, 12); // Sat 12 Sep 2026 (week of Mon 7 Sep)
const state = {
  assets: [
    { id: 'v1', kind: 'vehicle', name: 'RAV4', currency: 'RWF', currentValue: 18_000_000, purchasePrice: 18_000_000 },
    { id: 's1', kind: 'savings', currency: 'RWF', currentValue: 5_000_000, purchasePrice: 5_000_000 },
  ],
  goals: [{ id: 'g1', title: 'Plot', deadline: '2026-09-20' }],
  liabilities: [], cashflows: [
    { type: 'income', amount: 1_500_000, currency: 'RWF', date: '2026-01-01', recurring: 'monthly' },
    { type: 'expense', amount: 1_000_000, currency: 'RWF', date: '2026-01-01', recurring: 'monthly' },
  ],
};
const family = {
  logs: new Map([['2026-09-07', new Set(['fam_time', 'fam_day', 'fin_budget'])]]),
  notes: { [NOTE_KEY.milestone('ms_checkup')]: '2026-09-01', [NOTE_KEY.plan('shared_goals')]: 'Buy plot\nEmergency fund' },
  items: [
    { id: 'p1', kind: 'policy', title: 'Health · RSSB', due_date: '2026-09-30', amount: 120000, status: 'open', data: { asset_id: null } },
    { id: 'd1', kind: 'document', title: 'Passport · Prince', due_date: '2026-10-15', status: 'open', data: {} },
    { id: 't1', kind: 'task', title: 'Fix gate', due_date: '2026-09-01', status: 'open', data: {} },
    { id: 'w1', kind: 'wish', title: 'Sofa', amount: 850000, status: 'open', data: {} },
  ],
};

describe('familySummary', () => {
  it('is compact and computed from the same helpers as the screens', () => {
    const s = familySummary(family, state, now);
    expect(s.weekOf).toBe('2026-09-07');
    expect(s.scorecard).toMatchObject({ score: 3, max: 33, rating: 'Reset' });
    expect(s.milestones).toMatchObject({ done: 1, total: 17 });
    expect(s.household).toEqual({ openTasks: 1, overdueTasks: 1 });
    expect(s.insurance.uninsuredAssets).toEqual(['RAV4']);
    expect(s.insurance.renewingIn60d).toEqual(['Health · RSSB']);
    expect(s.documentsExpiringIn90d).toEqual(['Passport · Prince']);
    expect(s.wishes[0]).toMatchObject({ title: 'Sofa', verdict: 'now' });
    expect(s.upcoming14d.some(x => x.includes('Goal: Plot'))).toBe(true);
    expect(s.sharedGoals).toBe('Buy plot\nEmergency fund');
    expect(JSON.stringify(s).length).toBeLessThan(1500);
    expect(familySummary(null, state, now)).toBeNull();
  });
});

describe('runFamilyTool', () => {
  const api = () => ({ saveItem: vi.fn(async f => ({ title: f.title })), setHabit: vi.fn(async () => {}), setNote: vi.fn(async () => {}) });
  it('adds an item through the same validation as the form', async () => {
    const a = api();
    const msg = await runFamilyTool('family_add_item', { kind: 'task', title: 'Buy cash power', due_date: '2026-09-14', assignee: 'partner', evil: 'x' }, a, now);
    expect(msg).toMatch(/Added task “Buy cash power” for 2026-09-14/);
    const form = a.saveItem.mock.calls[0][0];
    expect(form).toMatchObject({ kind: 'task', title: 'Buy cash power', due_date: '2026-09-14', assignee: 'partner' });
    expect(form.evil).toBeUndefined();
    await expect(runFamilyTool('family_add_item', { kind: 'wish', title: 'x', amount: 5000, link: 'javascript:1' }, a, now)).rejects.toThrow(/http/);
    await expect(runFamilyTool('family_add_item', { kind: 'nope', title: 'x' }, a, now)).rejects.toThrow();
  });
  it('ticks only known habits, defaulting to the current week', async () => {
    const a = api();
    const msg = await runFamilyTool('family_tick_habits', { habit_ids: ['fam_time', 'bogus', 'hea_sleep'] }, a, now);
    expect(a.setHabit).toHaveBeenCalledTimes(2);
    expect(a.setHabit).toHaveBeenCalledWith('2026-09-07', 'fam_time', true);
    expect(msg).toMatch(/Ticked 2 habits for the week of 2026-09-07/);
    await expect(runFamilyTool('family_tick_habits', { habit_ids: ['bogus'] }, a, now)).rejects.toThrow(/No valid/);
  });
  it('updates only known plan fields and refuses unknown tools', async () => {
    const a = api();
    await runFamilyTool('family_update_plan', { field: 'meeting_notes', body: 'Agreed: \x07plot visit Sat' }, a, now);
    expect(a.setNote).toHaveBeenCalledWith('plan:meeting_notes', 'Agreed: plot visit Sat');
    await expect(runFamilyTool('family_update_plan', { field: 'hacker', body: 'x' }, a, now)).rejects.toThrow(/Unknown plan/);
    await expect(runFamilyTool('delete_everything', {}, a, now)).rejects.toThrow(/not allowed/);
    expect([...FAMILY_TOOL_NAMES]).toHaveLength(3);
  });
});

describe('family insight rules', () => {
  const run = (f = family, n = now) => FAMILY_RULES.map(r => r(state, { now: n, family: f })).filter(Boolean);
  it('flags the soonest renewal, the uninsured vehicle and a slipping scorecard on Saturday', () => {
    const out = run();
    const ids = out.map(i => i.id);
    expect(ids).toEqual(['family-renewal-due', 'family-uninsured-asset', 'family-scorecard-slipping']);
    expect(out[0].headline).toMatch(/Insurance renewal in 18 days: Health · RSSB/);
    expect(out[0].sourceRefs).toEqual(['p1']);
    expect(out[1].costOfAbsence.amount).toBe(18_000_000);
    expect(out[1].sourceRefs).toEqual(['v1']);
    expect(out[2].sourceRefs).toEqual([FAMILY_SCORECARD_REF]);
    expect(out[2].headline).toMatch(/3\/33/);
  });
  it('stays quiet mid-week, when the week is Good, and with no family data', () => {
    expect(run(family, new Date(2026, 8, 9)).map(i => i.id)).not.toContain('family-scorecard-slipping'); // Wednesday
    const good = { ...family, logs: new Map([['2026-09-07', new Set(HABITS.slice(0, 25).map(h => h.id))]]) };
    expect(run(good).map(i => i.id)).not.toContain('family-scorecard-slipping');
    expect(FAMILY_RULES.map(r => r(state, { now, family: null })).filter(Boolean)).toEqual([]);
  });
  it('critical when a policy renews within a week; documents use a 60-day window', () => {
    const soon = { ...family, items: [{ id: 'p2', kind: 'policy', title: 'Motor', due_date: '2026-09-15', status: 'open', data: {} }, { id: 'd2', kind: 'document', title: 'ID', due_date: '2026-12-31', status: 'open', data: {} }] };
    const out = run(soon).find(i => i.id === 'family-renewal-due');
    expect(out.costOfAbsence.severity).toBe('critical');
    expect(out.sourceRefs).toEqual(['p2']);
  });
  it('exposes the ids the engine may reference', () => {
    expect([...familyIdSet(family)]).toEqual([FAMILY_SCORECARD_REF, 'p1', 'd1', 't1', 'w1']);
  });
});
