/**
 * InsightsContext — ONE insight-engine run per state change, shared by every
 * consumer (sidebar badge, Dashboard pinned cost, Advice Center, floating
 * advisor's AI context). Before this, each consumer ran the 16-rule engine
 * independently (3–4 executions per dispatch) and only the Dashboard honored
 * dismissals — the badge counted insights the user had just dismissed.
 *
 * Dismissals are first-class state: profile.dismissedInsights maps a stable
 * insight id → dismissedAt ISO, syncs through the existing profile column,
 * and expires after 7 days (engine/insights/_shared.js activeDismissals) —
 * "stop nagging me" must never become permanent blindness.
 */
import { createContext, useContext, useMemo, useCallback } from 'react';
import { runInsights } from '../engine/insights/index.js';
import { activeDismissals } from '../engine/insights/_shared.js';

const InsightsContext = createContext(null);

export function InsightsProvider({ state, dispatch, family = null, children }) {
  const dismissed = useMemo(() => activeDismissals(state.profile), [state.profile]);

  const engine = useMemo(() => {
    try {
      return runInsights(state, { dismissed, limit: 16, family });
    } catch (e) {
      if (import.meta.env.DEV) console.warn('insight engine failed', e);
      return { insights: [], topCost: null };
    }
  }, [state, dismissed, family]);

  const dismiss = useCallback((id) => {
    const cur = state.profile?.dismissedInsights || {};
    dispatch({ type: 'setProfile', patch: { dismissedInsights: { ...cur, [id]: new Date().toISOString() } } });
  }, [state.profile, dispatch]);

  const value = useMemo(() => {
    const recommendations = engine.insights.filter(i => i.costOfAbsence && !i.dismissed);
    return { ...engine, recommendations, count: recommendations.length, dismiss };
  }, [engine, dismiss]);

  return <InsightsContext.Provider value={value}>{children}</InsightsContext.Provider>;
}

const EMPTY = { insights: [], topCost: null, recommendations: [], count: 0, dismiss: () => {} };

export function useInsights() {
  return useContext(InsightsContext) || EMPTY;
}
