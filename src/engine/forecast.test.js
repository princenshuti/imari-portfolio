import { describe, it, expect } from 'vitest';
import { forecastCashflow } from './forecast.js';

const NOW = new Date(2026, 5, 10); // 10 June 2026, local

describe('forecastCashflow', () => {
  it('flat balance when there are no cashflows', () => {
    const r = forecastCashflow({ cashflows: [], openingBalance: 100000, now: NOW });
    expect(r.days).toHaveLength(30);
    expect(r.totalIncome).toBe(0);
    expect(r.totalExpense).toBe(0);
    expect(r.endBalance).toBe(100000);
    expect(r.firstShortfallDate).toBeNull();
  });

  it('fires a monthly entry on its anchor day-of-month', () => {
    const r = forecastCashflow({
      cashflows: [{ type: 'income', recurring: 'monthly', amount: 500000, currency: 'RWF', date: '2026-01-25' }],
      openingBalance: 0,
      now: NOW,
    });
    const payday = r.days.find(d => d.date === '2026-06-25');
    expect(payday.income).toBe(500000);
    expect(r.totalIncome).toBe(500000); // fires exactly once in 30 days
    expect(r.endBalance).toBe(500000);
  });

  it('clamps an end-of-month anchor to shorter months', () => {
    // Anchored on the 31st; June has 30 days → fires on 30 June.
    const r = forecastCashflow({
      cashflows: [{ type: 'expense', recurring: 'monthly', amount: 10000, currency: 'RWF', date: '2026-01-31' }],
      openingBalance: 0,
      now: NOW,
    });
    expect(r.days.find(d => d.date === '2026-06-30').expense).toBe(10000);
  });

  it('fires a quarterly entry only on quarter months', () => {
    // Anchor March 15 → fires June 15 (3 months later), not May/July.
    const r = forecastCashflow({
      cashflows: [{ type: 'expense', recurring: 'quarterly', amount: 30000, currency: 'RWF', date: '2026-03-15' }],
      openingBalance: 0,
      now: NOW,
    });
    expect(r.days.find(d => d.date === '2026-06-15').expense).toBe(30000);
    expect(r.totalExpense).toBe(30000);
  });

  it('fires an annual entry on its anniversary only', () => {
    const r = forecastCashflow({
      cashflows: [{ type: 'expense', recurring: 'annually', amount: 120000, currency: 'RWF', date: '2025-06-20' }],
      openingBalance: 0,
      now: NOW,
    });
    expect(r.days.find(d => d.date === '2026-06-20').expense).toBe(120000);
    expect(r.totalExpense).toBe(120000);
  });

  it('does not fire a recurring entry before its anchor date', () => {
    const r = forecastCashflow({
      cashflows: [{ type: 'income', recurring: 'monthly', amount: 500000, currency: 'RWF', date: '2026-08-01' }],
      openingBalance: 0,
      now: NOW,
    });
    expect(r.totalIncome).toBe(0);
  });

  it('includes future-dated one-offs and ignores past ones', () => {
    const r = forecastCashflow({
      cashflows: [
        { type: 'expense', recurring: 'once', amount: 80000, currency: 'RWF', date: '2026-06-18' },
        { type: 'expense', recurring: 'once', amount: 99999, currency: 'RWF', date: '2026-06-01' }, // past
      ],
      openingBalance: 0,
      now: NOW,
    });
    expect(r.totalExpense).toBe(80000);
    expect(r.days.find(d => d.date === '2026-06-18').expense).toBe(80000);
  });

  it('flags the first shortfall day and the minimum balance', () => {
    const r = forecastCashflow({
      cashflows: [
        { type: 'expense', recurring: 'monthly', amount: 60000, currency: 'RWF', date: '2026-01-15' },
        { type: 'income', recurring: 'monthly', amount: 100000, currency: 'RWF', date: '2026-01-25' },
      ],
      openingBalance: 50000,
      now: NOW,
    });
    // 15 June: 50000 − 60000 = −10000 → shortfall; 25 June: +100000 → 90000.
    expect(r.firstShortfallDate).toBe('2026-06-15');
    expect(r.minBalance).toBe(-10000);
    expect(r.minDate).toBe('2026-06-15');
    expect(r.endBalance).toBe(90000);
  });

  it('converts non-RWF entries via the base rate', () => {
    const r = forecastCashflow({
      cashflows: [{ type: 'income', recurring: 'monthly', amount: 100, currency: 'USD', date: '2026-01-05' }],
      openingBalance: 0,
      now: NOW,
    });
    expect(r.totalIncome).toBeGreaterThan(100); // USD→RWF rate is far above 1
  });

  it('respects a custom horizon', () => {
    const r = forecastCashflow({ cashflows: [], openingBalance: 0, now: NOW, days: 7 });
    expect(r.days).toHaveLength(7);
    expect(r.days[0].date).toBe('2026-06-11');
    expect(r.days[6].date).toBe('2026-06-17');
  });
});
