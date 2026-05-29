import { describe, it, expect } from 'vitest';
import { runInsights } from './index.js';
import { asset, cf, mkState } from '../_testutils.js';

// A vehicle near its 31-Dec levy deadline + a 90%-concentrated, all-idle,
// low-runway portfolio → multiple insights across severities.
const NOW = new Date('2025-12-20T00:00:00.000Z');
function richState() {
  return mkState({
    assets: [
      asset({ id: 'veh', kind: 'vehicle', vehicleCategory: 'car', currentValue: 18_000_000 }),
      asset({ id: 'momo', kind: 'momo-cash', currentValue: 2_000_000 }),
    ],
    cashflows: [cf({ id: 'exp', type: 'expense', recurring: 'monthly', amount: 1_500_000 })],
  });
}

function validIds(state) {
  const ids = new Set();
  for (const c of ['assets', 'liabilities', 'cashflows', 'goals']) {
    for (const e of state[c] || []) ids.add(e.id);
  }
  return ids;
}

describe('runInsights', () => {
  it('every returned insight is well-formed (sourceRefs + dataAsOf)', () => {
    const state = richState();
    const { insights } = runInsights(state, { now: NOW });
    expect(insights.length).toBeGreaterThan(0);
    for (const ins of insights) {
      expect(ins.sourceRefs.length).toBeGreaterThan(0);
      expect(typeof ins.dataAsOf).toBe('string');
      expect(ins.dataAsOf.length).toBeGreaterThan(0);
    }
  });

  it('stale-ref guard: no insight references a non-existent entity', () => {
    const state = richState();
    const valid = validIds(state);
    const { insights } = runInsights(state, { now: NOW });
    for (const ins of insights) {
      for (const ref of ins.sourceRefs) expect(valid.has(ref)).toBe(true);
    }
  });

  it('pins the highest-severity cost', () => {
    const { topCost } = runInsights(richState(), { now: NOW });
    expect(topCost).toBeTruthy();
    expect(topCost.costOfAbsence.severity).toBe('critical');
  });

  it('respects the result limit', () => {
    const { insights } = runInsights(richState(), { now: NOW, limit: 3 });
    expect(insights.length).toBeLessThanOrEqual(3);
  });

  it('dismissing the top cost promotes the next one and flags it dismissed', () => {
    const first = runInsights(richState(), { now: NOW });
    const dismissedId = first.topCost.id;
    const second = runInsights(richState(), { now: NOW, dismissed: new Set([dismissedId]) });
    expect(second.topCost).toBeTruthy();
    expect(second.topCost.id).not.toBe(dismissedId);
    const flagged = second.insights.find(i => i.id === dismissedId);
    if (flagged) expect(flagged.dismissed).toBe(true);
  });

  it('returns no cost on an empty portfolio', () => {
    const { insights, topCost } = runInsights(mkState({ assets: [] }), { now: NOW });
    expect(topCost).toBeNull();
    expect(insights).toEqual([]);
  });
});
