// app.jsx — main canvas that pulls every screen into a Design Canvas with Tweaks.

(function(){
const { useState, useEffect, useMemo } = React;
const {
  // canvas
  DesignCanvas, DCSection, DCArtboard,
  // ios frame
  IOSDevice,
  // tweaks
  TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakToggle, TweakColor, TweakSelect,
  // mobile screens
  OnboardingScreen, HomeScreen, BudgetScreen,
  WealthScreen, GoalsScreen, TransactionsScreen,
  AdvisorScreen, InsightsScreen, TaxScreen,
  // desktop screens
  DesktopOverview, DesktopWealth, DesktopAdvisorTax,
  // util
  COUNTRIES,
} = window;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "country": "RW",
  "dataState": "typical",
  "theme": "light"
}/*EDITMODE-END*/;

// Wraps any mobile screen in an iOS device frame.
function Phone({ children }) {
  return (
    <IOSDevice width={402} height={874}>
      {children}
    </IOSDevice>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const country = t.country;
  const state   = t.dataState;

  // Sync theme to <body data-theme>
  useEffect(() => {
    document.body.setAttribute('data-theme', t.theme || 'light');
  }, [t.theme]);

  const handleCountryClick = () => {
    const order = ['RW', 'KE', 'UG', 'US'];
    const next = order[(order.indexOf(country) + 1) % order.length];
    setTweak('country', next);
  };

  const screenProps = { country, state, onCountryClick: handleCountryClick };

  return (
    <>
      {/* Pinned floating CTA to the personal portal — small, top-left, never intrusive */}
      <a href="Imari Portfolio.html" style={{
        position:'fixed', top: 16, left: 16, zIndex: 2147483640,
        display:'flex', alignItems:'center', gap: 10,
        padding: '10px 14px', borderRadius: 999,
        background: 'var(--brand)', color: 'var(--brand-ink)',
        boxShadow: '0 8px 24px rgba(15,79,63,0.25)',
        textDecoration:'none', fontSize: 12, fontWeight: 500,
        fontFamily: 'Geist, system-ui, sans-serif',
      }}>
        <span style={{ fontFamily:'Instrument Serif, serif', fontSize: 16 }}>●</span>
        Open my personal portal →
      </a>

      <DesignCanvas>

        {/* ─────────── BRAND & SYSTEM ─────────── */}
        <DCSection id="brand" title="Imari — wealth + budget + advisor" subtitle={`A Rwanda-grounded fintech · ${COUNTRIES[country].name} (${COUNTRIES[country].currency.code}) · ${state} data · Personal portal at /Imari Portfolio.html`}>
          <DCArtboard id="brand-card" label="Brand · type · palette · country" width={1100} height={620}>
            <BrandCard country={country} />
          </DCArtboard>
        </DCSection>

        {/* ─────────── DESKTOP ─────────── */}
        <DCSection id="desktop" title="Desktop" subtitle="1440 × 900 — primary workspace for affluent & HNW users">
          <DCArtboard id="desktop-overview" label="Overview · home" width={1440} height={900}>
            <DesktopOverview {...screenProps} />
          </DCArtboard>
          <DCArtboard id="desktop-wealth" label="Wealth · investments" width={1440} height={900}>
            <DesktopWealth {...screenProps} />
          </DCArtboard>
          <DCArtboard id="desktop-advisor" label="Advisor + Tax & Rules" width={1440} height={900}>
            <DesktopAdvisorTax {...screenProps} />
          </DCArtboard>
        </DCSection>

        {/* ─────────── MOBILE — CORE ─────────── */}
        <DCSection id="mobile-core" title="Mobile · core" subtitle="The screens 90% of users live in">
          <DCArtboard id="m-onboard" label="Onboarding · 3 steps" width={402} height={874}>
            <Phone><OnboardingScreen {...screenProps} /></Phone>
          </DCArtboard>
          <DCArtboard id="m-home" label="Home" width={402} height={874}>
            <Phone><HomeScreen {...screenProps} /></Phone>
          </DCArtboard>
          <DCArtboard id="m-budget" label="Budget" width={402} height={874}>
            <Phone><BudgetScreen {...screenProps} /></Phone>
          </DCArtboard>
          <DCArtboard id="m-wealth" label="Wealth · portfolio" width={402} height={874}>
            <Phone><WealthScreen {...screenProps} /></Phone>
          </DCArtboard>
          <DCArtboard id="m-txn" label="Transactions" width={402} height={874}>
            <Phone><TransactionsScreen {...screenProps} /></Phone>
          </DCArtboard>
        </DCSection>

        {/* ─────────── MOBILE — ADVISORY & RULES ─────────── */}
        <DCSection id="mobile-advisor" title="Mobile · advisor & country" subtitle="AI robo-advisor + per-country tax/regulator surface">
          <DCArtboard id="m-advisor" label="AI Advisor · chat" width={402} height={874}>
            <Phone><AdvisorScreen {...screenProps} /></Phone>
          </DCArtboard>
          <DCArtboard id="m-insights" label="Insights · health score" width={402} height={874}>
            <Phone><InsightsScreen {...screenProps} /></Phone>
          </DCArtboard>
          <DCArtboard id="m-goals" label="Goals" width={402} height={874}>
            <Phone><GoalsScreen {...screenProps} /></Phone>
          </DCArtboard>
          <DCArtboard id="m-tax" label="Tax · regulators · country" width={402} height={874}>
            <Phone><TaxScreen {...screenProps} /></Phone>
          </DCArtboard>
        </DCSection>

      </DesignCanvas>

      {/* Tweaks panel */}
      <TweaksPanel>
        <TweakSection label="Country" />
        <TweakSelect label="Country" value={country}
          options={[
            { value: 'RW', label: '🇷🇼  Rwanda · RWF' },
            { value: 'KE', label: '🇰🇪  Kenya · KES' },
            { value: 'UG', label: '🇺🇬  Uganda · UGX' },
            { value: 'US', label: '🇺🇸  USA · USD' },
          ]}
          onChange={v => setTweak('country', v)} />

        <TweakSection label="Data" />
        <TweakRadio label="State" value={state}
          options={['empty','typical','wealthy']}
          onChange={v => setTweak('dataState', v)} />

        <TweakSection label="Theme" />
        <TweakRadio label="Mode" value={t.theme}
          options={['light','dark']}
          onChange={v => setTweak('theme', v)} />
      </TweaksPanel>
    </>
  );
}

// ─── Brand card (system reference) ──────────────────────────────
function BrandCard({ country }) {
  const c = COUNTRIES[country];
  return (
    <div className="col" style={{ width: '100%', height: '100%', background:'var(--bg)', padding: 36, gap: 22, overflow:'hidden' }}>
      {/* Header */}
      <div className="row" style={{ justifyContent:'space-between', alignItems:'flex-end' }}>
        <div>
          <div className="row" style={{ gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 11, background:'var(--brand)', color:'var(--brand-ink)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:'Instrument Serif, serif', fontSize: 28,
            }}>●</div>
            <div className="font-serif" style={{ fontSize: 44, lineHeight: 1, letterSpacing:'-0.02em' }}>Imari</div>
          </div>
          <div className="muted" style={{ fontSize: 13, maxWidth: 480, lineHeight: 1.5 }}>
            A budget, wealth & advisory app grounded in {c.name} — currency, regulator, tax authority and mobile-money rails are surfaced wherever they apply.
          </div>
        </div>
        <div className="col" style={{ gap: 6, textAlign:'right' }}>
          <div className="row" style={{ gap: 6, justifyContent:'flex-end' }}>
            <span style={{ fontSize: 26 }}>{c.flag}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</div>
              <div className="muted" style={{ fontSize: 11 }}>{c.capital} · {c.currency.code}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: palette / type / system */}
      <div style={{ display:'grid', gridTemplateColumns:'1.1fr 1.4fr 1fr', gap: 22, flex: 1 }}>
        {/* Palette */}
        <div className="card" style={{ padding: 22 }}>
          <div className="muted" style={{ fontSize: 10, letterSpacing:'0.1em', textTransform:'uppercase', fontWeight: 600 }}>01 Palette</div>
          <div className="font-serif" style={{ fontSize: 22, marginTop: 4, marginBottom: 16 }}>Land of a thousand hills</div>
          <div className="col" style={{ gap: 10 }}>
            {[
              ['Emerald', 'var(--brand)', 'Primary · trust'],
              ['Gold',    'var(--gold)',  'Accent · growth'],
              ['Up',      'var(--up)',    'Positive · gain'],
              ['Down',    'var(--down)',  'Negative · loss'],
              ['Sky',     'var(--sky)',   'Secondary'],
              ['Plum',    'var(--plum)',  'Categorical'],
              ['Cream',   'var(--bg)',    'Paper · base'],
              ['Ink',     'var(--ink)',   'Text'],
            ].map(([label, c, sub]) => (
              <div key={label} className="row" style={{ gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: c, border: '0.5px solid var(--line)' }}/>
                <div className="col" style={{ gap: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{label}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Typography + system */}
        <div className="card" style={{ padding: 22 }}>
          <div className="muted" style={{ fontSize: 10, letterSpacing:'0.1em', textTransform:'uppercase', fontWeight: 600 }}>02 Typography</div>
          <div style={{ marginTop: 10 }}>
            <div className="font-serif" style={{ fontSize: 56, lineHeight: 1, letterSpacing:'-0.02em' }}>
              Umutungo wawe<sub style={{ fontSize: 14, marginLeft: 8, color:'var(--ink-3)' }}>aa</sub>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Instrument Serif · headlines & monetary values</div>
          </div>
          <div className="hr" style={{ margin: '16px 0' }}/>
          <div>
            <div style={{ fontSize: 18, fontWeight: 500 }}>The quick brown fox · Geist Sans</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>UI · labels · paragraphs</div>
          </div>
          <div className="hr" style={{ margin: '16px 0' }}/>
          <div>
            <div className="num" style={{ fontSize: 30, fontWeight: 500 }}>
              {c.currency.symbol}{(2_481_320).toLocaleString()}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Geist Mono · all numeric values, tabular</div>
          </div>
          <div className="hr" style={{ margin: '16px 0' }}/>
          <div className="row" style={{ gap: 12, flexWrap:'wrap' }}>
            <span className="pill pill-up">▲ +2.4%</span>
            <span className="pill pill-down">▼ -1.1%</span>
            <span className="pill pill-brand">✦ Imari insight</span>
            <span className="pill pill-gold">◆ Opportunity</span>
            <span className="pill pill-soft">3 active</span>
          </div>
        </div>

        {/* Country context */}
        <div className="card" style={{ padding: 22 }}>
          <div className="muted" style={{ fontSize: 10, letterSpacing:'0.1em', textTransform:'uppercase', fontWeight: 600 }}>03 {c.name}</div>
          <div className="font-serif" style={{ fontSize: 22, marginTop: 4 }}>Local rails</div>

          <Row label="Greeting" v={`"${c.greeting}"`}/>
          <Row label="Languages" v={c.languages.join(' · ')}/>
          <Row label="Currency" v={`${c.currency.code} · ${c.currency.symbol}`}/>
          <Row label="Regulator" v={c.regulator.short}/>
          <Row label="Markets" v={c.markets.short}/>
          <Row label="Tax" v={c.tax.short}/>
          <Row label="Pension" v={c.pension.short}/>
          <Row label="Exchange" v={c.exchange.short}/>
          <Row label="Mobile money" v={c.mobileMoney.join(' · ')}/>

          <div className="hr" style={{ margin: '14px 0 10px' }}/>
          <div className="muted" style={{ fontSize: 11, lineHeight: 1.5 }}>
            "{c.advisorContext}" — the Imari Advisor surfaces country-specific context in every recommendation.
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, v }) {
  return (
    <div className="row" style={{ justifyContent:'space-between', padding: '6px 0', borderBottom: '0.5px solid var(--line-soft)', fontSize: 12 }}>
      <span className="muted">{label}</span>
      <span style={{ fontWeight: 500 }}>{v}</span>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
})();
