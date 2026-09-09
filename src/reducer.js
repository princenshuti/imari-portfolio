// reducer.js — the portfolio state reducer, extracted from App.jsx so its money
// math is unit-testable in isolation (R1: no untested reducer math in a money app).

import { FX, fromBase, toBase } from './data.js';
import { defaultState } from './store.js';
import { addSnapshot } from './services/snapshots.js';

// ── Input hygiene (single choke point for every write) ───────────────────────
// Strips control characters and caps string lengths on any object the user can
// type into, before it reaches state, localStorage, the cloud or the AI context.
// Data URIs (photos, avatar, attachments) and known long-text fields keep
// generous limits; everything else is a short label.
const LONG_KEYS  = new Set(['notes', 'bio', 'description', 'content', 'pattern']);
const DATA_KEYS  = new Set(['avatar', 'photos', 'documents', 'attachment', 'dataUrl', 'data']);
const MAX_SHORT = 300, MAX_LONG = 4000, MAX_DATA = 4 * 1024 * 1024;
export function scrubText(v, max = MAX_SHORT) {
  return String(v).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').slice(0, max);
}
export function scrub(obj, depth = 0) {
  if (depth > 4 || obj == null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.slice(0, 500).map(x => (typeof x === 'string' ? scrubText(x, MAX_LONG) : scrub(x, depth + 1)));
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    if (typeof v === 'string') {
      if (DATA_KEYS.has(k) || v.startsWith('data:')) out[k] = v.startsWith('data:') ? v.slice(0, MAX_DATA) : scrubText(v, MAX_LONG);
      else out[k] = scrubText(v, LONG_KEYS.has(k) ? MAX_LONG : MAX_SHORT);
    } else if (v && typeof v === 'object') out[k] = scrub(v, depth + 1);
    else out[k] = v;
  }
  return out;
}

export function upsert(arr, item, key = 'id') {
  const i = arr.findIndex(x => x[key] === item[key]);
  return i >= 0 ? arr.map((x, idx) => idx === i ? item : x) : [...arr, item];
}

// Recompute an account's currentValue from its purchasePrice (opening balance)
// plus the net of all one-time cashflows linked to it. Each cashflow amount is
// converted to the account's own currency via the RWF base rate so cross-currency
// entries (e.g. a USD cashflow on an RWF account) are handled correctly.
export function syncAccountBalance(assets, cashflows, accountId) {
  if (!accountId) return assets;
  const account = assets.find(a => a.id === accountId);
  if (!account) return assets;
  const acctCurrency = account.currency || 'RWF';
  const linked = (cashflows || []).filter(
    c => c.accountId === accountId && c.recurring === 'once'
  );
  const delta = linked.reduce((sum, c) => {
    const inAcctCcy = fromBase(toBase(c.amount || 0, c.currency || 'RWF'), acctCurrency);
    return sum + (c.type === 'income' ? inAcctCcy : -inAcctCcy);
  }, 0);
  const base = typeof account.purchasePrice === 'number' ? account.purchasePrice : 0;
  return assets.map(a => a.id !== accountId ? a : { ...a, currentValue: base + delta });
}

export function reducer(state, action) {
  switch (action.type) {
    case 'setProfile':
      return { ...state, profile: { ...state.profile, ...scrub(action.patch) } };

    // ── Assets ──────────────────────────────────────────────────
    case 'upsertAsset': {
      action = { ...action, asset: scrub(action.asset) };
      // Stamp updatedAt on every save — a save is a fresh verification of the
      // value, and the Data-Freshness layer (§11) reads this to know how old
      // net worth's inputs are. Cloud sync uses replaceAll (below), not this,
      // so a passive sync never fakes freshness.
      const stamped = { ...action.asset, updatedAt: new Date().toISOString() };
      const newAssets = upsert(state.assets, stamped);
      const isAccount = stamped.kind === 'savings' || stamped.kind === 'momo-cash';
      if (isAccount) {
        return { ...state, assets: syncAccountBalance(newAssets, state.cashflows || [], stamped.id) };
      }
      return { ...state, assets: newAssets };
    }
    case 'deleteAsset':
      return { ...state, assets: state.assets.filter(a => a.id !== action.id) };
    case 'bulkDeleteAssets':
      return { ...state, assets: state.assets.filter(a => !action.ids.has(a.id)) };
    case 'clearAssets':
      return { ...state, assets: [] };
    case 'reset':
      return { ...defaultState(), profile: state.profile };

    // ── Liabilities ─────────────────────────────────────────────
    case 'upsertLiability':
      return { ...state, liabilities: upsert(state.liabilities || [], scrub(action.liability)) };
    case 'deleteLiability':
      return { ...state, liabilities: (state.liabilities || []).filter(l => l.id !== action.id) };

    // ── Goals ───────────────────────────────────────────────────
    case 'upsertGoal':
      return { ...state, goals: upsert(state.goals || [], scrub(action.goal)) };
    case 'deleteGoal':
      return { ...state, goals: (state.goals || []).filter(g => g.id !== action.id) };

    // ── Cash flows ──────────────────────────────────────────────
    case 'upsertCashflow': {
      action = { ...action, entry: scrub(action.entry) };
      const newCashflows = upsert(state.cashflows || [], action.entry);
      const oldEntry = (state.cashflows || []).find(c => c.id === action.entry.id);
      const toSync = new Set();
      if (action.entry.accountId) toSync.add(action.entry.accountId);
      if (oldEntry?.accountId && oldEntry.accountId !== action.entry.accountId) {
        toSync.add(oldEntry.accountId);
      }
      let newAssets = state.assets;
      toSync.forEach(aid => { newAssets = syncAccountBalance(newAssets, newCashflows, aid); });
      return { ...state, cashflows: newCashflows, assets: newAssets };
    }
    case 'deleteCashflow': {
      const deletedEntry = (state.cashflows || []).find(c => c.id === action.id);
      const newCashflows = (state.cashflows || []).filter(c => c.id !== action.id);
      let newAssets = state.assets;
      if (deletedEntry?.accountId) {
        newAssets = syncAccountBalance(newAssets, newCashflows, deletedEntry.accountId);
      }
      return { ...state, cashflows: newCashflows, assets: newAssets };
    }

    // ── Categorisation rules (F5) ───────────────────────────────
    case 'upsertCatRule':
      return { ...state, catRules: upsert(state.catRules || [], scrub(action.rule)) };
    case 'deleteCatRule':
      return { ...state, catRules: (state.catRules || []).filter(r => r.id !== action.id) };

    // ── Budgets (F6) — monthly RWF limit per expense category ───
    case 'setBudget': {
      const budgets = { ...(state.budgets || {}) };
      if ((action.amount || 0) > 0) budgets[action.category] = action.amount;
      else delete budgets[action.category];
      return { ...state, budgets };
    }

    // ── Snapshots ────────────────────────────────────────────────
    case 'addSnapshot':
      return { ...state, snapshots: addSnapshot(state.snapshots || [], action.netWorth, action.costBasis) };
    case 'seedSnapshots':
      return { ...state, snapshots: action.snapshots };

    // ── FX / Chat / Insight ──────────────────────────────────────
    case 'setFx': {
      Object.assign(FX, action.fx);
      return { ...state, fx: action.fx };
    }
    case 'appendChat': {
      // Cap at 80 messages — prevents unbounded DB growth and keeps AI context lean.
      const MAX_CHAT = 80;
      const next = [...state.chat, action.msg];
      return { ...state, chat: next.length > MAX_CHAT ? next.slice(next.length - MAX_CHAT) : next };
    }
    case 'clearChat':
      return { ...state, chat: [] };
    case 'setInsight':
      return { ...state, insight: action.insight };
    case 'reachMilestone':
      return { ...state, reachedMilestones: [...(state.reachedMilestones || []), action.value] };
    case 'replaceAll':
      if (action.state.fx) Object.assign(FX, action.state.fx);
      return { ...action.state };
    case 'nav':
      return { ...state, _nav: action.to };
    default:
      return state;
  }
}
