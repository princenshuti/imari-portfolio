import { describe, it, expect } from 'vitest';
import { projectNetWorth, futureValue, HORIZONS, DEFAULT_ASSUMPTIONS } from './index.js';

describe('futureValue', () => {
  it('zero growth = principal + lump + contributions', () => {
    expect(futureValue(1000, 100, 500, 0, 12)).toBe(1000 + 500 + 100 * 12);
  });
  it('grows principal with positive rate', () => {
    expect(futureValue(1000, 0, 0, 12, 12)).toBeGreaterThan(1000);
  });
});

describe('projectNetWorth', () => {
  const input = { currentNetWorth: 10_000_000, monthlySavings: 200_000, lumpSum: 0 };

  it('returns every horizon with a low ≤ expected ≤ high band', () => {
    const { horizons } = projectNetWorth(input);
    expect(horizons.map(h => h.key)).toEqual(HORIZONS.map(h => h.key));
    for (const h of horizons) {
      expect(h.low).toBeLessThanOrEqual(h.expected);
      expect(h.expected).toBeLessThanOrEqual(h.high);
    }
  });

  it('boundary: months per horizon are exact', () => {
    const { horizons } = projectNetWorth(input);
    expect(horizons.find(h => h.key === '1Y').months).toBe(12);
    expect(horizons.find(h => h.key === '20Y').months).toBe(240);
  });

  it('longer horizons project larger expected values (positive growth + savings)', () => {
    const { horizons } = projectNetWorth(input);
    for (let i = 1; i < horizons.length; i++) {
      expect(horizons[i].expected).toBeGreaterThan(horizons[i - 1].expected);
    }
  });

  it('real expected is below nominal once inflation bites (beyond 1 month)', () => {
    const { horizons } = projectNetWorth(input);
    const tenY = horizons.find(h => h.key === '10Y');
    expect(tenY.realExpected).toBeLessThan(tenY.expected);
  });

  it('a lump sum raises every horizon', () => {
    const base = projectNetWorth(input).horizons.find(h => h.key === '5Y').expected;
    const withLump = projectNetWorth({ ...input, lumpSum: 5_000_000 }).horizons.find(h => h.key === '5Y').expected;
    expect(withLump).toBeGreaterThan(base);
  });

  it('exposes Modeled assumptions', () => {
    expect(projectNetWorth(input).assumptions.provenance).toBe('Modeled');
    expect(projectNetWorth(input).assumptions.expectedAnnualGrowthPct).toBe(DEFAULT_ASSUMPTIONS.expectedAnnualGrowthPct);
  });
});
