// portfolio-app.jsx — app shell + reducer + routing.

(function(){
const { useState, useEffect, useReducer, useMemo } = React;
const {
  Sidebar, TopBar, DashboardView, AssetsView, TrendsView, AdvisorView, SettingsView,
  NamePrompt, loadState, saveState, defaultState, valueRWF, CURRENCIES,
} = window;

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
    case 'setFx':
      Object.assign(window.FX, action.fx);
      return { ...state, fx: action.fx };
    case 'appendChat':
      return { ...state, chat: [...state.chat, action.msg] };
    case 'clearChat':
      return { ...state, chat: [] };
    case 'setInsight':
      return { ...state, insight: action.insight };
    case 'replaceAll':
      // Reload window.FX from imported state too
      if (action.state.fx) Object.assign(window.FX, action.state.fx);
      return { ...action.state };
    case 'nav':
      return { ...state, _nav: action.to };
    default:
      return state;
  }
}

function App() {
  const [state, dispatch] = useReducer(reducer, null, () => {
    const saved = loadState();
    if (saved) {
      if (saved.fx) Object.assign(window.FX, saved.fx);
      return saved;
    }
    return defaultState();
  });
  const [nav, setNav] = useState('dashboard');

  // Persist on every change
  useEffect(() => { saveState(state); }, [state]);

  // Respect router intent from inside views (TrendCard "see all" link)
  useEffect(() => {
    if (state._nav) { setNav(state._nav); dispatch({ type:'nav', to: null }); }
  }, [state._nav]);

  const netWorth = useMemo(() => {
    const today = new Date();
    return state.assets.reduce((s, a) => s + valueRWF(a, today), 0);
  }, [state.assets]);

  // Always serve light theme on the portal (dark is in showcase Tweaks)
  useEffect(() => { document.body.setAttribute('data-theme', 'light'); }, []);

  // First-run name prompt
  if (!state.profile.name) {
    return <NamePrompt onSubmit={name => dispatch({ type:'setProfile', patch: { name } })} />;
  }

  const titles = {
    dashboard: { title: `${greetingFor()}, ${state.profile.name.split(' ')[0]}.`, subtitle: `Today · ${new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })}` },
    assets:    { title: 'Your assets', subtitle: `${state.assets.length} positions tracked` },
    trends:    { title: 'Markets & trends', subtitle: 'Domains you watch' },
    advisor:   { title: 'AI Advisor', subtitle: 'Grounded in your portfolio' },
    settings:  { title: 'Settings', subtitle: 'Profile · FX · backup' },
  };

  const view = (() => {
    switch (nav) {
      case 'assets':   return <AssetsView   state={state} dispatch={dispatch} />;
      case 'trends':   return <TrendsView   state={state} dispatch={dispatch} />;
      case 'advisor':  return <AdvisorView  state={state} dispatch={dispatch} />;
      case 'settings': return <SettingsView state={state} dispatch={dispatch} />;
      default:         return <DashboardView state={state} dispatch={(a) => { if (a.type === 'nav') setNav(a.to); else dispatch(a); }} />;
    }
  })();

  // Advisor handles its own header (so the chat fills the viewport).
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
            right={nav === 'dashboard' && (
              <a href="Imari - Rwanda Wealth.html" style={{
                padding:'7px 12px', borderRadius: 999, border:'1px solid var(--line)',
                background:'var(--paper)', fontSize: 11, color:'var(--ink-3)', textDecoration:'none',
              }}>← Showcase</a>
            )}
          />
        )}
        {view}
      </div>
    </div>
  );
}

function greetingFor() {
  const h = new Date().getHours();
  if (h < 5) return 'Mwiriwe';      // Kinyarwanda evening/night
  if (h < 12) return 'Mwaramutse';  // morning
  if (h < 18) return 'Mwiriwe';     // afternoon
  return 'Muraho';
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
})();
