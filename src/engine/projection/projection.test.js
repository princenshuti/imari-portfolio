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


describe('projectSeries (fan chart path)', () => {
  it('starts at the current net worth and orders low ≤ expected ≤ high', async () => {
    const { projectSeries } = await import('./index.js');
    const { points } = projectSeries({ currentNetWorth: 10_000_000, monthlySavings: 100_000 }, { months: 24, stepMonths: 6 });
    expect(points[0].expected).toBe(10_000_000);
    expect(points[0].low).toBe(10_000_000);
    for (const p of points) {
      expect(p.low).toBeLessThanOrEqual(p.expected);
      expect(p.expected).toBeLessThanOrEqual(p.high);
    }
    expect(points[points.length - 1].month).toBe(24);
    expect(points[points.length - 1].expected).toBeGreaterThan(10_000_000);
  });

  it('matches projectNetWorth at shared horizons', async () => {
    const { projectSeries, default: projectNetWorth } = await import('./index.js');
    const input = { currentNetWorth: 5_000_000, monthlySavings: 200_000 };
    const { points } = projectSeries(input, { months: 60, stepMonths: 12 });
    const { horizons } = projectNetWorth(input);
    const h5 = horizons.find(h => h.key === '5Y');
    const p60 = points.find(p => p.month === 60);
    expect(p60.expected).toBeCloseTo(h5.expected, 4);
  });
});
