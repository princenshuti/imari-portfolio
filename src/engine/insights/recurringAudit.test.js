import { describe, it, expect } from 'vitest';
import { auditRecurring } from './recurringAudit.js';

describe('auditRecurring', () => {
  it('returns empty audit when no recurring expenses', () => {
    const r = auditRecurring([]);
    expect(r.count).toBe(0);
    expect(r.totalMonthly).toBe(0);
    expect(r.subscriptions).toEqual([]);
  });

  it('excludes "once" entries', () => {
    const r = auditRecurring([
      { id: '1', type: 'expense', recurring: 'once', amount: 5000, currency: 'RWF' },
    ]);
    expect(r.count).toBe(0);
  });

  it('excludes income flows even if recurring', () => {
    const r = auditRecurring([
      { id: '1', type: 'income', recurring: 'monthly', amount: 500000, currency: 'RWF' },
    ]);
    expect(r.count).toBe(0);
  });

  it('annualises quarterly + annually correctly', () => {
    const r = auditRecurring([
      { id: 'q', type: 'expense', recurring: 'quarterly', amount: 30000, currency: 'RWF', description: 'BNR fee' },
      { id: 'a', type: 'expense', recurring: 'annually', amount: 120000, currency: 'RWF', description: 'Insurance' },
      { id: 'm', type: 'expense', recurring: 'monthly', amount: 12000, currency: 'RWF', description: 'Netflix' },
    ]);
    expect(r.count).toBe(3);
    // 30000/3 + 120000/12 + 12000 = 10000 + 10000 + 12000 = 32000
    expect(r.totalMonthly).toBe(32000);
    expect(r.totalAnnual).toBe(32000 * 12);
  });

  it('sorts subscriptions by monthly equivalent descending', () => {
    const r = auditRecurring([
      { id: 'a', type: 'expense', recurring: 'monthly', amount: 5000, currency: 'RWF' },
      { id: 'b', type: 'expense', recurring: 'monthly', amount: 50000, currency: 'RWF' },
      { id: 'c', type: 'expense', recurring: 'monthly', amount: 15000, currency: 'RWF' },
    ]);
    expect(r.subscriptions.map(s => s.id)).toEqual(['b', 'c', 'a']);
  });

  it('groups by category with totals', () => {
    const r = auditRecurring([
      { id: '1', type: 'expense', recurring: 'monthly', amount: 5000, currency: 'RWF', category: 'utilities' },
      { id: '2', type: 'expense', recurring: 'monthly', amount: 8000, currency: 'RWF', category: 'utilities' },
      { id: '3', type: 'expense', recurring: 'monthly', amount: 12000, currency: 'RWF', category: 'entertainment' },
    ]);
    expect(r.byCategory).toHaveLength(2);
    expect(r.byCategory[0]).toEqual({ category: 'utilities', count: 2, monthly: 13000 });
    expect(r.byCategory[1]).toEqual({ category: 'entertainment', count: 1, monthly: 12000 });
  });
});
