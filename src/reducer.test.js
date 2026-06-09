import { describe, it, expect } from 'vitest';
import { reducer, upsert, syncAccountBalance } from './reducer.js';

function baseState(over = {}) {
  return {
    profile: { name: 'Test', displayCurrency: 'RWF' },
    assets: [], liabilities: [], goals: [], cashflows: [], snapshots: [],
    chat: [], reachedMilestones: [], fx: {},
    ...over,
  };
}

describe('upsert', () => {
  it('adds a new item and replaces an existing one by id', () => {
    const a = upsert([], { id: '1', v: 1 });
    expect(a).toHaveLength(1);
    const b = upsert(a, { id: '1', v: 2 });
    expect(b).toHaveLength(1);
    expect(b[0].v).toBe(2);
  });
});

describe('upsertAsset', () => {
  it('stamps updatedAt with a valid ISO timestamp', () => {
    const next = reducer(baseState(), {
      type: 'upsertAsset',
      asset: { id: 'x', kind: 'crypto', name: 'BTC', currency: 'RWF', purchasePrice: 100, currentValue: 200 },
    });
    const stamped = next.assets[0];
    expect(typeof stamped.updatedAt).toBe('string');
    expect(Number.isNaN(Date.parse(stamped.updatedAt))).toBe(false);
  });
});

describe('account balance sync (money math)', () => {
  const account = { id: 'acc', kind: 'savings', currency: 'RWF', purchasePrice: 1_000_000, currentValue: 1_000_000 };

  it('upsertCashflow recomputes the linked account balance', () => {
    const state = baseState({ assets: [account] });
    const next = reducer(state, {
      type: 'upsertCashflow',
      entry: { id: 'cf1', accountId: 'acc', recurring: 'once', type: 'income', amount: 500_000, currency: 'RWF', date: '2025-01-01' },
    });
    expect(next.assets[0].currentValue).toBe(1_500_000);
  });

  it('an expense reduces the balance', () => {
    const state = baseState({
      assets: [account],
      cashflows: [{ id: 'cf1', accountId: 'acc', recurring: 'once', type: 'expense', amount: 300_000, currency: 'RWF', date: '2025-01-01' }],
    });
    // Re-saving the account triggers a resync from purchasePrice + linked flows.
    const next = reducer(state, { type: 'upsertAsset', asset: account });
    expect(next.assets[0].currentValue).toBe(700_000);
  });

  it('syncAccountBalance is a no-op for an unknown account', () => {
    const assets = [account];
    expect(syncAccountBalance(assets, [], 'missing')).toBe(assets);
  });
});

describe('categorisation rules (F5)', () => {
  const rule = { id: 'r1', pattern: 'mtn', category: 'utilities' };

  it('upsertCatRule adds a rule even when catRules is absent', () => {
    const next = reducer(baseState(), { type: 'upsertCatRule', rule });
    expect(next.catRules).toEqual([rule]);
  });

  it('upsertCatRule replaces a rule with the same id', () => {
    const state = baseState({ catRules: [rule] });
    const next = reducer(state, { type: 'upsertCatRule', rule: { ...rule, category: 'bank-fees' } });
    expect(next.catRules).toHaveLength(1);
    expect(next.catRules[0].category).toBe('bank-fees');
  });

  it('deleteCatRule removes only the matching rule', () => {
    const state = baseState({ catRules: [rule, { id: 'r2', pattern: 'shop', category: 'food' }] });
    const next = reducer(state, { type: 'deleteCatRule', id: 'r1' });
    expect(next.catRules.map(r => r.id)).toEqual(['r2']);
  });
});

describe('budgets (F6)', () => {
  it('setBudget creates the map and sets a category limit', () => {
    const next = reducer(baseState(), { type: 'setBudget', category: 'food', amount: 200000 });
    expect(next.budgets).toEqual({ food: 200000 });
  });

  it('setBudget overwrites an existing limit', () => {
    const state = baseState({ budgets: { food: 100000 } });
    const next = reducer(state, { type: 'setBudget', category: 'food', amount: 250000 });
    expect(next.budgets.food).toBe(250000);
  });

  it('setBudget with zero/empty removes the envelope', () => {
    const state = baseState({ budgets: { food: 100000, transport: 50000 } });
    const next = reducer(state, { type: 'setBudget', category: 'food', amount: 0 });
    expect(next.budgets).toEqual({ transport: 50000 });
  });
});
