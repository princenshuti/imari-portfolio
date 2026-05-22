import { useState, useEffect, useReducer, useMemo } from 'react';
import { FX, valueRWF } from './data.js';
import { loadState, saveState, defaultState } from './store.js';
import Sidebar from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import DashboardView from './views/Dashboard.jsx';
import AssetsView from './views/Assets.jsx';
import AccountsView from './views/Accounts.jsx';
import TrendsView from './views/Trends.jsx';
import AdvisorView from './views/Advisor.jsx';
import SettingsView from './views/Settings.jsx';
import NamePrompt from './views/NamePrompt.jsx';

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

export default function App() {
  const [state, dispatch] = useReducer(reducer, null, () => {
    const saved = loadState();
    if (saved) {
      if (saved.fx) Object.assign(FX, saved.fx);
      return saved;
    }
    return defaultState();
  });
  const [nav, setNav] = useState('dashboard');

  useEffect(() => { saveState(state); }, [state]);

  useEffect(() => {
    if (state._nav) { setNav(state._nav); dispatch({ type:'nav', to: null }); }
  }, [state._nav]);

  const netWorth = useMemo(() => {
    const today = new Date();
    return state.assets.reduce((s, a) => s + valueRWF(a, today), 0);
  }, [state.assets]);

  useEffect(() => { document.body.setAttribute('data-theme', 'light'); }, []);

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
    settings:  { title: 'Settings', subtitle: 'Profile · FX · backup' },
  };

  const view = (() => {
    switch (nav) {
      case 'accounts': return <AccountsView state={state} dispatch={dispatch} />;
      case 'assets':   return <AssetsView   state={state} dispatch={dispatch} />;
      case 'trends':   return <TrendsView   state={state} dispatch={dispatch} />;
      case 'advisor':  return <AdvisorView  state={state} dispatch={dispatch} />;
      case 'settings': return <SettingsView state={state} dispatch={dispatch} />;
      default:         return <DashboardView state={state} dispatch={(a) => { if (a.type === 'nav') setNav(a.to); else dispatch(a); }} />;
    }
  })();

  const showTopBar = nav !== 'advisor';

  return (
    <div className="row" style={{ minHeight:'100vh', alignItems:'stretch' }}>
      <Sidebar active={nav} onNav={setNav}
        profile={state.profile} netWorth={netWorth} displayCurrency={state.profile.displayCurrency} />
      <div className="col" style={{ flex: 1, minWidth: 0 }}>
        {showTopBar && (
          <TopBar
            title={titles[nav].title}
            subtitle={titles[nav].subtitle}
            profile={state.profile}
            displayCurrency={state.profile.displayCurrency}
            onCurrency={c => dispatch({ type:'setProfile', patch: { displayCurrency: c } })}
          />
        )}
        {view}
      </div>
    </div>
  );
}
