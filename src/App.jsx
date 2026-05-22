import { useState, useEffect, useReducer, useMemo, useRef } from 'react';
import { FX, valueRWF, costRWF } from './data.js';
import { isConfigured, getSession, onAuthStateChange, loadOrCreatePortfolio, savePortfolio, subscribePortfolio, peekInvitation, acceptInvitation } from './cloud.js';
import { loadState as loadLocal, saveState as saveLocal, defaultState } from './store.js';
import Sidebar from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import MobileTabBar from './components/MobileTabBar.jsx';
import { useToast, ToastContainer } from './components/Toast.jsx';
import DashboardView from './views/Dashboard.jsx';
import AssetsView from './views/Assets.jsx';
import AccountsView from './views/Accounts.jsx';
import TrendsView from './views/Trends.jsx';
import AdvisorView from './views/Advisor.jsx';
import SettingsView from './views/Settings.jsx';
import NamePrompt from './views/NamePrompt.jsx';
import Login from './views/Login.jsx';

function reducer(state, action) {
  switch (action.type) {
    case 'setProfile':
      return { ...state, profile: { ...state.profile, ...action.patch } };
    case 'upsertAsset': {
      const existing = state.assets.findIndex(a => a.id === action.asset.id);
      const assets = existing >= 0
        ? state.assets.map(a => a.id === action.asset.id ? action.asset : a)
        : [...state.assets, action.asset];
      return { ...state, assets };
    }
    case 'deleteAsset':
      return { ...state, assets: state.assets.filter(a => a.id !== action.id) };
    case 'bulkDeleteAssets':
      return { ...state, assets: state.assets.filter(a => !action.ids.has(a.id)) };
    case 'clearAssets':
      return { ...state, assets: [] };
    case 'reset':
      return { ...defaultState(), profile: state.profile };
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
  const VALID_VIEWS = new Set(['dashboard','accounts','assets','trends','advisor','settings']);
  function hashToNav() {
    const h = window.location.hash.replace('#', '');
    return VALID_VIEWS.has(h) ? h : 'dashboard';
  }
  const [nav, setNav] = useState(hashToNav);
  const [portfolioId, setPortfolioId] = useState(null);
  const [role, setRole] = useState('owner');
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
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
      return;
    }
    getSession().then(setSession);
    const unsub = onAuthStateChange(setSession);
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
    return {
      netWorth:  state.assets.reduce((s, a) => s + valueRWF(a, today), 0),
      totalCost: state.assets.reduce((s, a) => s + costRWF(a), 0),
    };
  }, [state.assets]);

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
    dashboard: { title: `${greetingFor()}, ${state.profile.name.split(' ')[0]}.`, subtitle: `Today · ${new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })}` },
    accounts:  { title: 'Accounts', subtitle: `${accountCount} bank / mobile money` },
    assets:    { title: 'Your assets', subtitle: `${state.assets.length} positions tracked` },
    trends:    { title: 'Markets & trends', subtitle: 'Domains you watch' },
    advisor:   { title: 'AI Advisor', subtitle: 'Grounded in your portfolio' },
    settings:  { title: 'Settings', subtitle: 'Profile · FX · members · backup' },
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
      case 'accounts': return <AccountsView state={state} dispatch={guardedDispatch} />;
      case 'assets':   return <AssetsView   state={state} dispatch={guardedDispatch} showToast={showToast} />;
      case 'trends':   return <TrendsView   state={state} dispatch={guardedDispatch} />;
      case 'advisor':  return <AdvisorView  state={state} dispatch={guardedDispatch} />;
      case 'settings': return <SettingsView state={state} dispatch={guardedDispatch} session={session} portfolioId={portfolioId} role={role} showToast={showToast} themePref={themePref} onThemeChange={handleThemeChange} />;
      default:         return <DashboardView state={state} dispatch={(a) => { if (a.type === 'nav') navigateTo(a.to); else guardedDispatch(a); }} />;
    }
  })();

  const showTopBar = nav !== 'advisor';

  return (
    <div className="row" style={{ minHeight:'100vh', alignItems:'stretch' }}>
      <Sidebar
        active={nav} onNav={navigateTo}
        profile={state.profile} netWorth={netWorth} totalCost={totalCost} displayCurrency={state.profile.displayCurrency}
        session={session} role={role}
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
          {view}
        </div>
      </div>
      <MobileTabBar active={nav} onNav={navigateTo} />
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
