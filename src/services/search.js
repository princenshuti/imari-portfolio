// search.js — global portfolio search. Pure: deterministic given (state, query).
// Searches what the user owns (assets, liabilities, goals, cash-flow entries)
// plus app destinations, and returns flat, ranked results the TopBar widget
// renders. No index, no I/O — portfolios are small enough to scan live.
import { fmt, CLASSES, LIABILITY_TYPES, INCOME_CATEGORIES, EXPENSE_CATEGORIES, GOAL_CATEGORIES } from '../data.js';
import { NAV_ITEMS } from '../nav.js';

const ALL_CF_CATS = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

/** 2 = starts with, 1 = contains, 0 = no match. Case-insensitive. */
function scoreText(text, q) {
  const t = String(text || '').toLowerCase();
  if (!t) return 0;
  if (t.startsWith(q)) return 2;
  if (t.includes(q)) return 1;
  return 0;
}

function best(...scores) {
  return Math.max(...scores);
}

/**
 * @param {object} state  portfolio state
 * @param {string} query  raw user input
 * @param {{ limit?: number }} opts
 * @returns {Array<{ type, id, title, subtitle, to, score }>}
 */
export function searchPortfolio(state, query, { limit = 8 } = {}) {
  const q = String(query || '').trim().toLowerCase();
  if (q.length < 2) return [];
  const results = [];

  for (const a of state.assets || []) {
    const cls = CLASSES.find(c => c.kind === a.kind);
    const s = best(scoreText(a.name, q), scoreText(cls?.label, q), scoreText(a.notes, q));
    if (s) results.push({
      type: 'asset', id: a.id, title: a.name || cls?.label || 'Asset',
      subtitle: `${cls?.label || 'Asset'} · ${fmt(a.currentValue || a.purchasePrice || 0, a.currency || 'RWF', { compact: true })}`,
      to: 'assets', score: s + 1, // owning something outranks a menu entry
    });
  }

  for (const l of state.liabilities || []) {
    const t = LIABILITY_TYPES.find(x => x.kind === l.kind);
    const s = best(scoreText(l.name, q), scoreText(l.lender, q), scoreText(t?.label, q));
    if (s) results.push({
      type: 'liability', id: l.id, title: l.name || l.lender || t?.label || 'Debt',
      subtitle: `${t?.label || 'Debt'} · ${fmt(l.remainingAmount || 0, l.currency || 'RWF', { compact: true })} remaining`,
      to: 'liabilities', score: s + 1,
    });
  }

  for (const g of state.goals || []) {
    const cat = GOAL_CATEGORIES.find(c => c.id === g.category);
    const s = best(scoreText(g.name, q), scoreText(cat?.label, q));
    if (s) results.push({
      type: 'goal', id: g.id, title: g.name || cat?.label || 'Goal',
      subtitle: `Goal · target ${fmt(g.targetAmount || 0, g.currency || 'RWF', { compact: true })}`,
      to: 'goals', score: s + 1,
    });
  }

  for (const cf of state.cashflows || []) {
    const cat = ALL_CF_CATS.find(c => c.id === cf.category);
    const s = best(scoreText(cf.notes, q), scoreText(cat?.label, q));
    if (s) results.push({
      type: 'cashflow', id: cf.id, title: cf.notes || cat?.label || 'Entry',
      subtitle: `${cf.type === 'income' ? 'Income' : 'Expense'} · ${fmt(cf.amount || 0, cf.currency || 'RWF', { compact: true })} · ${cf.date || ''}`,
      to: 'cashflow', score: s,
    });
  }

  for (const item of Object.values(NAV_ITEMS)) {
    const s = scoreText(item.labelDesktop, q);
    if (s) results.push({
      type: 'view', id: `nav-${item.id}`, title: item.labelDesktop,
      subtitle: 'Open view', to: item.id, score: s,
    });
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
