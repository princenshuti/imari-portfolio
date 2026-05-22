// desktop.jsx — desktop dashboards. 1440×900 each.

(function(){
const { Sparkline, AreaChart, Donut, CatGlyph, CAT_COLOR, CAT_GLYPH,
        Avatar, CountryChip, SectionHead, genSeries, RingProgress } = window;
const { COUNTRIES, DATASETS, fmtMoney, fmtPct } = window;

// ─── Sidebar (shared) ─────────────────────────────────────────
function DesktopSidebar({ active = 'home', country }) {
  const c = COUNTRIES[country];
  const items = [
    { id:'home',         label:'Overview',     glyph:'◐' },
    { id:'budget',       label:'Budget',       glyph:'▢' },
    { id:'wealth',       label:'Wealth',       glyph:'◆' },
    { id:'transactions', label:'Transactions', glyph:'≡' },
    { id:'goals',        label:'Goals',        glyph:'⊛' },
    { id:'advisor',      label:'Advisor',      glyph:'✦' },
    { id:'tax',          label:'Tax & rules',  glyph:'§' },
  ];
  return (
    <div className="col" style={{
      width: 232, padding: '22px 16px', background:'var(--paper)',
      borderRight: '0.5px solid var(--line)', gap: 22, flexShrink: 0,
    }}>
      {/* Logo */}
      <div className="row" style={{ gap: 10, padding: '0 6px' }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, background: 'var(--brand)', color: 'var(--brand-ink)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontFamily:'Instrument Serif, serif', fontSize: 18,
        }}>●</div>
        <div>
          <div className="font-serif" style={{ fontSize: 18, lineHeight: 1 }}>Imari</div>
          <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>{c.name}</div>
        </div>
      </div>

      {/* Search */}
      <div className="row" style={{ padding: '7px 10px', borderRadius: 8, background:'var(--bg-2)', gap: 8 }}>
        <span className="muted">⌕</span>
        <span className="muted" style={{ fontSize: 12 }}>Search…</span>
        <span className="muted" style={{ marginLeft:'auto', fontSize: 10, padding: '1px 5px', border:'0.5px solid var(--line)', borderRadius: 4 }}>⌘K</span>
      </div>

      {/* Nav */}
      <div className="col" style={{ gap: 1 }}>
        <div className="muted" style={{ fontSize: 10, letterSpacing:'0.08em', textTransform:'uppercase', padding: '6px 10px' }}>Money</div>
        {items.map(it => (
          <div key={it.id} className="row" style={{
            padding: '8px 10px', borderRadius: 8, gap: 10,
            background: it.id === active ? 'var(--brand-soft)' : 'transparent',
            color: it.id === active ? 'var(--brand)' : 'var(--ink-2)',
            fontSize: 13, fontWeight: it.id === active ? 500 : 400,
          }}>
            <span style={{ width: 16, textAlign:'center' }}>{it.glyph}</span>
            <span>{it.label}</span>
          </div>
        ))}
      </div>

      {/* Country block */}
      <div className="col" style={{ marginTop: 'auto', padding: 12, borderRadius: 10, background:'var(--bg-2)', gap: 8 }}>
        <div className="row" style={{ justifyContent:'space-between' }}>
          <span style={{ fontSize: 20 }}>{c.flag}</span>
          <span className="muted" style={{ fontSize: 10 }}>switch ⇅</span>
        </div>
        <div style={{ fontSize: 12, fontWeight: 500 }}>{c.name}</div>
        <div className="muted" style={{ fontSize: 11, lineHeight: 1.4 }}>
          {c.currency.code} · {c.regulator.short} · {c.tax.short}
        </div>
      </div>
    </div>
  );
}

// ─── Top bar (shared) ─────────────────────────────────────────
function DesktopTopBar({ country, name, title, subtitle, onCountryClick }) {
  const c = COUNTRIES[country];
  return (
    <div className="row" style={{
      padding: '18px 32px', justifyContent:'space-between',
      borderBottom: '0.5px solid var(--line)', background: 'var(--paper)',
    }}>
      <div>
        <div className="muted" style={{ fontSize: 11, letterSpacing:'0.06em', textTransform:'uppercase' }}>{subtitle || `${c.flag} ${c.name} · ${c.currency.code}`}</div>
        <div className="font-serif" style={{ fontSize: 28, lineHeight: 1.1, marginTop: 2 }}>{title}</div>
      </div>
      <div className="row" style={{ gap: 12 }}>
        <CountryChip country={country} onClick={onCountryClick} />
        <div className="row" style={{ gap: 6, padding: '6px 10px', borderRadius: 999, border: '1px solid var(--line)', background:'var(--paper)' }}>
          <span style={{ width:6, height:6, borderRadius:999, background:'var(--up)' }}/>
          <span style={{ fontSize: 11 }} className="muted">Synced 2m ago</span>
        </div>
        <Avatar name={name} size={36} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  DESKTOP OVERVIEW
// ═══════════════════════════════════════════════════════════════
function DesktopOverview({ country = 'RW', state = 'typical', onCountryClick }) {
  const data = DATASETS[country][state];
  const c = COUNTRIES[country];
  const trend = genSeries(120, data.networth * 0.85, 0.18, 0.022, 13);
  trend.push(data.networth);

  return (
    <div className="row" style={{ width: '100%', height: 900, background: 'var(--bg)' }}>
      <DesktopSidebar active="home" country={country} />
      <div className="col" style={{ flex: 1, minWidth: 0, overflow:'hidden' }}>
        <DesktopTopBar country={country} name={data.name} title={`${c.greeting}, ${data.name.split(' ')[0]}.`} onCountryClick={onCountryClick} />

        <div style={{ padding: 24, flex: 1, overflow:'auto' }}>
          {/* Top row — 4 KPIs */}
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Net worth — wide */}
            <div className="card" style={{ padding: 22, gridRow:'span 2' }}>
              <div className="row" style={{ justifyContent:'space-between' }}>
                <div>
                  <div className="muted" style={{ fontSize: 11, letterSpacing:'0.06em', textTransform:'uppercase' }}>Net worth</div>
                  <div className="font-serif" style={{ fontSize: 56, lineHeight: 1, marginTop: 6, letterSpacing:'-0.02em' }}>
                    {fmtMoney(data.networth, country, { compact: state==='wealthy' })}
                  </div>
                  <div className="row" style={{ gap: 8, marginTop: 8 }}>
                    <span className="pill pill-up">▲ {fmtPct(2.4)} · 30d</span>
                    <span className="num muted" style={{ fontSize: 12 }}>
                      +{fmtMoney(Math.round(data.networth * 0.024), country, { compact:true })} this month
                    </span>
                  </div>
                </div>
                <div className="row" style={{ gap: 4 }}>
                  {['1M','3M','YTD','1Y','5Y','All'].map((t, i) => (
                    <div key={t} style={{
                      padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                      background: i === 3 ? 'var(--brand-soft)' : 'var(--bg-2)',
                      color: i === 3 ? 'var(--brand)' : 'var(--ink-3)',
                    }}>{t}</div>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 16, color:'var(--brand)' }}>
                <AreaChart data={trend} w={620} h={200} stroke="var(--brand)" accent="var(--brand)" />
              </div>
              {/* Composition strip */}
              <div className="row" style={{ marginTop: 16, gap: 0, borderTop:'0.5px solid var(--line)', paddingTop: 16 }}>
                {[
                  ['Cash',     data.cash,     'var(--sky)'],
                  ['Invested', data.invest,   'var(--brand)'],
                  ['Property', data.property, 'var(--gold)'],
                ].filter(r => r[1]).map(([label, v, color]) => (
                  <div key={label} className="col" style={{ flex: 1, gap: 4, borderLeft: label === 'Cash' ? '0' : '0.5px solid var(--line)', paddingLeft: label === 'Cash' ? 0 : 16, paddingRight: 16 }}>
                    <div className="row" style={{ gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: color }}/>
                      <span className="muted" style={{ fontSize: 11 }}>{label}</span>
                    </div>
                    <div className="num" style={{ fontSize: 17, fontWeight: 600 }}>{fmtMoney(v, country, { compact:true })}</div>
                    <div className="num muted" style={{ fontSize: 10 }}>{(v / data.networth * 100).toFixed(0)}% of total</div>
                  </div>
                ))}
              </div>
            </div>

            {/* This month KPIs */}
            <KPICard label="Income · June" value={fmtMoney(data.monthlyIncome, country, { compact:true })} pill="▲ 4.2%" pillKind="up" data={genSeries(12, data.monthlyIncome * 0.9, 0.1, 0.05, 3)} />
            <KPICard label="Spend · June"  value={fmtMoney(data.monthlySpend, country, { compact:true })}  pill="▼ 1.8%" pillKind="up" data={genSeries(12, data.monthlySpend, -0.02, 0.05, 5)} accent="var(--clay)" />
            <KPICard label="Savings rate"  value="32%"                                                     pill="On target" pillKind="brand" data={genSeries(12, 26, 0.2, 0.04, 7)} accent="var(--gold)" />
          </div>

          {/* Second row */}
          <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr 1fr', gap: 16 }}>
            {/* Budget snapshot */}
            <div className="card" style={{ padding: 20 }}>
              <div className="row" style={{ justifyContent:'space-between', marginBottom: 14 }}>
                <div>
                  <div className="font-serif" style={{ fontSize: 18 }}>Budget · June</div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                    {fmtMoney(data.budget.reduce((s,b)=>s+b.spent,0), country, { compact:true })} of {fmtMoney(data.budget.reduce((s,b)=>s+b.budget,0), country, { compact:true })} spent
                  </div>
                </div>
                <span className="pill pill-brand">↗ View budget</span>
              </div>
              <div className="col" style={{ gap: 10 }}>
                {data.budget.slice(0, 5).map(b => {
                  const pct = Math.min(b.spent / b.budget * 100, 100);
                  const over = b.spent > b.budget;
                  return (
                    <div key={b.cat} className="row" style={{ gap: 12, alignItems:'center' }}>
                      <div className="row" style={{ gap: 8, flex: '0 0 130px' }}>
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: `var(--${b.color})` }}/>
                        <span style={{ fontSize: 12 }}>{b.cat}</span>
                      </div>
                      <div style={{ flex: 1, height: 6, background:'var(--bg-2)', borderRadius: 999, overflow:'hidden' }}>
                        <div style={{ width: pct + '%', height:'100%', background: over ? 'var(--down)' : `var(--${b.color})`, borderRadius: 999 }}/>
                      </div>
                      <div className="num" style={{ fontSize: 11, color: over ? 'var(--down)' : 'var(--ink-2)', flex:'0 0 120px', textAlign:'right' }}>
                        {fmtMoney(b.spent, country, { compact:true })}<span className="muted"> / {fmtMoney(b.budget, country, { compact:true })}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Goals */}
            <div className="card" style={{ padding: 20 }}>
              <div className="row" style={{ justifyContent:'space-between', marginBottom: 14 }}>
                <div className="font-serif" style={{ fontSize: 18 }}>Goals</div>
                <span className="pill pill-soft">{data.goals.length} active</span>
              </div>
              <div className="col" style={{ gap: 14 }}>
                {data.goals.map(g => {
                  const pct = Math.min(g.saved / g.target * 100, 100);
                  return (
                    <div key={g.id} className="col" style={{ gap: 6 }}>
                      <div className="row" style={{ justifyContent:'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 500 }}>{g.label}</span>
                        <span className="num" style={{ fontSize: 12, color:`var(--${g.color})`, fontWeight: 600 }}>{pct.toFixed(0)}%</span>
                      </div>
                      <div style={{ height: 5, background:'var(--bg-2)', borderRadius:999, overflow:'hidden' }}>
                        <div style={{ width: pct + '%', height:'100%', background:`var(--${g.color})`, borderRadius:999 }}/>
                      </div>
                      <div className="muted" style={{ fontSize: 10 }}>
                        {fmtMoney(g.saved, country, { compact:true })} / {fmtMoney(g.target, country, { compact:true })} · {g.by}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Imari advisor (compact) */}
            <div className="card" style={{ padding: 20, background:'linear-gradient(180deg, var(--paper) 0%, var(--brand-soft) 100%)' }}>
              <div className="row" style={{ gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: 'linear-gradient(135deg, var(--brand), var(--brand-2))', color: 'var(--brand-ink)',
                  display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Instrument Serif, serif', fontSize: 16,
                }}>✦</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Imari Advisor</div>
                  <div className="muted" style={{ fontSize: 10 }}>AI · {c.markets.short} regulated</div>
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, lineHeight: 1.35 }}>
                {data.insights?.[0]?.title}
              </div>
              <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.45, marginBottom: 10 }}>
                {data.insights?.[0]?.body}
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn-primary" style={{ padding: '8px 12px', fontSize: 11 }}>Open chat</button>
                <button className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 11 }}>Dismiss</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, pill, pillKind = 'up', data, accent = 'var(--brand)' }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="muted" style={{ fontSize: 11, letterSpacing:'0.06em', textTransform:'uppercase' }}>{label}</div>
      <div className="font-serif" style={{ fontSize: 26, marginTop: 4, letterSpacing:'-0.01em' }}>{value}</div>
      <div style={{ marginTop: 8, color: accent }}>
        <Sparkline data={data} w={200} h={32} stroke={accent} fill strokeWidth={1.5} />
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        <span className={`pill pill-${pillKind}`} style={{ fontSize: 10 }}>{pill}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  DESKTOP WEALTH
// ═══════════════════════════════════════════════════════════════
function DesktopWealth({ country = 'RW', state = 'typical', onCountryClick }) {
  const data = DATASETS[country][state];
  const c = COUNTRIES[country];
  const series = genSeries(180, data.invest * 0.7, 0.45, 0.02, 17);
  series.push(data.invest);

  const allocations = [
    { label:'Equities · '+c.exchange.short, value: 58, color:'var(--brand)' },
    { label:'Government Bonds',           value: 24, color:'var(--gold)' },
    { label:'Unit Trusts',                value: 12, color:'var(--sky)' },
    { label:'Cash & MoMo',                value:  6, color:'var(--ink-3)' },
  ];

  return (
    <div className="row" style={{ width: '100%', height: 900, background: 'var(--bg)' }}>
      <DesktopSidebar active="wealth" country={country} />
      <div className="col" style={{ flex: 1, minWidth: 0, overflow:'hidden' }}>
        <DesktopTopBar country={country} name={data.name} title="Wealth & Investments" onCountryClick={onCountryClick} />

        <div style={{ padding: 24, flex: 1, overflow:'auto' }}>
          {/* Big chart */}
          <div className="card" style={{ padding: 24, marginBottom: 16 }}>
            <div className="row" style={{ justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div className="muted" style={{ fontSize: 11, letterSpacing:'0.06em', textTransform:'uppercase' }}>Portfolio value</div>
                <div className="font-serif" style={{ fontSize: 48, marginTop: 4, letterSpacing:'-0.02em' }}>
                  {fmtMoney(data.invest, country, { compact: state==='wealthy' })}
                </div>
                <div className="row" style={{ gap: 10, marginTop: 8 }}>
                  <span className="pill pill-up">▲ {fmtPct(8.4)} YTD</span>
                  <span className="num muted" style={{ fontSize: 12 }}>
                    +{fmtMoney(Math.round(data.invest*0.084), country, { compact:true })} unrealised
                  </span>
                </div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                {['1W','1M','3M','YTD','1Y','5Y','All'].map((t, i) => (
                  <div key={t} style={{
                    padding: '6px 12px', borderRadius: 7, fontSize: 11, fontWeight: 500,
                    background: i === 4 ? 'var(--brand-soft)' : 'var(--bg-2)',
                    color: i === 4 ? 'var(--brand)' : 'var(--ink-3)',
                  }}>{t}</div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 18, color: 'var(--brand)' }}>
              <AreaChart data={series} w={1080} h={240} stroke="var(--brand)" accent="var(--brand)" />
            </div>
            <div className="row" style={{ justifyContent:'space-between', fontSize: 10, color:'var(--ink-4)', paddingTop: 4 }}>
              {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(m => <span key={m}>{m}</span>)}
            </div>
          </div>

          {/* Allocation + Market */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1.4fr', gap: 16, marginBottom: 16 }}>
            <div className="card" style={{ padding: 22 }}>
              <div className="font-serif" style={{ fontSize: 18, marginBottom: 14 }}>Allocation</div>
              <div className="row" style={{ gap: 22, alignItems:'center' }}>
                <Donut slices={allocations.map(a => ({ value: a.value, color: a.color }))} size={140} thickness={18} />
                <div className="col" style={{ flex: 1, gap: 10 }}>
                  {allocations.map(a => (
                    <div key={a.label}>
                      <div className="row" style={{ gap: 8, justifyContent:'space-between' }}>
                        <div className="row" style={{ gap: 8 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 999, background: a.color }}/>
                          <span style={{ fontSize: 12 }}>{a.label}</span>
                        </div>
                        <span className="num" style={{ fontSize: 12, fontWeight: 600 }}>{a.value}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 22 }}>
              <div className="row" style={{ justifyContent:'space-between', marginBottom: 14 }}>
                <div className="font-serif" style={{ fontSize: 18 }}>{c.exchange.short} · Market today</div>
                <span className="pill pill-soft">{new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short' })}</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {c.tickers.map(t => (
                  <div key={t.sym} style={{ padding: 12, borderRadius: 10, background:'var(--bg-2)' }}>
                    <div className="row" style={{ justifyContent:'space-between' }}>
                      <span style={{ fontSize: 11, fontWeight: 600 }}>{t.sym}</span>
                      <span className="num" style={{ fontSize: 10, color: t.ch >= 0 ? 'var(--up)' : 'var(--down)' }}>{fmtPct(t.ch)}</span>
                    </div>
                    <div className="num" style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>{fmtMoney(t.px, country)}</div>
                    <div className="muted" style={{ fontSize: 10, marginTop: 1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Holdings table */}
          <div className="card" style={{ padding: 0 }}>
            <div className="row" style={{ padding: '18px 22px', justifyContent:'space-between' }}>
              <div className="font-serif" style={{ fontSize: 18 }}>Holdings · {data.holdings.length} positions</div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 12 }}>Export · CSV</button>
                <button className="btn btn-primary" style={{ padding: '7px 12px', fontSize: 12 }}>＋ Buy</button>
              </div>
            </div>
            <div className="hr"/>
            <div className="row" style={{ padding: '10px 22px', fontSize: 11, color:'var(--ink-3)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight: 600 }}>
              <div style={{ flex:'0 0 130px' }}>Asset</div>
              <div style={{ flex: 1 }}>Class</div>
              <div style={{ flex:'0 0 100px', textAlign:'right' }}>Units</div>
              <div style={{ flex:'0 0 120px', textAlign:'right' }}>Avg cost</div>
              <div style={{ flex:'0 0 120px', textAlign:'right' }}>Price</div>
              <div style={{ flex:'0 0 140px', textAlign:'right' }}>Value</div>
              <div style={{ flex:'0 0 80px', textAlign:'right' }}>P/L</div>
            </div>
            <div className="hr"/>
            {data.holdings.map((h, i) => {
              const ticker = c.tickers.find(t => t.sym === h.sym) || c.tickers[0];
              const px = ticker?.px || h.avg;
              const value = h.shares * px;
              const pl = (px - h.avg) / h.avg * 100;
              const isEq = h.cls.includes('Equity');
              return (
                <div key={h.sym + i}>
                  {i > 0 && <div className="hr"/>}
                  <div className="row" style={{ padding: '13px 22px', fontSize: 13 }}>
                    <div style={{ flex:'0 0 130px' }}>
                      <div className="row" style={{ gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, background: 'var(--bg-2)',
                          color: 'var(--ink-2)', fontFamily:'Geist Mono', fontWeight: 600, fontSize: 10,
                          display:'flex', alignItems:'center', justifyContent:'center',
                        }}>{h.sym.slice(0,4)}</div>
                        <div className="col" style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 500 }}>{h.sym}</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ flex: 1, color:'var(--ink-2)', fontSize: 12 }}>
                      {h.name || ticker.name}<br/>
                      <span className="muted" style={{ fontSize: 11 }}>{h.cls}{h.yield ? ` · ${h.yield}% yield` : ''}</span>
                    </div>
                    <div className="num" style={{ flex:'0 0 100px', textAlign:'right' }}>{h.shares.toLocaleString()}</div>
                    <div className="num" style={{ flex:'0 0 120px', textAlign:'right' }}>{fmtMoney(h.avg, country)}</div>
                    <div className="num" style={{ flex:'0 0 120px', textAlign:'right' }}>{isEq ? fmtMoney(px, country) : '—'}</div>
                    <div className="num" style={{ flex:'0 0 140px', textAlign:'right', fontWeight: 500 }}>{fmtMoney(value, country, { compact: state==='wealthy' })}</div>
                    <div className="num" style={{ flex:'0 0 80px', textAlign:'right', color: pl >= 0 ? 'var(--up)' : 'var(--down)', fontWeight: 500 }}>{fmtPct(pl)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  DESKTOP ADVISOR + TAX
// ═══════════════════════════════════════════════════════════════
function DesktopAdvisorTax({ country = 'RW', state = 'typical', onCountryClick }) {
  const c = COUNTRIES[country];
  const data = DATASETS[country][state];
  const monthlyIncome = data.monthlyIncome || 0;
  let taxMonthly = 0;
  let prev = 0;
  c.taxBands.forEach(b => {
    const taxable = Math.max(0, Math.min(monthlyIncome, b.upTo) - prev);
    taxMonthly += taxable * b.rate;
    prev = b.upTo;
  });

  const conversations = [
    { who:'imari', body:`${c.greeting} ${data.name.split(' ')[0]}. Three things came up overnight — biggest first?` },
    { who:'me',    body:`Yes please.` },
    { who:'imari', kind:'card', card:{
      title:'Concentration risk · '+c.exchange.short,
      detail:'78% of your equity book is on a single market. Below industry benchmark of 55%.',
      action:'Diversify to EAC regional ETF',
    }},
    { who:'imari', body:`Idle cash of ~${fmtMoney(state==='wealthy'? 12_000_000 : 380_000, country, { compact:true })} could earn 13.25% in the 7-yr Treasury Bond. ${c.tax.short} treats interest from government securities favourably — I can show the after-tax math.` },
  ];

  return (
    <div className="row" style={{ width: '100%', height: 900, background: 'var(--bg)' }}>
      <DesktopSidebar active="advisor" country={country} />
      <div className="col" style={{ flex: 1, minWidth: 0, overflow:'hidden' }}>
        <DesktopTopBar country={country} name={data.name} title="Advisor & Country rules" onCountryClick={onCountryClick} />

        <div style={{ padding: 24, flex: 1, overflow:'auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap: 16 }}>
          {/* Left: chat */}
          <div className="card" style={{ display:'flex', flexDirection:'column', minHeight: 720 }}>
            <div className="row" style={{ padding: '16px 20px', gap: 10, borderBottom:'0.5px solid var(--line)' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'linear-gradient(135deg, var(--brand), var(--brand-2))',
                color: 'var(--brand-ink)', display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:'Instrument Serif, serif', fontSize: 20,
              }}>✦</div>
              <div className="col">
                <div style={{ fontSize: 14, fontWeight: 600 }}>Imari Advisor</div>
                <div className="row" style={{ gap: 6, fontSize: 11, color:'var(--ink-3)' }}>
                  <span style={{ width:6, height:6, borderRadius:999, background:'var(--up)' }}/>
                  AI · trained on {c.regulator.short}, {c.markets.short} & {c.tax.short} rules
                </div>
              </div>
              <div className="row" style={{ marginLeft:'auto', gap: 6 }}>
                <span className="pill pill-soft">↻ New chat</span>
              </div>
            </div>

            <div className="col" style={{ gap: 10, padding: 20, flex: 1, overflow:'auto' }}>
              {conversations.map((m, i) => {
                if (m.who === 'imari' && m.kind === 'card') {
                  return (
                    <div key={i} style={{ maxWidth: '85%' }}>
                      <div style={{
                        padding: 14, borderRadius: '14px 14px 14px 4px',
                        background: 'var(--paper)', border: '1px solid var(--down-soft)',
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color:'var(--down)', textTransform:'uppercase', letterSpacing:'0.06em' }}>▲ Watch out</div>
                        <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{m.card.title}</div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.4 }}>{m.card.detail}</div>
                        <div className="row" style={{ marginTop: 10, gap: 6 }}>
                          <span style={{ padding: '5px 10px', borderRadius: 7, background:'var(--brand)', color:'var(--brand-ink)', fontSize: 11, fontWeight: 500 }}>{m.card.action}</span>
                          <span style={{ padding: '5px 10px', fontSize: 11, color:'var(--ink-3)' }}>Skip</span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={i} style={{ maxWidth:'85%', alignSelf: m.who === 'me' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      padding: '10px 14px', borderRadius: m.who === 'me' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      background: m.who === 'me' ? 'var(--brand)' : 'var(--paper-2)',
                      color: m.who === 'me' ? 'var(--brand-ink)' : 'var(--ink)',
                      border: m.who === 'me' ? '0' : '0.5px solid var(--line)',
                      fontSize: 13, lineHeight: 1.5,
                    }}>{m.body}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: 16, borderTop: '0.5px solid var(--line)' }}>
              <div className="row" style={{ padding: '10px 14px', borderRadius: 10, background:'var(--bg-2)', gap: 10 }}>
                <span className="muted">＋</span>
                <span className="muted" style={{ flex: 1, fontSize: 13 }}>Ask about taxes, investments, goals…</span>
                <span style={{ width: 30, height: 30, borderRadius: 999, background:'var(--brand)', color:'var(--brand-ink)', display:'flex', alignItems:'center', justifyContent:'center', fontSize: 14 }}>↑</span>
              </div>
              <div className="muted" style={{ fontSize: 10, marginTop: 6, textAlign:'center' }}>
                Robo-advisor compliant with {c.markets.short} guidance. Not human advice.
              </div>
            </div>
          </div>

          {/* Right: tax + regulators */}
          <div className="col" style={{ gap: 16 }}>
            {/* Tax card */}
            <div className="card" style={{ padding: 22 }}>
              <div className="row" style={{ justifyContent:'space-between' }}>
                <div>
                  <div className="muted" style={{ fontSize: 11, letterSpacing:'0.06em', textTransform:'uppercase' }}>Income tax · {c.tax.short}</div>
                  <div className="font-serif" style={{ fontSize: 32, marginTop: 4 }}>{fmtMoney(Math.round(taxMonthly * 12), country, { compact:true })}<span className="muted" style={{ fontSize: 14 }}> / year est.</span></div>
                </div>
                <span className="pill pill-soft">PAYE · withheld</span>
              </div>
              <div style={{ marginTop: 18 }}>
                <div className="row" style={{ justifyContent:'space-between', marginBottom: 8, fontSize: 11, color:'var(--ink-3)' }}>
                  <span>Tax bands (monthly)</span>
                  <span className="num">Your income: {fmtMoney(monthlyIncome, country, { compact:true })}</span>
                </div>
                <div style={{ position:'relative', height: 36, background:'var(--bg-2)', borderRadius: 8, overflow:'hidden' }}>
                  {(() => {
                    const max = c.taxBands[c.taxBands.length - 2]?.upTo * 1.5 || monthlyIncome * 1.3;
                    return c.taxBands.map((b, i) => {
                      const left = i === 0 ? 0 : c.taxBands[i - 1].upTo / max * 100;
                      const right = Math.min(b.upTo / max * 100, 100);
                      const w = right - left;
                      if (w <= 0.5) return null;
                      const intensity = 0.18 + (b.rate * 1.6);
                      return (
                        <div key={i} style={{
                          position:'absolute', top: 0, bottom: 0, left: left + '%', width: w + '%',
                          background: `color-mix(in oklab, var(--brand) ${Math.min(intensity * 100, 90)}%, transparent)`,
                          borderRight: '1.5px solid var(--paper)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize: 11, fontWeight: 600, color: b.rate > 0.18 ? '#fff' : 'var(--ink)',
                        }}>{(b.rate * 100).toFixed(0)}%</div>
                      );
                    });
                  })()}
                  {(() => {
                    const max = c.taxBands[c.taxBands.length - 2]?.upTo * 1.5 || monthlyIncome * 1.3;
                    const pos = Math.min(monthlyIncome / max * 100, 99);
                    return (
                      <div style={{ position:'absolute', top:-6, bottom:-6, left: pos + '%', width: 2, background:'var(--ink)' }}>
                        <div style={{ position:'absolute', top:-14, left:-18, width: 40, fontSize: 10, textAlign:'center', fontWeight: 600 }}>You</div>
                      </div>
                    );
                  })()}
                </div>
                <div className="col" style={{ gap: 4, marginTop: 14, fontSize: 11, color:'var(--ink-3)' }}>
                  {c.taxBands.map((b, i) => <span key={i}>{b.label}</span>)}
                </div>
              </div>
            </div>

            {/* Regulators */}
            <div className="card" style={{ padding: 22 }}>
              <div className="font-serif" style={{ fontSize: 18, marginBottom: 14 }}>Who regulates you in {c.name}</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10 }}>
                {[
                  { r: c.regulator, role: 'Central bank · banking' },
                  { r: c.markets,   role: 'Securities · advisor licence' },
                  { r: c.tax,       role: 'Income & capital gains' },
                  { r: c.pension,   role: 'Mandatory pension' },
                ].map(row => (
                  <div key={row.r.short} className="row" style={{ padding: 12, borderRadius: 10, background:'var(--bg-2)', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, background:'var(--paper)', color:'var(--brand)',
                      display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Instrument Serif, serif', fontSize: 14, fontWeight: 500,
                    }}>{row.r.short}</div>
                    <div className="col" style={{ flex: 1, gap: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{row.r.name}</div>
                      <div className="muted" style={{ fontSize: 10 }}>{row.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bonds & yields */}
            <div className="card" style={{ padding: 22 }}>
              <div className="row" style={{ justifyContent:'space-between', marginBottom: 12 }}>
                <div className="font-serif" style={{ fontSize: 18 }}>Government securities</div>
                <span className="muted" style={{ fontSize: 11 }}>Live · {c.regulator.short}</span>
              </div>
              <div className="col" style={{ gap: 6 }}>
                {c.govBonds.map(b => (
                  <div key={b.name} className="row" style={{ padding: '10px 12px', borderRadius: 8, background:'var(--bg-2)', justifyContent:'space-between' }}>
                    <span style={{ fontSize: 12 }}>{b.name}</span>
                    <span className="num" style={{ fontSize: 13, fontWeight: 600, color:'var(--brand)' }}>{b.yield.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DesktopOverview, DesktopWealth, DesktopAdvisorTax });
})();
