import { describe, it, expect } from 'vitest';
import { KINDS, KIND_IDS, blankItem, itemToForm, normalizeItem, deriveEvents, nextYearly, affordability, insuranceGaps, daysUntil } from './planning.js';

const now = new Date(2026, 8, 8); // Tue 8 Sep 2026

describe('kind specs', () => {
  it('has five kinds, each with a required title and a nav target', () => {
    expect(KIND_IDS).toEqual(['event', 'task', 'policy', 'document', 'wish']);
    for (const k of KIND_IDS) {
      expect(KINDS[k].fields.find(f => f.key === 'title')?.required).toBe(true);
      expect(typeof KINDS[k].nav).toBe('string');
    }
  });
  it('blank → form → row round-trips defaults', () => {
    const b = blankItem('task');
    expect(b).toMatchObject({ kind: 'task', status: 'open', assignee: 'me', repeat: 'none', title: '' });
    const row = normalizeItem({ ...b, title: 'Pay house help', due_date: '2026-09-30' });
    expect(row).toEqual({ kind: 'task', status: 'open', title: 'Pay house help', due_date: '2026-09-30', amount: null, data: { assignee: 'me', repeat: 'none' } });
    expect(itemToForm({ ...row, id: 'x' })).toMatchObject({ id: 'x', title: 'Pay house help', assignee: 'me', amount: '' });
  });
});

describe('normalizeItem hardening', () => {
  it('requires the required fields and rejects bad urls', () => {
    expect(() => normalizeItem({ kind: 'event', title: '  ', due_date: '2026-01-01' })).toThrow(/What is required/);
    expect(() => normalizeItem({ kind: 'wish', title: 'Bike', amount: 'abc' })).toThrow(/cost/i);
    expect(() => normalizeItem({ kind: 'wish', title: 'Bike', amount: 5000, link: 'javascript:alert(1)' })).toThrow(/http/);
    expect(() => normalizeItem({ kind: 'nope', title: 'x' })).toThrow();
  });
  it('drops unknown keys, clamps text, coerces numbers, validates selects/dates/assets', () => {
    const row = normalizeItem({
      kind: 'policy', title: 'Motor\x00 policy', type: 'spaceship', insurer: 'x'.repeat(500), policy_no: 'ABC-1',
      amount: '120,000', frequency: 'annually', cover: -5, due_date: '2026-12-31', asset_id: 'bad id!', beneficiaries: 'Wife',
      evil: 'payload', __proto__: { hacked: true },
    });
    expect(row.title).toBe('Motor policy');
    expect(row.data.type).toBe('health');            // invalid select → default
    expect(row.data.insurer.length).toBe(80);
    expect(row.amount).toBe(120000);
    expect(row.data.cover).toBeUndefined();          // negative → dropped
    expect(row.due_date).toBe('2026-12-31');
    expect(row.data.asset_id).toBeUndefined();
    expect(row.data.evil).toBeUndefined();
    expect(row.data.hacked).toBeUndefined();
  });
  it('policy needs a renewal date', () => {
    expect(() => normalizeItem({ kind: 'policy', title: 'Health', due_date: '' })).toThrow(/Renewal date/);
    expect(() => normalizeItem({ kind: 'policy', title: 'Health', due_date: '31/12/2026' })).toThrow(/Renewal date/);
  });
  it('document reference keeps at most 4 characters', () => {
    const row = normalizeItem({ kind: 'document', title: 'Passport', ref_hint: 'PC123456' });
    expect(row.data.ref_hint).toBe('PC12');
  });
});

describe('deriveEvents', () => {
  const state = {
    assets: [{ id: 'a1', kind: 'vehicle', name: 'RAV4' }, { id: 'a2', kind: 'savings' }],
    goals: [{ id: 'g1', title: 'Plot', deadline: '2026-10-15' }, { id: 'g2', title: 'Done', deadline: '2026-09-20', achieved: true }],
    liabilities: [{ id: 'l1', name: 'Zigama', endDate: '2026-11-30' }],
    cashflows: [
      { id: 'c1', type: 'expense', category: 'utilities', amount: 50000, date: '2026-01-05', recurring: 'monthly', notes: 'Cash power' },
      { id: 'c2', type: 'income', category: 'salary', amount: 1, date: '2026-01-01', recurring: 'monthly' },
      { id: 'c3', type: 'expense', category: 'food', amount: 1, date: '2026-09-01', recurring: 'once' },
    ],
  };
  const items = [
    { id: 'i1', kind: 'event', title: 'Anniversary', due_date: '2020-09-20', status: 'open', data: { repeat: 'yearly' } },
    { id: 'i2', kind: 'task', title: 'Fix gate', due_date: '2026-09-01', status: 'open', data: { assignee: 'help' } },
    { id: 'i3', kind: 'task', title: 'Done task', due_date: '2026-09-10', status: 'done', data: {} },
    { id: 'i4', kind: 'policy', title: 'Motor', due_date: '2026-10-01', status: 'open', data: { insurer: 'Radiant' } },
    { id: 'i5', kind: 'document', title: 'Passport', due_date: '2027-06-01', status: 'open', data: {} },
    { id: 'i6', kind: 'wish', title: 'Sofa', due_date: '2026-12-01', status: 'open', data: {} },
    { id: 'i7', kind: 'event', title: 'Archived', due_date: '2026-09-15', status: 'archived', data: {} },
  ];
  it('merges family items, portfolio dates, bills and Rwanda statutory dates, sorted', () => {
    const ev = deriveEvents(state, items, { now, days: 120 });
    const titles = ev.map(e => `${e.date} ${e.title}`);
    expect(titles).toEqual([
      '2026-09-01 Fix gate',
      '2026-10-05 Bill: Cash power',
      '2026-09-20 Anniversary',
      '2026-10-01 Renew: Motor',
      '2026-10-15 Goal: Plot',
      '2026-11-30 Loan ends: Zigama',
      '2026-12-01 Wish target: Sofa',
      '2026-12-31 Vehicle road levy due',
    ].sort());
    expect(ev.find(e => e.title === 'Fix gate').in).toBe(-7);
    expect(ev.find(e => e.title === 'Anniversary')).toMatchObject({ meta: 'yearly', to: 'calendar' });
    expect(titles.some(t => t.includes('Done task') || t.includes('Archived') || t.includes('Passport') || t.includes('Goal: Done'))).toBe(false);
  });
  it('adds the fixed-asset tax date only for property owners', () => {
    const withHouse = { ...state, assets: [{ id: 'h', kind: 'realestate-house' }] };
    const ev = deriveEvents(withHouse, [], { now, days: 400 });
    expect(ev.some(e => e.id === 'rra-fat' && e.date === '2027-03-31')).toBe(true);
    expect(ev.some(e => e.id === 'rra-levy')).toBe(false);
  });
  it('nextYearly rolls past dates into next year', () => {
    expect(nextYearly('2020-09-08', now)).toBe('2026-09-08');
    expect(nextYearly('2020-09-07', now)).toBe('2027-09-07');
    expect(daysUntil('2026-09-10', now)).toBe(2);
    expect(daysUntil('nope', now)).toBeNull();
  });
});

describe('affordability', () => {
  const state = {
    assets: [{ id: 'a', kind: 'savings', currency: 'RWF', currentValue: 5_000_000, purchasePrice: 5_000_000 }],
    cashflows: [
      { type: 'income',  amount: 1_500_000, currency: 'RWF', date: '2026-01-01', recurring: 'monthly' },
      { type: 'expense', amount: 1_000_000, currency: 'RWF', date: '2026-01-01', recurring: 'monthly' },
    ],
  };
  it('classifies now / soon / stretch against the 3-month buffer', () => {
    // liquid 5M − buffer 3M = 2M investable; pace +500k/month
    expect(affordability({ amount: 1_500_000 }, state, now)).toMatchObject({ status: 'now', gap: 0 });
    expect(affordability({ amount: 3_000_000 }, state, now)).toMatchObject({ status: 'soon', gap: 1_000_000, monthsToAfford: 2 });
    expect(affordability({ amount: 9_000_000 }, state, now)).toMatchObject({ status: 'stretch', monthsToAfford: 14 });
    expect(affordability({ amount: 0 }, state, now).status).toBe('unknown');
  });
  it('has no horizon when the household is not saving', () => {
    const broke = { ...state, cashflows: [state.cashflows[1]] };
    expect(affordability({ amount: 3_000_000 }, broke, now)).toMatchObject({ status: 'stretch', monthsToAfford: null });
  });
});

describe('insuranceGaps', () => {
  it('lists vehicles and houses without a linked policy', () => {
    const assets = [{ id: 'v', kind: 'vehicle' }, { id: 'h', kind: 'realestate-house' }, { id: 'l', kind: 'realestate-land' }, { id: 's', kind: 'savings' }];
    const items = [{ kind: 'policy', status: 'open', data: { asset_id: 'v' } }, { kind: 'policy', status: 'archived', data: { asset_id: 'h' } }];
    expect(insuranceGaps(assets, items).map(a => a.id)).toEqual(['h']);
  });
});
