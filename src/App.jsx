import { useState, useEffect, useReducer, useMemo, useRef, lazy, Suspense, Component } from 'react';
import { motion, MotionConfig } from 'motion/react';
import { EASE_OUT } from './components/motion.jsx';
import { FX, valueRWF, costRWF, toBase, fmtBase, MILESTONES } from './data.js';
import { isConfigured, getSession, onAuthStateChange, loadOrCreatePortfolio, savePortfolio, fetchPortfolio, subscribePortfolio, peekInvitation, acceptInvitation } from './cloud.js';
import { loadState as loadLocal, saveState as saveLocal, defaultState } from './store.js';
import { seedHistory } from './services/snapshots.js';
import { reducer } from './reducer.js';
import Sidebar from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import GlobalSearch from './components/GlobalSearch.jsx';
import { NAV_ITEMS } from './nav.js';
import { visibleNavIds } from './features.js';
import { InsightsProvider } from './contexts/InsightsContext.jsx';
import { useMarket } from './contexts/MarketContext.jsx';
import MobileTabBar from './components/MobileTabBar.jsx';
import { useToast, ToastContainer } from './components/Toast.jsx';
import FloatingAdvisor from './components/FloatingAdvisor.jsx';
import { ViewSkeleton } from './components/Skeleton.jsx';
// Always-needed auth/onboarding screens (tiny, no lazy needed)
import Login from './views/Login.jsx';
import Landing from './views/Landing.jsx';
import NamePrompt from './views/NamePrompt.jsx';
import Onboarding from './views/Onboarding.jsx';
import ResetPassword from './views/ResetPassword.jsx';
import { I18nProvider } from './contexts/I18nContext.jsx';
// All views — lazy loaded on first navigation
const DashboardView   = lazy(() => import('./views/Dashboard.jsx'));
const AssetsView      = lazy(() => import('./views/Assets.jsx'));
const AccountsView    = lazy(() => import('./views/Accounts.jsx'));
const TrendsView      = lazy(() => import('./views/Trends.jsx'));
const AdvisorView     = lazy(() => import('./views/Advisor.jsx'));
const SettingsView    = lazy(() => import('./views/Settings.jsx'));
const LiabilitiesView = lazy(() => import('./views/Liabilities.jsx'));
const GoalsView       = lazy(() => import('./views/Goals.jsx'));
const CashFlowView    = lazy(() => import('./views/CashFlow.jsx'));
const TaxReportView   = lazy(() => import('./views/TaxReport.jsx'));
const BalanceSheetView = lazy(() => import('./views/BalanceSheet.jsx'));
const ProjectionsView = lazy(() => import('./views/Projections.jsx'));
const RetirementView  = lazy(() => import('./views/Retirement.jsx'));
const YearReviewView  = lazy(() => import('./views/YearReview.jsx'));
const ReportsView     = lazy(() => import('./views/Reports.jsx'));

// ─ Shared UI primitives ───────────────────────────────────────
function FullScreenLoader({ message = 'Loading…' }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: 'var(--bg)',
      gap: 14,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: '3px solid var(--line)', borderTopColor: 'var(--brand)',
        animation: 'spin 0.7s linear infinite',
      }} />
      <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{message}</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 32, textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
        <div className="font-serif" style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 20, maxWidth: 420, lineHeight: 1.6 }}>
          {this.state.error.message}
        </div>
        <button onClick={() => window.location.reload()} className="btn btn-primary">
          Reload app
        </button>
      </div>
    );
  }
}

// Time-of-day greeting in the user's selected language. Slots: night (catch-all
// for early/late hours), morning, afternoon, evening (post-sunset). Falls back
// to English when the locale is unknown — so an English user never sees
// Kinyarwanda, and vice-versa.
const GREETINGS = {
  en: { night: 'Hello',     morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' },
  fr: { night: 'Bonjour',   morning: 'Bonjour',      afternoon: 'Bon après-midi', evening: 'Bonsoir' },
  rw: { night: 'Muraho',    morning: 'Mwaramutse',   afternoon: 'Mwiriwe',        evening: 'Muramuke' },
};
function greetingFor(locale = 'en') {
  const g = GREETINGS[locale] || GREETINGS.en;
  const h = new Date().getHours();
  if (h < 5)  return g.night;
  if (h < 12) return g.morning;
  if (h < 17) return g.afternoon;
  return g.evening;
}

// ─ Theme management ───────────────────────────────────────────
function getThemePref() {
  return localStorage.getItem('imari:theme') || 'auto';
}
function applyTheme(pref) {
  const resolved = pref === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : pref;
  document.body.setAttribute('data-theme', resolved);
  // Clear the pre-React paint guard from index.html (anti-flash inline bg).
  document.body.style.removeProperty('background');
}

// Strip the invite token from the URL once handled.
function getInviteTokenFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('invite');
}
function clearInviteFromURL() {
  const url = new URL(window.location.href);
  url.searchParams.delete('invite');
  window.history.replaceState({}, '', url.toString());
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading
  // Detect recovery token immediately from URL hash — don't wait for onAuthStateChange
  // which fires after useEffect (too late, causes a Login flash or missed event).
  const [isRecoveryMode, setIsRecoveryMode] = useState(() => {
    const h = window.location.hash;
    return h.includes('type=recovery') || h.includes('type=signup');
  });
  const [pendingInvite, setPendingInvite] = useState(null);
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const [state, dispatch] = useReducer(reducer, null, () => {
    const saved = loadLocal();
    if (saved && saved.fx) Object.assign(FX, saved.fx);
    return saved || defaultState();
  });
  // Derived from NAV_ITEMS so adding a view to nav.js can never silently leave
  // it unroutable (a hand-maintained copy of this list once shipped two dead
  // nav entries — yearreview/reports redirected to dashboard).
  const VALID_VIEWS = new Set(Object.keys(NAV_ITEMS));
  function hashToNav() {
    const h = window.location.hash.replace('#', '');
    return VALID_VIEWS.has(h) ? h : 'dashboard';
  }
  const [nav, setNav] = useState(hashToNav);
  // Pre-auth routing:
  //   ''         → Landing (default for signed-out users)
  //   '#login'   → Login form, Sign-in mode
  //   '#signup'  → Login form, Create-account mode
  //   '#landing' → Force-preview Landing at any time (works even when signed in)
  const readAuthHash = () => {
    const h = window.location.hash;
    if (h === '#login')   return 'login';
    if (h === '#signup')  return 'signup';
    if (h === '#landing') return 'preview';
    return 'landing';
  };
  const [authPage, setAuthPage] = useState(readAuthHash);
  const [portfolioId, setPortfolioId] = useState(null);
  const [role, setRole] = useState('owner');
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  // true once the authoritative state (cloud or confirmed-local) has been loaded.
  // Milestone alerts are gated on this so they never fire before reachedMilestones
  // is populated from the server.
  const [stateReady, setStateReady] = useState(false);
  const prevNetWorthRef = useRef(null); // tracks last known net worth for crossed-threshold detection
  const skipNextSave = useRef(false);
  // Optimistic-concurrency token: the row's updated_at as last seen by THIS
  // tab (from load, realtime, or our own save). Saves are conditional on it,
  // so a tab holding stale state can never overwrite newer cloud data.
  const lastUpdatedAtRef = useRef(null);
  // Saves run strictly one-at-a-time so a save never races its predecessor's
  // token refresh (which would self-conflict).
  const saveQueueRef = useRef(Promise.resolve());

  // ─ Theme ──────────────────────────────────────────────────────
  const [themePref, setThemePref] = useState(getThemePref);
  useEffect(() => {
    // One preference key everywhere (imari:theme; 'auto' → OS preference).
    // The landing toggle writes it directly, so the choice made there carries
    // through #login and into every signed-in page with no flip mid-flow.
    if (session === null) {
      const pref = getThemePref();
      const resolved = pref === 'auto'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : pref;
      document.body.setAttribute('data-theme', resolved);
      document.body.style.removeProperty('background');
      return;
    }
    // Re-adopt anything chosen while signed out — the landing toggle writes
    // localStorage without going through this component's state.
    const stored = getThemePref();
    if (stored !== themePref) { setThemePref(stored); return; }
    applyTheme(themePref);
    if (themePref === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('auto');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [themePref, session, authPage]);

  // Language picked while signed out (landing nav selector) is recorded as
  // pending by onChangeLocale; promote it into the profile once the portfolio
  // loads, so the choice survives sign-in instead of being overridden by an
  // older profile.locale synced from the cloud.
  useEffect(() => {
    if (!session || !stateReady) return;
    try {
      const pending = localStorage.getItem('imari:locale-pending');
      if (!pending) return;
      localStorage.removeItem('imari:locale-pending');
      if (pending !== state.profile.locale) {
        dispatch({ type: 'setProfile', patch: { locale: pending } });
      }
    } catch { /* storage unavailable */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, stateReady]);

  const handleThemeChange = (pref) => {
    localStorage.setItem('imari:theme', pref);
    setThemePref(pref);
  };

  // ─ Toast ──────────────────────────────────────────────────────
  const { toasts, showToast, dismiss } = useToast();
  // Live-FX arrival signal — valuation memos depend on it (see netWorth memo).
  const { fetchedAt: fxFetchedAt } = useMarket();

  // ─ Progressive nav ────────────────────────────────────────────
  // MUST live here, above every conditional return: hooks after an early
  // return crash React with a hooks-order violation the moment the loading/
  // auth branches flip (this exact bug blanked staging once).
  // The current view is always included so a hidden-but-visited feature
  // (deep link, search result) still shows an oriented, active menu item.
  const visibleIds = useMemo(() => {
    const ids = visibleNavIds(state);
    ids.add(nav);
    return ids;
  }, [state, nav]);

  // ─ Hash-based navigation (survives reload & enables back/fwd)
  function navigateTo(view) {
    window.location.hash = view;
    setNav(view);
  }
  useEffect(() => {
    const onHash = () => {
      setNav(hashToNav());
      setAuthPage(readAuthHash());
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // ─ Auth lifecycle ─────────────────────────────────────────
  useEffect(() => {
    if (!isConfigured) {
      setSession(null);
      setStateReady(true); // no cloud — local state is authoritative immediately
      return;
    }
    getSession().then(s => {
      setSession(s);
      // Don't mark stateReady if we're in recovery mode — wait for the recovery session
      if (!s && !window.location.hash.includes('type=recovery')) setStateReady(true);
    });
    const unsub = onAuthStateChange((s, event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
        setSession(s);
        return;
      }
      setSession(s);
      if (!s) { setIsRecoveryMode(false); setStateReady(true); }
    });
    return unsub;
  }, []);

  // ─ Detect invitation token in the URL ─────────────────────
  useEffect(() => {
    const token = getInviteTokenFromURL();
    if (!token) return;
    peekInvitation(token).then(invite => {
      if (!invite) return;
      setPendingInvite({ ...invite, token });
    });
  }, []);

  // ─ Auto-accept invitation after sign-in if one's pending ──
  useEffect(() => {
    if (!session || !pendingInvite || acceptingInvite) return;
    if (session.user?.email?.toLowerCase() !== pendingInvite.email?.toLowerCase()) return;
    setAcceptingInvite(true);
    acceptInvitation(pendingInvite.token)
      .then(() => {
        setPendingInvite(null);
        clearInviteFromURL();
      })
      .catch(e => {
        showToast('Could not accept invitation: ' + e.message, 'error');
        setPendingInvite(null);
        clearInviteFromURL();
      })
      .finally(() => setAcceptingInvite(false));
  }, [session, pendingInvite]);

  // ─ Normalize the URL on successful sign-in ────────────────
  // If the hash is '#login' (or empty) when a session arrives, replace it with
  // '#dashboard' so the address bar matches the view that's about to render.
  useEffect(() => {
    if (!session?.user) return;
    const h = window.location.hash;
    if (h === '' || h === '#' || h === '#login' || h === '#signup' || h === '#landing') {
      window.location.hash = 'dashboard';
    }
  }, [session?.user?.id]);

  // ─ Load portfolio from cloud after login ──────────────────
  // Aborted-flag pattern: if the user signs out (or switches accounts) before
  // loadOrCreatePortfolio resolves, the stale promise must not dispatch the
  // wrong portfolio into state.
  useEffect(() => {
    if (!session?.user) return;
    let aborted = false;
    setLoadingPortfolio(true);
    loadOrCreatePortfolio(session.user)
      .then(({ portfolioId, role, state: cloudState, updatedAt }) => {
        if (aborted) return;
        skipNextSave.current = true;
        lastUpdatedAtRef.current = updatedAt || null;
        if (cloudState.fx) Object.assign(FX, cloudState.fx);
        dispatch({ type: 'replaceAll', state: cloudState });
        setPortfolioId(portfolioId);
        setRole(role);
        setStateReady(true); // cloud state loaded — safe to evaluate milestones now
      })
      .catch(e => {
        if (aborted) return;
        showToast('Failed to load portfolio: ' + e.message, 'error');
      })
      .finally(() => {
        if (!aborted) setLoadingPortfolio(false);
      });
    return () => { aborted = true; };
  }, [session?.user?.id]);

  // Live FX / market data is owned by MarketProvider in main.jsx — it fetches
  // on app mount, primes LIVE_FX so converters use BNR rates, and exposes
  // useMarket() to consumers. App.jsx no longer needs to prime independently.

  // ─ Subscribe to realtime updates ──────────────────────────
  useEffect(() => {
    if (!portfolioId) return;
    return subscribePortfolio(portfolioId, (newRow) => {
      if (!newRow) return;
      skipNextSave.current = true;
      lastUpdatedAtRef.current = newRow.updated_at || lastUpdatedAtRef.current;
      if (newRow.fx) Object.assign(FX, newRow.fx);
      dispatch({ type: 'replaceAll', state: {
        profile:           newRow.profile,
        assets:            newRow.assets            || [],
        liabilities:       newRow.liabilities       || [],
        goals:             newRow.goals             || [],
        cashflows:         newRow.cashflows         || [],
        snapshots:         newRow.snapshots         || [],
        reachedMilestones: newRow.reachedmilestones || [],
        catRules:          newRow.catrules          || [],
        budgets:           newRow.budgets           || {},
        fx:                newRow.fx,
        chat:              newRow.chat,
        insight:           newRow.insight,
      }});
    });
  }, [portfolioId]);

  // ─ Persist on every change (cloud OR local fallback) ──────
  useEffect(() => {
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    if (portfolioId && role !== 'viewer') {
      const t = setTimeout(() => {
        // Serialize: each save waits for the previous one so the concurrency
        // token is always current when this save reads it.
        saveQueueRef.current = saveQueueRef.current.then(async () => {
          const { conflict, updatedAt } = await savePortfolio(portfolioId, state, lastUpdatedAtRef.current);
          if (!conflict) {
            if (updatedAt) lastUpdatedAtRef.current = updatedAt;
            return;
          }
          // Someone newer wrote first (another tab/device). Never overwrite —
          // adopt the authoritative row instead.
          const fresh = await fetchPortfolio(portfolioId);
          if (!fresh) return;
          lastUpdatedAtRef.current = fresh.updatedAt;
          skipNextSave.current = true;
          if (fresh.state.fx) Object.assign(FX, fresh.state.fx);
          dispatch({ type: 'replaceAll', state: fresh.state });
          showToast('Another session saved newer changes — refreshed to the latest data.', 'warning');
        }).catch(e => {
          showToast('Auto-save failed — ' + e.message, 'error');
        });
      }, 350);
      return () => clearTimeout(t);
    }
    saveLocal(state);
  }, [state, portfolioId, role]);

  // ─ Respect router intent from inside views ────────────────
  useEffect(() => {
    if (state._nav) { navigateTo(state._nav); dispatch({ type:'nav', to: null }); }
  }, [state._nav]);

  // ─ Net worth & total cost ─────────────────────────────────
  // fxFetchedAt is a real dependency: setLiveFX mutates module state React
  // can't see, so without it this memo kept pre-fetch conversion rates while
  // views recomputed with live BNR rates — the sidebar and the Goals page
  // showed two different net worths (design review #1).
  const { netWorth, totalCost } = useMemo(() => {
    const today = new Date();
    const gross = state.assets.reduce((s, a) => s + valueRWF(a, today), 0);
    const debt  = (state.liabilities || []).reduce((s, l) => s + toBase(l.remainingAmount || 0, l.currency || 'RWF'), 0);
    return {
      netWorth:  gross - debt,
      totalCost: state.assets.reduce((s, a) => s + costRWF(a), 0),
    };
  }, [state.assets, state.liabilities, fxFetchedAt]);

  // Month-over-month movement for the sidebar chip (#19) — day-to-day
  // volatility in persistent chrome cut the wrong way; MoM is the honest pace.
  const momChange = useMemo(() => {
    const snaps = state.snapshots || [];
    if (snaps.length < 2) return null;
    const target = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const past = [...snaps].sort((a, b) => a.date.localeCompare(b.date)).filter(sn => sn.date <= target).pop();
    if (!past || !Number.isFinite(past.netWorth) || past.netWorth === 0) return null;
    const delta = netWorth - past.netWorth;
    return { delta, pct: (delta / Math.abs(past.netWorth)) * 100 };
  }, [state.snapshots, netWorth]);

  // ─ Daily snapshot ─────────────────────────────────────────
  // Fires when profile name first arrives, then once per calendar day.
  // visibilitychange catches long-running tabs that cross midnight.
  const lastSnapDayRef = useRef(null);
  useEffect(() => {
    if (!state.profile.name) return;
    const snaps = state.snapshots || [];
    const today = new Date().toISOString().slice(0, 10);
    if (lastSnapDayRef.current === today) return;
    const hasToday = snaps.some(s => s.date === today);
    if (hasToday) { lastSnapDayRef.current = today; return; }
    // Seed synthetic history on first run (< 2 snapshots)
    if (snaps.length < 2 && netWorth > 0) {
      const seeded = seedHistory(netWorth, totalCost, 60);
      dispatch({ type: 'seedSnapshots', snapshots: seeded });
    } else if (netWorth > 0) {
      dispatch({ type: 'addSnapshot', netWorth, costBasis: totalCost });
    }
    lastSnapDayRef.current = today;
  }, [state.profile.name, netWorth, totalCost, state.snapshots]);

  // Re-evaluate snapshot when the tab becomes visible (covers cross-midnight cases)
  useEffect(() => {
    const onVis = () => { if (!document.hidden) lastSnapDayRef.current = null; };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // ─ Net-worth milestone alerts ─────────────────────────────
  // Only fires when net worth actually crosses a threshold this session.
  // On first evaluation (prev === null): silently marks already-exceeded
  // milestones as reached so history is clean — no retroactive toasts.
  useEffect(() => {
    if (!stateReady || !state.profile.name || netWorth <= 0) return;
    const thresholds = state.profile.milestones?.length ? state.profile.milestones : MILESTONES;
    const reached = new Set(state.reachedMilestones || []);
    const prev = prevNetWorthRef.current;
    prevNetWorthRef.current = netWorth;

    if (prev === null) {
      // First run after state loads — silently mark anything already exceeded,
      // no toast, so we don't celebrate milestones crossed in a previous session.
      thresholds.forEach(m => {
        if (!reached.has(m) && netWorth >= m) dispatch({ type: 'reachMilestone', value: m });
      });
      return;
    }

    // Subsequent runs — only toast milestones genuinely crossed right now.
    thresholds.forEach(m => {
      if (!reached.has(m) && prev < m && netWorth >= m) {
        showToast(`🎉 Milestone reached: ${fmtBase(m, state.profile.displayCurrency, { compact: true })} net worth!`, 'success');
        dispatch({ type: 'reachMilestone', value: m });
      }
    });
  }, [netWorth, stateReady]);

  // ─ Asset maturity / overdue alerts ────────────────────────
  // Persisted per-asset dedupe key — `${id}|${dateStr}` so the same maturity
  // doesn't re-toast every session, but a *new* maturity date triggers anew.
  const alertedMaturitiesRef = useRef(new Set());
  useEffect(() => {
    if (!stateReady || !state.profile.name) return;
    const today = new Date();
    const WARN_DAYS = 30;
    state.assets.forEach(a => {
      const checkDate = (dateStr, label) => {
        if (!dateStr) return;
        const key = `${a.id}|${dateStr}|${label}`;
        if (alertedMaturitiesRef.current.has(key)) return;
        const d = new Date(dateStr);
        const days = Math.ceil((d - today) / 86400000);
        if (days < 0) {
          showToast(`⚠ "${a.name}" ${label} ${Math.abs(days)} days ago`, 'warning');
          alertedMaturitiesRef.current.add(key);
        } else if (days <= WARN_DAYS) {
          showToast(`⏰ "${a.name}" ${label} in ${days} days`, 'info');
          alertedMaturitiesRef.current.add(key);
        }
      };
      if (a.kind === 'bond')        checkDate(a.maturity, 'matures');
      if (a.kind === 'receivable')  checkDate(a.dueDate,  'was due');
    });
  }, [stateReady, state.profile.name, state.assets]);

  // ─ Render flow ────────────────────────────────────────────
  // session === undefined  → auth check in progress (show spinner, not blank)
  // session === null       → not logged in (show login)
  // stateReady === false   → logged in but portfolio still loading from cloud
  // profile.name empty     → need onboarding name
  // Every render path is wrapped in I18nProvider so the Landing, Login,
  // NamePrompt, Onboarding and Sidebar can all call useT(). Locale persists
  // via dispatch → profile.locale → cloud sync, with localStorage fallback
  // inside the provider for the first render before profile loads.
  const i18nWrap = (children) => (
    <I18nProvider
      profile={state.profile}
      onChangeLocale={loc => {
        // Signed-out picks are marked pending so the post-login profile sync
        // can't silently revert them (see the locale-pending effect above).
        if (!session) {
          try { localStorage.setItem('imari:locale-pending', loc); } catch { /* private mode */ }
        }
        dispatch({ type: 'setProfile', patch: { locale: loc } });
      }}
    >
      {/* reducedMotion="user": every motion/react animation in the tree
          automatically respects the OS prefers-reduced-motion setting. */}
      <MotionConfig reducedMotion="user">
        {children}
      </MotionConfig>
    </I18nProvider>
  );

  if (session === undefined) return i18nWrap(<FullScreenLoader message="Checking session…" />);
  if (isRecoveryMode) return i18nWrap(<ResetPassword session={session} onDone={() => { setIsRecoveryMode(false); }} />);

  // Force-preview the landing at any time via #landing (signed in or not).
  if (authPage === 'preview') {
    return i18nWrap(<Landing onSignIn={() => { window.location.hash = session ? 'dashboard' : 'login'; }} />);
  }

  if (isConfigured && !session) {
    if (pendingInvite || authPage === 'login' || authPage === 'signup') {
      return i18nWrap(<Login pendingInvite={pendingInvite} initialMode={authPage === 'signup' ? 'signup' : 'signin'} />);
    }
    return i18nWrap(<Landing onSignIn={() => setAuthPage('login')} />);
  }
  if (!stateReady) return i18nWrap(<FullScreenLoader message="Loading your portfolio…" />);

  // Wrap dispatch in a read-only guard for viewers — declared early so the
  // Onboarding gate below can use it.
  const guardedDispatch = (action) => {
    const writeActions = new Set([
      'upsertAsset','deleteAsset','bulkDeleteAssets','clearAssets','reset',
      'setFx','replaceAll','setProfile',
      'upsertLiability','deleteLiability',
      'upsertGoal','deleteGoal',
      'upsertCashflow','deleteCashflow',
      'upsertCatRule','deleteCatRule','setBudget',
      'addSnapshot','seedSnapshots',
      'reachMilestone','appendChat','clearChat','setInsight',
    ]);
    if (role === 'viewer' && writeActions.has(action.type)) {
      showToast('You have view-only access to this portfolio.', 'warning');
      return;
    }
    dispatch(action);
  };

  if (!state.profile.name) {
    return i18nWrap(<NamePrompt onSubmit={name => dispatch({ type:'setProfile', patch: { name } })} />);
  }

  // First-run onboarding wizard — shows when the user has a name but zero
  // assets and hasn't explicitly dismissed it. Sets profile.onboardedAt when
  // "I'll add more later" or "Load sample" runs, so it never re-fires.
  if (state.assets.length === 0 && !state.profile.onboardedAt && role !== 'viewer') {
    return i18nWrap(
      <Onboarding
        profile={state.profile}
        dispatch={guardedDispatch}
        showToast={showToast}
        onComplete={() => guardedDispatch({ type: 'setProfile', patch: { onboardedAt: new Date().toISOString() } })}
      />
    );
  }

  const accountCount = state.assets.filter(a => a.kind === 'savings' || a.kind === 'momo-cash').length;
  // Active language for the time-of-day greeting: synced profile locale first,
  // then the localStorage mirror the I18nProvider uses, else English.
  const activeLocale = state.profile.locale
    || (typeof localStorage !== 'undefined' && localStorage.getItem('imari:locale'))
    || 'en';
  const titles = {
    dashboard:   { title: `${greetingFor(activeLocale)}, ${state.profile.name.split(' ')[0]}.`, subtitle: `Today · ${new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })}` },
    accounts:    { title: 'Accounts', subtitle: `${accountCount} bank / mobile money` },
    assets:      { title: 'Your assets', subtitle: `${state.assets.length} positions tracked` },
    trends:      { title: 'Markets & trends', subtitle: 'Domains you watch' },
    advisor:     { title: 'AI Advisor', subtitle: 'Grounded in your portfolio' },
    settings:    { title: 'Settings', subtitle: 'Profile · FX · members · backup' },
    liabilities: { title: 'Liabilities', subtitle: `${(state.liabilities||[]).length} debts tracked` },
    goals:       { title: 'Goals', subtitle: `${(state.goals||[]).filter(g=>!g.achieved).length} active goals` },
    cashflow:    { title: 'Cash Flow', subtitle: 'Income · Expenses · Savings rate' },
    tax:         { title: 'Tax Report', subtitle: `${new Date().getFullYear()} · Rwanda RRA estimate` },
    balancesheet:{ title: 'Balance Sheet', subtitle: 'Assets − liabilities = net worth' },
    projections: { title: 'Fast Forward', subtitle: 'Net-worth projection · modeled' },
    retirement:  { title: 'Retirement readiness', subtitle: 'RSSB / Ejo Heza pension projection' },
    yearreview:  { title: 'Year in Review', subtitle: 'Your net worth, month by month' },
    reports:     { title: 'Monthly Report', subtitle: 'Auto-generated from your entries' },
  };

  const view = (() => {
    switch (nav) {
      case 'accounts':    return <AccountsView    state={state} dispatch={guardedDispatch} />;
      case 'assets':      return <AssetsView      state={state} dispatch={guardedDispatch} showToast={showToast} />;
      case 'trends':      return <TrendsView      state={state} dispatch={guardedDispatch} />;
      case 'advisor':     return <AdvisorView     state={state} dispatch={guardedDispatch} />;
      case 'settings':    return <SettingsView    state={state} dispatch={guardedDispatch} session={session} portfolioId={portfolioId} role={role} showToast={showToast} themePref={themePref} onThemeChange={handleThemeChange} onNav={navigateTo} />;
      case 'liabilities': return <LiabilitiesView state={state} dispatch={guardedDispatch} />;
      case 'goals':       return <GoalsView       state={state} dispatch={guardedDispatch} />;
      case 'cashflow':    return <CashFlowView    state={state} dispatch={guardedDispatch} />;
      case 'tax':         return <TaxReportView   state={state} dispatch={guardedDispatch} />;
      case 'balancesheet':return <BalanceSheetView state={state} dispatch={guardedDispatch} />;
      case 'projections': return <ProjectionsView  state={state} dispatch={guardedDispatch} />;
      case 'retirement':  return <RetirementView   state={state} dispatch={guardedDispatch} />;
      case 'yearreview':  return <YearReviewView   state={state} />;
      case 'reports':     return <ReportsView      state={state} />;
      default:            return <DashboardView   state={state} dispatch={(a) => { if (a.type === 'nav') navigateTo(a.to); else guardedDispatch(a); }} netWorth={netWorth} totalCost={totalCost} />;
    }
  })();

  // The Advice Center is a normal content page — it keeps the chrome (search, currency).
  const showTopBar = true;

  return i18nWrap(
    <ErrorBoundary>
      <InsightsProvider state={state} dispatch={guardedDispatch}>
      <a href="#main-content" className="skip-to-main">Skip to main content</a>
      <div className="row" style={{ minHeight:'100vh', alignItems:'stretch' }}>
        <Sidebar
          active={nav} onNav={navigateTo}
          profile={state.profile} netWorth={netWorth} totalCost={totalCost} displayCurrency={state.profile.displayCurrency}
          session={session} role={role} liabilities={state.liabilities || []}
          visibleIds={visibleIds} momChange={momChange}
        />
        <div className="col main-scroll" style={{ flex: 1, minWidth: 0, overflowY: 'auto', height: '100vh' }}>
          {showTopBar && (
            <div data-noprint>
              <TopBar
                title={titles[nav].title}
                subtitle={titles[nav].subtitle}
                profile={state.profile}
                displayCurrency={state.profile.displayCurrency}
                onCurrency={c => guardedDispatch({ type:'setProfile', patch: { displayCurrency: c } })}
                role={role}
                right={<GlobalSearch state={state} onNav={navigateTo} />}
              />
            </div>
          )}
          <motion.main
            id="main-content" key={nav} className="page-view" tabIndex={-1}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT }}
          >
            <Suspense fallback={<ViewSkeleton />}>
              {view}
            </Suspense>
          </motion.main>
        </div>
        <MobileTabBar active={nav} onNav={navigateTo} visibleIds={visibleIds} />
        <div data-noprint><ToastContainer toasts={toasts} dismiss={dismiss} /></div>
        <div data-noprint><FloatingAdvisor state={state} dispatch={guardedDispatch} nav={nav} /></div>
      </div>
      </InsightsProvider>
    </ErrorBoundary>
  );
}

