import { describe, it, expect } from 'vitest';
import { FEATURE_MODULES, CORE_NAV_IDS, isFeatureEnabled, visibleNavIds } from './features.js';
import { NAV_ITEMS } from './nav.js';

const base = (over = {}) => ({ profile: {}, assets: [], liabilities: [], goals: [], cashflows: [], ...over });

describe('feature modules', () => {
  it('every module navId exists in NAV_ITEMS, and core ids do too', () => {
    for (const mod of FEATURE_MODULES) {
      for (const id of mod.navIds) expect(NAV_ITEMS[id], `${mod.key} → ${id}`).toBeDefined();
    }
    for (const id of CORE_NAV_IDS) expect(NAV_ITEMS[id]).toBeDefined();
  });

  it('an empty portfolio shows only the core menu', () => {
    const ids = visibleNavIds(base());
    expect([...ids].sort()).toEqual([...CORE_NAV_IDS].sort());
  });

  it('adding an expense switches Cash Flow (and Reports) on', () => {
    const s = base({ cashflows: [{ id: 'c1', type: 'expense', amount: 1000 }] });
    const ids = visibleNavIds(s);
    expect(ids.has('cashflow')).toBe(true);
    expect(ids.has('reports')).toBe(true);
    expect(ids.has('liabilities')).toBe(false);
  });

  it('a salary entry switches Retirement on', () => {
    const s = base({ cashflows: [{ id: 'c1', type: 'income', category: 'salary', recurring: 'monthly', amount: 1 }] });
    expect(visibleNavIds(s).has('retirement')).toBe(true);
  });

  it('explicit settings override the data in both directions', () => {
    const withData = base({
      profile: { features: { cashflow: false } },
      cashflows: [{ id: 'c1', type: 'expense', amount: 1000 }],
    });
    expect(isFeatureEnabled(withData, 'cashflow')).toBe(false);

    const noData = base({ profile: { features: { trends: true } } });
    expect(visibleNavIds(noData).has('trends')).toBe(true);
  });

  it('savings/MoMo assets enable Accounts; other kinds do not', () => {
    expect(visibleNavIds(base({ assets: [{ id: 'a', kind: 'momo-cash' }] })).has('accounts')).toBe(true);
    expect(visibleNavIds(base({ assets: [{ id: 'a', kind: 'realestate-land' }] })).has('accounts')).toBe(false);
  });
});

describe('gated family module', () => {
  const s = base({ profile: { features: { family: true } } });
  it('stays hidden without the entitlement, even when forced on in Settings', () => {
    expect(isFeatureEnabled(s, 'family')).toBe(false);
    expect(visibleNavIds(s).has('family')).toBe(false);
    expect(visibleNavIds(s, { entitlements: { tier: 'free', features: ['doc_vault'] } }).has('scorecard')).toBe(false);
  });
  it('switches on with the family feature or the diaspora tier', () => {
    const ids = visibleNavIds(base(), { entitlements: { tier: 'free', features: ['family'] } });
    expect(ids.has('family')).toBe(true);
    expect(ids.has('scorecard')).toBe(true);
    expect(visibleNavIds(base(), { entitlements: { tier: 'diaspora', features: [] } }).has('family')).toBe(true);
  });
});
