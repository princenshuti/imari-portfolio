// reducer.js — the portfolio state reducer, extracted from App.jsx so its money
// math is unit-testable in isolation (R1: no untested reducer math in a money app).

import { FX, fromBase, toBase } from './data.js';
import { defaultState } from './store.js';
import { addSnapshot } from './services/snapshots.js';

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
      return { ...state, profile: { ...state.profile, ...action.patch } };

    // ── Assets ──────────────────────────────────────────────────
    case 'upsertAsset': {
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
      return { ...state, liabilities: upsert(state.liabilities || [], action.liability) };
    case 'deleteLiability':
      return { ...state, liabilities: (state.liabilities || []).filter(l => l.id !== action.id) };

    // ── Goals ───────────────────────────────────────────────────
    case 'upsertGoal':
      return { ...state, goals: upsert(state.goals || [], action.goal) };
    case 'deleteGoal':
      return { ...state, goals: (state.goals || []).filter(g => g.id !== action.id) };

    // ── Cash flows ──────────────────────────────────────────────
    case 'upsertCashflow': {
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
