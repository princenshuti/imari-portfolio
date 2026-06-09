import { describe, it, expect } from 'vitest';
import { buildYearReview } from './yearReview.js';

const NOW = new Date(2026, 5, 10); // 10 June 2026

const snap = (date, netWorth, extra = {}) => ({ date, netWorth, costBasis: 0, ...extra });

describe('buildYearReview', () => {
  it('returns null with fewer than 2 snapshots', () => {
    expect(buildYearReview([], { now: NOW })).toBeNull();
    expect(buildYearReview([snap('2026-06-01', 1000)], { now: NOW })).toBeNull();
  });

  it('ignores snapshots older than 12 months', () => {
    const r = buildYearReview([
      snap('2024-01-01', 1), // outside window
      snap('2026-01-05', 1000000),
      snap('2026-06-01', 1500000),
    ], { now: NOW });
    expect(r.start.date).toBe('2026-01-05');
    expect(r.daysTracked).toBe(2);
  });

  it('computes start→end change and percentage', () => {
    const r = buildYearReview([
      snap('2025-07-01', 2000000),
      snap('2026-06-01', 2500000),
    ], { now: NOW });
    expect(r.change).toBe(500000);
    expect(r.changePct).toBe(25);
  });

  it('null changePct when starting from zero', () => {
    const r = buildYearReview([
      snap('2026-01-01', 0),
      snap('2026-06-01', 500000),
    ], { now: NOW });
    expect(r.changePct).toBeNull();
  });

  it('finds high and low watermarks', () => {
    const r = buildYearReview([
      snap('2026-01-01', 1000),
      snap('2026-02-01', 5000),
      snap('2026-03-01', 200),
      snap('2026-04-01', 3000),
    ], { now: NOW });
    expect(r.high).toEqual({ date: '2026-02-01', netWorth: 5000 });
    expect(r.low).toEqual({ date: '2026-03-01', netWorth: 200 });
  });

  it('buckets months on closing values with change vs previous close', () => {
    const r = buildYearReview([
      snap('2026-03-02', 1000), snap('2026-03-28', 1200),
      snap('2026-04-05', 1100), snap('2026-04-25', 1600),
      snap('2026-05-10', 1500), snap('2026-05-30', 1400),
    ], { now: NOW });
    expect(r.months.map(m => m.label)).toEqual(['Mar', 'Apr', 'May']);
    expect(r.months[0].change).toBe(200);  // 1200 − 1000 (window start)
    expect(r.months[1].change).toBe(400);  // 1600 − 1200
    expect(r.months[2].change).toBe(-200); // 1400 − 1600
    expect(r.bestMonth.label).toBe('Apr');
    expect(r.worstMonth.label).toBe('May');
  });

  it('excludes single-observation months from best/worst', () => {
    const r = buildYearReview([
      snap('2026-03-02', 1000), snap('2026-03-28', 1200),
      snap('2026-04-15', 9999), // lone stray snapshot
      snap('2026-05-10', 1300), snap('2026-05-30', 1250),
    ], { now: NOW });
    expect(r.bestMonth.label).not.toBe('Apr');
    expect(r.worstMonth.label).not.toBe('Apr');
  });

  it('flags windows containing synthetic seed history', () => {
    const real = buildYearReview([
      snap('2026-01-01', 100), snap('2026-02-01', 200),
    ], { now: NOW });
    const seeded = buildYearReview([
      snap('2026-01-01', 100, { synthetic: true }), snap('2026-02-01', 200),
    ], { now: NOW });
    expect(real.includesSynthetic).toBe(false);
    expect(seeded.includesSynthetic).toBe(true);
  });
});
