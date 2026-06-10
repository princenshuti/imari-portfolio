import { describe, it, expect } from 'vitest';
import { serializeBudgeted } from './advisorContext.js';

const asset = (i, v) => ({
  name: `Asset ${i}`, class: 'Savings', group: 'Cash', currency: 'RWF',
  purchasePrice: v, currentValue: v, currentValueRWF: v, gainPct: 0,
});

describe('serializeBudgeted', () => {
  it('returns the full context untouched when it fits', () => {
    const ctx = { totals: { netWorthRWF: 1 }, assets: [asset(1, 100)] };
    const out = serializeBudgeted(ctx, 6000);
    expect(JSON.parse(out)).toEqual(ctx);
  });

  it('always returns valid, parseable JSON under pressure', () => {
    const ctx = {
      marketConditions: { bnrFx: { USD: { buyRWF: 1430, sellRWF: 1460 } } },
      assets: Array.from({ length: 200 }, (_, i) => asset(i, 1_000_000 - i)),
      precomputedInsights: Array.from({ length: 16 }, (_, i) => ({ headline: `insight ${i}`, detail: 'x'.repeat(120) })),
      liabilities: Array.from({ length: 10 }, (_, i) => ({ name: `loan ${i}`, remainingRWF: 1 })),
    };
    const out = serializeBudgeted(ctx, 6000);
    expect(out.length).toBeLessThanOrEqual(6000);
    const parsed = JSON.parse(out); // throws if the cap ever cuts mid-JSON
    expect(parsed.marketConditions.bnrFx.USD.buyRWF).toBe(1430); // never trimmed
    expect(parsed.assetsOmitted).toBeGreaterThan(0);
  });

  it('keeps the highest-value assets when trimming', () => {
    const ctx = {
      assets: Array.from({ length: 100 }, (_, i) => asset(i, (i + 1) * 10_000)),
      filler: 'y'.repeat(3000),
    };
    const parsed = JSON.parse(serializeBudgeted(ctx, 6000));
    const kept = parsed.assets.map(a => a.currentValueRWF);
    expect(Math.max(...kept)).toBe(1_000_000); // the biggest survived
    expect(kept).toEqual([...kept].sort((a, b) => b - a));
  });
});
