import { describe, it, expect } from 'vitest';
import { searchPortfolio } from './search.js';

const state = {
  assets: [
    { id: 'a1', kind: 'realestate-land', name: 'Bugesera plot', currentValue: 12000000, currency: 'RWF' },
    { id: 'a2', kind: 'savings', name: 'BK savings', currentValue: 800000, currency: 'RWF', notes: 'emergency fund' },
  ],
  liabilities: [
    { id: 'l1', kind: 'bank-loan', name: 'Moto loan', lender: 'Equity Bank', remainingAmount: 900000, currency: 'RWF' },
  ],
  goals: [
    { id: 'g1', name: 'Land in Bugesera', category: 'land', targetAmount: 15000000, currency: 'RWF' },
  ],
  cashflows: [
    { id: 'c1', type: 'expense', category: 'food', amount: 50000, currency: 'RWF', date: '2026-06-01', notes: 'Simba supermarket' },
  ],
};

describe('searchPortfolio', () => {
  it('returns nothing for queries under 2 characters', () => {
    expect(searchPortfolio(state, 'b')).toEqual([]);
    expect(searchPortfolio(state, '  ')).toEqual([]);
  });

  it('finds assets by name, case-insensitively', () => {
    const r = searchPortfolio(state, 'bugesera');
    const types = r.map(x => `${x.type}:${x.id}`);
    expect(types).toContain('asset:a1');
    expect(types).toContain('goal:g1');
  });

  it('finds liabilities by lender', () => {
    const r = searchPortfolio(state, 'equity');
    expect(r[0].type).toBe('liability');
    expect(r[0].to).toBe('liabilities');
  });

  it('finds cashflow entries by notes', () => {
    const r = searchPortfolio(state, 'simba');
    expect(r[0].type).toBe('cashflow');
    expect(r[0].to).toBe('cashflow');
  });

  it('matches asset notes', () => {
    const r = searchPortfolio(state, 'emergency');
    expect(r[0].id).toBe('a2');
  });

  it('matches app views by name', () => {
    const r = searchPortfolio(state, 'retire');
    expect(r.some(x => x.type === 'view' && x.to === 'retirement')).toBe(true);
  });

  it('ranks owned items above view entries on the same query', () => {
    // "goal" hits both the Goals view and the goal item via its category label.
    const r = searchPortfolio({ ...state, goals: [{ id: 'g2', name: 'goal x', targetAmount: 1, currency: 'RWF' }] }, 'goal');
    expect(r[0].type).toBe('goal');
  });

  it('respects the result limit', () => {
    const many = { assets: Array.from({ length: 20 }, (_, i) => ({ id: `x${i}`, kind: 'savings', name: `Cash ${i}`, currentValue: 1, currency: 'RWF' })) };
    expect(searchPortfolio(many, 'cash', { limit: 5 })).toHaveLength(5);
  });

  it('handles an empty portfolio without errors', () => {
    expect(searchPortfolio({}, 'anything')).toEqual([]);
  });
});
