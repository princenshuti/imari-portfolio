import { describe, it, expect } from 'vitest';
import { parseLocalDate, monthlyEquivalent, monthlyEquivalentRWF, countsInMonth } from './recurrence.js';

describe('parseLocalDate', () => {
  it('parses date-only strings as LOCAL midnight regardless of timezone', () => {
    const d = parseLocalDate('2026-06-01');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(1); // new Date('2026-06-01') would give 31 May west of UTC
    expect(d.getHours()).toBe(0);
  });

  it('passes Date instances through and respects full timestamps', () => {
    const now = new Date(2026, 5, 10, 14, 30);
    expect(parseLocalDate(now)).toBe(now);
    const ts = parseLocalDate('2026-06-01T08:00:00Z');
    expect(ts.getTime()).toBe(Date.parse('2026-06-01T08:00:00Z'));
  });

  it('returns Invalid Date for junk so callers can guard', () => {
    expect(Number.isNaN(parseLocalDate('not a date').getTime())).toBe(true);
    expect(Number.isNaN(parseLocalDate(null).getTime())).toBe(true);
  });
});

describe('monthlyEquivalent', () => {
  it('divides by cadence', () => {
    expect(monthlyEquivalent(12000, 'monthly')).toBe(12000);
    expect(monthlyEquivalent(30000, 'quarterly')).toBe(10000);
    expect(monthlyEquivalent(120000, 'annually')).toBe(10000);
    expect(monthlyEquivalent(5000, 'once')).toBe(5000);
  });

  it('monthlyEquivalentRWF converts currency first', () => {
    expect(monthlyEquivalentRWF({ amount: 12000, currency: 'RWF', recurring: 'monthly' })).toBe(12000);
    expect(monthlyEquivalentRWF({ amount: 100, currency: 'USD', recurring: 'monthly' })).toBeGreaterThan(100);
  });
});

describe('countsInMonth', () => {
  it('one-offs count only in their dated month — including the 1st', () => {
    const cf = { recurring: 'once', date: '2026-06-01' };
    expect(countsInMonth(cf, 2026, 5)).toBe(true);  // June
    expect(countsInMonth(cf, 2026, 4)).toBe(false); // May — the old UTC parse put it here
  });

  it('recurring entries count from their anchor month onward', () => {
    const cf = { recurring: 'monthly', date: '2026-03-15' };
    expect(countsInMonth(cf, 2026, 2)).toBe(true);  // March (anchor month)
    expect(countsInMonth(cf, 2026, 7)).toBe(true);  // August
    expect(countsInMonth(cf, 2026, 1)).toBe(false); // February (before anchor)
  });

  it('rejects invalid dates', () => {
    expect(countsInMonth({ recurring: 'once', date: 'garbage' }, 2026, 5)).toBe(false);
  });
});
