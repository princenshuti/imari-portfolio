// catRules.js — user-defined categorisation rules. Pure. A rule says "when a
// description contains X, categorise as Y". Rules are the user's explicit
// word, so they outrank both the keyword matcher and the AI second pass —
// and they're free, offline, and deterministic.
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../data.js';

const INCOME_IDS  = new Set(INCOME_CATEGORIES.map(c => c.id));
const EXPENSE_IDS = new Set(EXPENSE_CATEGORIES.map(c => c.id));

/** 'income' | 'expense' | null for a category id. */
export function typeOfCategory(categoryId) {
  if (INCOME_IDS.has(categoryId)) return 'income';
  if (EXPENSE_IDS.has(categoryId)) return 'expense';
  return null;
}

/** A rule is usable when it has a non-empty pattern and a known category. */
export function isValidRule(rule) {
  return Boolean(rule
    && typeof rule.pattern === 'string' && rule.pattern.trim().length >= 2
    && typeOfCategory(rule.category));
}

/**
 * First rule whose pattern appears (case-insensitive) in `text` and whose
 * category matches the entry type. Rule order is user-defined priority.
 * @returns {object|null}
 */
export function matchCatRule(rules = [], text = '', type = 'expense') {
  const hay = String(text || '').toLowerCase();
  if (!hay) return null;
  for (const rule of rules) {
    if (!isValidRule(rule)) continue;
    if (typeOfCategory(rule.category) !== type) continue;
    if (hay.includes(rule.pattern.trim().toLowerCase())) return rule;
  }
  return null;
}

/**
 * Apply rules to import drafts (output of rowsToDrafts). Returns a new array;
 * matched drafts get the rule's category, high confidence, and _ruleApplied,
 * so the AI pass skips them. Fee rows keep their bank-fees category.
 */
export function applyCatRules(drafts = [], rules = []) {
  if (!rules.length) return drafts;
  return drafts.map(d => {
    if (d._isFee) return d;
    const rule = matchCatRule(rules, d._desc || d.notes || '', d.type);
    if (!rule) return d;
    return { ...d, category: rule.category, _confidence: 'high', _ruleApplied: true };
  });
}
