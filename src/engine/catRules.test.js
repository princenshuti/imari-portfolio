import { describe, it, expect } from 'vitest';
import { typeOfCategory, isValidRule, matchCatRule, applyCatRules } from './catRules.js';

const rule = (pattern, category, extra = {}) => ({ id: pattern, pattern, category, ...extra });

describe('typeOfCategory', () => {
  it('classifies income, expense, and unknown ids', () => {
    expect(typeOfCategory('salary')).toBe('income');
    expect(typeOfCategory('school-fees')).toBe('expense');
    expect(typeOfCategory('nonsense')).toBeNull();
  });
});

describe('isValidRule', () => {
  it('rejects short patterns, unknown categories, and junk', () => {
    expect(isValidRule(rule('mtn', 'utilities'))).toBe(true);
    expect(isValidRule(rule('m', 'utilities'))).toBe(false);
    expect(isValidRule(rule('  ', 'utilities'))).toBe(false);
    expect(isValidRule(rule('mtn', 'not-a-cat'))).toBe(false);
    expect(isValidRule(null)).toBe(false);
  });
});

describe('matchCatRule', () => {
  const rules = [
    rule('akagera motors', 'transport'),
    rule('mtn', 'utilities'),
    rule('client kagabo', 'freelance'),
  ];

  it('matches case-insensitively as a substring', () => {
    expect(matchCatRule(rules, 'Payment to MTN Rwanda airtime', 'expense').category).toBe('utilities');
  });

  it('respects rule order — first hit wins', () => {
    const r = matchCatRule(rules, 'AKAGERA MOTORS via mtn momo', 'expense');
    expect(r.category).toBe('transport');
  });

  it('never crosses entry type', () => {
    // 'client kagabo' is an income rule (freelance) — must not hit expenses.
    expect(matchCatRule(rules, 'refund to client kagabo', 'expense')).toBeNull();
    expect(matchCatRule(rules, 'invoice client kagabo', 'income').category).toBe('freelance');
  });

  it('returns null on empty text or no match', () => {
    expect(matchCatRule(rules, '', 'expense')).toBeNull();
    expect(matchCatRule(rules, 'totally unrelated', 'expense')).toBeNull();
  });

  it('skips invalid rules instead of throwing', () => {
    const r = matchCatRule([{ pattern: '', category: 'food' }, rule('shop', 'food')], 'corner shop', 'expense');
    expect(r.category).toBe('food');
  });
});

describe('applyCatRules', () => {
  const rules = [rule('vision city', 'rent')];

  it('overrides category and lifts confidence on matched drafts', () => {
    const drafts = [
      { _key: 1, type: 'expense', category: 'other-exp', _confidence: 'low', _desc: 'VISION CITY estate monthly' },
      { _key: 2, type: 'expense', category: 'food', _confidence: 'high', _desc: 'Simba supermarket' },
    ];
    const out = applyCatRules(drafts, rules);
    expect(out[0].category).toBe('rent');
    expect(out[0]._confidence).toBe('high');
    expect(out[0]._ruleApplied).toBe(true);
    expect(out[1]).toBe(drafts[1]); // untouched
  });

  it('leaves fee rows alone even when the description matches', () => {
    const drafts = [{ _key: 1, type: 'expense', category: 'bank-fees', _isFee: true, _desc: 'Fee · vision city' }];
    const out = applyCatRules(drafts, rules);
    expect(out[0].category).toBe('bank-fees');
    expect(out[0]._ruleApplied).toBeUndefined();
  });

  it('is a no-op without rules', () => {
    const drafts = [{ _key: 1, type: 'expense', _desc: 'x' }];
    expect(applyCatRules(drafts, [])).toBe(drafts);
  });
});
