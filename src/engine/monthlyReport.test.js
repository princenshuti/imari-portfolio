import { describe, it, expect } from 'vitest';
import { buildMonthlyReport } from './monthlyReport.js';

const NOW = new Date(2026, 5, 15); // 15 June 2026

const cashflows = [
  { type: 'income',  category: 'salary',    recurring: 'monthly', amount: 900000, currency: 'RWF', date: '2026-01-01' },
  { type: 'expense', category: 'rent',      recurring: 'monthly', amount: 300000, currency: 'RWF', date: '2026-01-01' },
  { type: 'expense', category: 'food',      recurring: 'once',    amount: 120000, currency: 'RWF', date: '2026-06-04', notes: 'Simba run' },
  { type: 'expense', category: 'transport', recurring: 'once',    amount: 40000,  currency: 'RWF', date: '2026-05-20', notes: 'Fuel' },
];

describe('buildMonthlyReport', () => {
  it('totals the month with recurring equivalents plus in-month one-offs', () => {
    const r = buildMonthlyReport({ cashflows, now: NOW });
    expect(r.year).toBe(2026);
    expect(r.monthIdx).toBe(5);
    expect(r.income).toBe(900000);
    expect(r.expense).toBe(420000); // 300k rent + 120k food
    expect(r.net).toBe(480000);
    expect(r.savingsRate).toBeCloseTo((480000 / 900000) * 100, 5);
  });

  it('monthOffset walks back to earlier months', () => {
    const r = buildMonthlyReport({ cashflows, now: NOW, monthOffset: 1 });
    expect(r.monthIdx).toBe(4); // May
    expect(r.expense).toBe(340000); // rent + fuel
  });

  it('breaks expenses down by category with shares summing to 100', () => {
    const r = buildMonthlyReport({ cashflows, now: NOW });
    expect(r.expenseCategories[0].category).toBe('rent');
    const totalShare = r.expenseCategories.reduce((s, c) => s + c.share, 0);
    expect(totalShare).toBeCloseTo(100, 5);
  });

  it('lists top one-off expenses but not recurring ones', () => {
    const r = buildMonthlyReport({ cashflows, now: NOW });
    expect(r.topExpenses).toHaveLength(1);
    expect(r.topExpenses[0].description).toBe('Simba run');
  });

  it('computes deltas against the previous month', () => {
    const r = buildMonthlyReport({ cashflows, now: NOW });
    // May: income 900k, expense 340k → June expense delta = 420k − 340k.
    expect(r.incomeDelta).toBe(0);
    expect(r.expenseDelta).toBe(80000);
  });

  it('reads net-worth motion from snapshots inside the month', () => {
    const snapshots = [
      { date: '2026-06-02', netWorth: 5000000 },
      { date: '2026-06-14', netWorth: 5200000 },
      { date: '2026-05-30', netWorth: 4900000 }, // outside June
    ];
    const r = buildMonthlyReport({ cashflows, snapshots, now: NOW });
    expect(r.netWorth.change).toBe(200000);
    expect(r.netWorth.startDate).toBe('2026-06-02');
  });

  it('netWorth is null with fewer than 2 snapshots in the month', () => {
    const r = buildMonthlyReport({ cashflows, snapshots: [{ date: '2026-06-02', netWorth: 1 }], now: NOW });
    expect(r.netWorth).toBeNull();
  });

  it('includes budget status evaluated at month end', () => {
    const r = buildMonthlyReport({ cashflows, budgets: { food: 100000 }, now: NOW });
    expect(r.budgets.rows[0].over).toBe(true);
  });

  it('handles an empty month without dividing by zero', () => {
    const r = buildMonthlyReport({ cashflows: [], now: NOW });
    expect(r.income).toBe(0);
    expect(r.savingsRate).toBeNull();
    expect(r.expenseCategories).toEqual([]);
  });
});
