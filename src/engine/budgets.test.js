import { describe, it, expect } from 'vitest';
import { monthSpendByCategory, budgetStatus } from './budgets.js';

const NOW = new Date(2026, 5, 15); // 15 June 2026 — exactly halfway through a 30-day month

describe('monthSpendByCategory', () => {
  it('counts one-offs only inside the month', () => {
    const spend = monthSpendByCategory([
      { type: 'expense', category: 'food', recurring: 'once', amount: 50000, currency: 'RWF', date: '2026-06-03' },
      { type: 'expense', category: 'food', recurring: 'once', amount: 99999, currency: 'RWF', date: '2026-05-28' },
    ], NOW);
    expect(spend.food).toBe(50000);
  });

  it('pro-rates recurring entries to their monthly equivalent', () => {
    const spend = monthSpendByCategory([
      { type: 'expense', category: 'rent', recurring: 'monthly', amount: 300000, currency: 'RWF', date: '2026-01-01' },
      { type: 'expense', category: 'insurance', recurring: 'annually', amount: 120000, currency: 'RWF', date: '2026-02-01' },
    ], NOW);
    expect(spend.rent).toBe(300000);
    expect(spend.insurance).toBe(10000);
  });

  it('ignores income and future-anchored recurring entries', () => {
    const spend = monthSpendByCategory([
      { type: 'income', category: 'salary', recurring: 'monthly', amount: 900000, currency: 'RWF', date: '2026-01-01' },
      { type: 'expense', category: 'food', recurring: 'monthly', amount: 50000, currency: 'RWF', date: '2026-09-01' },
    ], NOW);
    expect(spend).toEqual({});
  });
});

describe('budgetStatus', () => {
  const cashflows = [
    { type: 'expense', category: 'food', recurring: 'once', amount: 180000, currency: 'RWF', date: '2026-06-05' },
    { type: 'expense', category: 'transport', recurring: 'once', amount: 20000, currency: 'RWF', date: '2026-06-08' },
  ];

  it('only budgeted categories produce rows, sorted by pressure', () => {
    const r = budgetStatus(cashflows, { food: 200000, transport: 100000 }, NOW);
    expect(r.rows.map(x => x.category)).toEqual(['food', 'transport']);
    expect(r.rows[0].pct).toBe(90);
    expect(r.rows[1].pct).toBe(20);
  });

  it('flags over-budget envelopes and totals the overshoot', () => {
    const r = budgetStatus(cashflows, { food: 150000 }, NOW);
    expect(r.rows[0].over).toBe(true);
    expect(r.rows[0].pace).toBe('over');
    expect(r.overCount).toBe(1);
    expect(r.totalOver).toBe(30000);
  });

  it('marks a not-yet-over envelope "hot" when burn outpaces the month', () => {
    // Halfway through June (monthPct 50), food at 90% of budget → hot.
    const r = budgetStatus(cashflows, { food: 200000 }, NOW);
    expect(r.monthPct).toBe(50);
    expect(r.rows[0].pace).toBe('hot');
  });

  it('keeps an on-pace envelope "ok"', () => {
    const r = budgetStatus(cashflows, { transport: 100000 }, NOW);
    expect(r.rows[0].pace).toBe('ok');
  });

  it('returns empty status when no budgets are set', () => {
    const r = budgetStatus(cashflows, {}, NOW);
    expect(r.rows).toEqual([]);
    expect(r.totalBudget).toBe(0);
    expect(r.overCount).toBe(0);
  });
});
