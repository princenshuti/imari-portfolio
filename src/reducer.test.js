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
