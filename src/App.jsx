import { useState, useEffect, useReducer, useMemo, useRef, lazy, Suspense } from 'react';
import { FX, valueRWF, costRWF, toBase, fmtBase, MILESTONES } from './data.js';
import { isConfigured, getSession, onAuthStateChange, loadOrCreatePortfolio, savePortfolio, subscribePortfolio, peekInvitation, acceptInvitation } from './cloud.js';
import { loadState as loadLocal, saveState as saveLocal, defaultState } from './store.js';
import { addSnapshot, seedHistory } from './services/snapshots.js';
import Sidebar from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import MobileTabBar from './components/MobileTabBar.jsx';
import { useToast, ToastContainer } from './components/Toast.jsx';
// Always-needed auth/onboarding screens (tiny, no lazy needed)
import Login from './views/Login.jsx';
import NamePrompt from './views/NamePrompt.jsx';
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

function upsert(arr, item, key = 'id') {
  const i = arr.findIndex(x => x[key] === item[key]);
  return i >= 0 ? arr.map((x, idx) => idx === i ? item : x) : [...arr, item];
}

function reducer(state, action) {
  switch (action.type) {
    case 'setProfile':
      return { ...state, profile: { ...state.profile, ...action.patch } };

    // ── Assets ──────────────────────────────────────────────────
    case 'upsertAsset': {
      return { ...state, assets: upsert(state.assets, action.asset) };
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
    case 'upsertCashflow':
      return { ...state, cashflows: upsert(state.cashflows || [], action.entry) };
    case 'deleteCashflow':
      return { ...state, cashflows: (state.cashflows || []).filter(c => c.id !== action.id) };

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
    case 'appendChat':
      return { ...state, chat: [...state.chat, action.msg] };
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

function greetingFor() {
  const h = new Date().getHours();
  if (h < 5) return 'Mwiriwe';
  if (h < 12) return 'Mwaramutse';
  if (h < 18) return 'Mwiriwe';
  return 'Muraho';
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
  const [pendingInvite, setPendingInvite] = useState(null);
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const [state, dispatch] = useReducer(reducer, null, () => {
    const saved = loadLocal();
    if (saved && saved.fx) Object.assign(FX, saved.fx);
    return saved || defaultState();
  });
  const VALID_VIEWS = new Set(['dashboard','accounts','assets','trends','advisor','settings','liabilities','goals','cashflow','tax']);
  function hashToNav() {
    const h = window.location.hash.replace('#', '');
    return VALID_VIEWS.has(h) ? h : 'dashboard';
  }
  const [nav, setNav] = useState(hashToNav);
  const [portfolioId, setPortfolioId] = useState(null);
  const [role, setRole] = useState('owner');
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  // true once the authoritative state (cloud or confirmed-local) has been loaded.
  // Milestone alerts are gated on this so they never fire before reachedMilestones
  // is populated from the server.
  const [stateReady, setStateReady] = useState(false);
  const prevNetWorthRef = useRef(null); // tracks last known net worth for crossed-threshold detection
  const skipNextSave = useRef(false);

  // ─ Theme ──────────────────────────────────────────────────────
  const [themePref, setThemePref] = useState(getThemePref);
  useEffect(() => {
    applyTheme(themePref);
    if (themePref === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('auto');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [themePref]);

  const handleThemeChange = (pref) => {
    localStorage.setItem('imari:theme', pref);
    setThemePref(pref);
  };

  // ─ Toast ──────────────────────────────────────────────────────
  const { toasts, showToast, dismiss } = useToast();

  // ─ Hash-based navigation (survives reload & enables back/fwd)
  function navigateTo(view) {
    window.location.hash = view;
    setNav(view);
  }
  useEffect(() => {
    const onHash = () => setNav(hashToNav());
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
      if (!s) setStateReady(true); // logged out — local state is authoritative
    });
    const unsub = onAuthStateChange(s => {
      setSession(s);
      if (!s) setStateReady(true);
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

  // ─ Load portfolio from cloud after login ──────────────────
  useEffect(() => {
    if (!session?.user) return;
    setLoadingPortfolio(true);
    loadOrCreatePortfolio(session.user)
      .then(({ portfolioId, role, state: cloudState }) => {
        skipNextSave.current = true;
        if (cloudState.fx) Object.assign(FX, cloudState.fx);
        dispatch({ type: 'replaceAll', state: cloudState });
        setPortfolioId(portfolioId);
        setRole(role);
        setStateReady(true); // cloud state loaded — safe to evaluate milestones now
      })
      .catch(e => {
        showToast('Failed to load portfolio: ' + e.message, 'error');
      })
      .finally(() => setLoadingPortfolio(false));
  }, [session?.user?.id]);

  // ─ Subscribe to realtime updates ──────────────────────────
  useEffect(() => {
    if (!portfolioId) return;
    return subscribePortfolio(portfolioId, (newRow) => {
      if (!newRow) return;
      skipNextSave.current = true;
      if (newRow.fx) Object.assign(FX, newRow.fx);
      dispatch({ type: 'replaceAll', state: {
        profile: newRow.profile, assets: newRow.assets, fx: newRow.fx,
        chat: newRow.chat, insight: newRow.insight,
      }});
    });
  }, [portfolioId]);

  // ─ Persist on every change (cloud OR local fallback) ──────
  useEffect(() => {
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    if (portfolioId && role !== 'viewer') {
      const t = setTimeout(() => {
        savePortfolio(portfolioId, state).catch(e => {
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
  const { netWorth, totalCost } = useMemo(() => {
    const today = new Date();
    const gross = state.assets.reduce((s, a) => s + valueRWF(a, today), 0);
    const debt  = (state.liabilities || []).reduce((s, l) => s + toBase(l.remainingAmount || 0, l.currency || 'RWF'), 0);
    return {
      netWorth:  gross - debt,
      totalCost: state.assets.reduce((s, a) => s + costRWF(a), 0),
    };
  }, [state.assets, state.liabilities]);

  // ─ Daily snapshot ─────────────────────────────────────────
  useEffect(() => {
    if (!state.profile.name) return;
    const snaps = state.snapshots || [];
    const today = new Date().toISOString().slice(0, 10);
    const hasToday = snaps.some(s => s.date === today);
    if (hasToday) return;
    // Seed synthetic history on first run (< 2 snapshots)
    if (snaps.length < 2 && netWorth > 0) {
      const seeded = seedHistory(netWorth, totalCost, 60);
      dispatch({ type: 'seedSnapshots', snapshots: seeded });
    } else {
      dispatch({ type: 'addSnapshot', netWorth, costBasis: totalCost });
    }
  }, [state.profile.name]);

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
  useEffect(() => {
    if (!state.profile.name) return;
    const today = new Date();
    const WARN_DAYS = 30;
    state.assets.forEach(a => {
      const checkDate = (dateStr, label) => {
        if (!dateStr) return;
        const d = new Date(dateStr);
        const days = Math.ceil((d - today) / 86400000);
        if (days < 0) showToast(`⚠ "${a.name}" ${label} ${Math.abs(days)} days ago`, 'warning');
        else if (days <= WARN_DAYS) showToast(`⏰ "${a.name}" ${label} in ${days} days`, 'info');
      };
      if (a.kind === 'bond')        checkDate(a.maturity, 'matures');
      if (a.kind === 'receivable')  checkDate(a.dueDate,  'was due');
    });
  }, [state.profile.name]);

  // ─ Render flow ────────────────────────────────────────────
  if (session === undefined) return null; // still checking
  if (isConfigured && !session) return <Login pendingInvite={pendingInvite} />;
  if (loadingPortfolio) return (
    <div style={{ position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, color:'var(--ink-3)' }}>
      Loading your portfolio…
    </div>
  );

  if (!state.profile.name) {
    return <NamePrompt onSubmit={name => dispatch({ type:'setProfile', patch: { name } })} />;
  }

  const accountCount = state.assets.filter(a => a.kind === 'savings' || a.kind === 'momo-cash').length;
  const titles = {
    dashboard:   { title: `${greetingFor()}, ${state.profile.name.split(' ')[0]}.`, subtitle: `Today · ${new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })}` },
    accounts:    { title: 'Accounts', subtitle: `${accountCount} bank / mobile money` },
    assets:      { title: 'Your assets', subtitle: `${state.assets.length} positions tracked` },
    trends:      { title: 'Markets & trends', subtitle: 'Domains you watch' },
    advisor:     { title: 'AI Advisor', subtitle: 'Grounded in your portfolio' },
    settings:    { title: 'Settings', subtitle: 'Profile · FX · members · backup' },
    liabilities: { title: 'Liabilities', subtitle: `${(state.liabilities||[]).length} debts tracked` },
    goals:       { title: 'Goals', subtitle: `${(state.goals||[]).filter(g=>!g.achieved).length} active goals` },
    cashflow:    { title: 'Cash Flow', subtitle: 'Income · Expenses · Savings rate' },
    tax:         { title: 'Tax Report', subtitle: `${new Date().getFullYear()} · Rwanda RRA estimate` },
  };

  // Wrap dispatch in a read-only guard for viewers
  const guardedDispatch = (action) => {
    const writeActions = new Set(['upsertAsset','deleteAsset','clearAssets','reset','setFx','replaceAll','setProfile']);
    if (role === 'viewer' && writeActions.has(action.type)) {
      showToast('You have view-only access to this portfolio.', 'warning');
      return;
    }
    dispatch(action);
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
      case 'tax':         return <TaxReportView   state={state} />;
      default:            return <DashboardView   state={state} dispatch={(a) => { if (a.type === 'nav') navigateTo(a.to); else guardedDispatch(a); }} />;
    }
  })();

  const showTopBar = nav !== 'advisor';

  return (
    <div className="row" style={{ minHeight:'100vh', alignItems:'stretch' }}>
      <Sidebar
        active={nav} onNav={navigateTo}
        profile={state.profile} netWorth={netWorth} totalCost={totalCost} displayCurrency={state.profile.displayCurrency}
        session={session} role={role} liabilities={state.liabilities || []}
      />
      <div className="col main-scroll" style={{ flex: 1, minWidth: 0, overflowY: 'auto', height: '100vh' }}>
        {showTopBar && (
          <TopBar
            title={titles[nav].title}
            subtitle={titles[nav].subtitle}
            profile={state.profile}
            displayCurrency={state.profile.displayCurrency}
            onCurrency={c => guardedDispatch({ type:'setProfile', patch: { displayCurrency: c } })}
            role={role}
          />
        )}
        <div key={nav} className="page-view">
          <Suspense fallback={
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300, color:'var(--ink-3)', fontSize:13 }}>
              Loading…
            </div>
          }>
            {view}
          </Suspense>
        </div>
      </div>
      <MobileTabBar active={nav} onNav={navigateTo} />
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
