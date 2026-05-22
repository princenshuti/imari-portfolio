// mobile-2.jsx — Wealth, Goals, Transactions

(function(){
const { Sparkline, AreaChart, Donut, CatGlyph, CAT_COLOR, CAT_GLYPH,
        Avatar, CountryChip, MobileTabBar, SectionHead, genSeries } = window;
const { COUNTRIES, DATASETS, fmtMoney, fmtPct } = window;

// ═══════════════════════════════════════════════════════════════
//  WEALTH — portfolio + holdings
// ═══════════════════════════════════════════════════════════════
function WealthScreen({ country = 'RW', state = 'typical', onCountryClick }) {
  const data = DATASETS[country][state];
  const c = COUNTRIES[country];
  const series = genSeries(60, data.invest * 0.85, 0.18, 0.025, 11);
  series.push(data.invest);

  const allocations = [
    { label:'Equities · RSE', value: 58, color:'var(--brand)' },
    { label:'Gov. Bonds',     value: 24, color:'var(--gold)' },
    { label:'Unit Trusts',    value: 12, color:'var(--sky)' },
    { label:'Cash',           value:  6, color:'var(--ink-3)' },
  ];

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%', paddingTop: 52, paddingBottom: 90 }}>
      <div className="row" style={{ padding: '14px 16px', justifyContent:'space-between' }}>
        <div className="font-serif" style={{ fontSize: 26 }}>Wealth</div>
        <CountryChip country={country} onClick={onCountryClick}/>
      </div>

      {/* Portfolio value card */}
      <div className="card" style={{ margin: '0 16px 12px', padding: '18px 18px 8px' }}>
        <div className="row" style={{ justifyContent:'space-between' }}>
          <div>
            <div className="muted" style={{ fontSize: 11, letterSpacing:'0.06em', textTransform:'uppercase' }}>Portfolio value</div>
            <div className="font-serif" style={{ fontSize: 36, marginTop: 2, letterSpacing:'-0.02em' }}>
              {fmtMoney(data.invest, country, { compact: state==='wealthy' })}
            </div>
          </div>
          <div className="col" style={{ alignItems:'flex-end', gap: 3 }}>
            <span className="pill pill-up">▲ {fmtPct(8.4)} YTD</span>
            <span className="num muted" style={{ fontSize: 11 }}>+{fmtMoney(Math.round(data.invest*0.084), country, { compact:true })}</span>
          </div>
        </div>

        {/* Time tabs */}
        <div className="row" style={{ gap: 4, marginTop: 14 }}>
          {['1W','1M','3M','1Y','5Y','All'].map((t, i) => (
            <div key={t} style={{
              padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 500,
              background: i === 3 ? 'var(--brand-soft)' : 'transparent',
              color: i === 3 ? 'var(--brand)' : 'var(--ink-3)',
            }}>{t}</div>
          ))}
        </div>

        <div style={{ marginTop: 4, color: 'var(--brand)' }}>
          <AreaChart data={series} w={370} h={130} stroke="var(--brand)" accent="var(--brand)" />
        </div>
        <div className="row" style={{ justifyContent:'space-between', fontSize: 10, color:'var(--ink-4)', paddingTop: 2 }}>
          <span>Jul</span><span>Sep</span><span>Nov</span><span>Jan</span><span>Mar</span><span>May</span>
        </div>
      </div>

      {/* Allocation strip */}
      <div className="card" style={{ margin: '0 16px 12px', padding: 16 }}>
        <div className="row" style={{ justifyContent:'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>Allocation</div>
          <div className="muted" style={{ fontSize: 11 }}>{c.exchange.short} ·  diversified</div>
        </div>
        <div style={{ display:'flex', height: 8, borderRadius: 999, overflow:'hidden', gap: 2 }}>
          {allocations.map((a, i) => (
            <div key={i} style={{ flex: a.value, background: a.color }} />
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: '8px 14px', marginTop: 12 }}>
          {allocations.map(a => (
            <div key={a.label} className="row" style={{ gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: a.color }}/>
              <span style={{ fontSize: 12, flex: 1 }}>{a.label}</span>
              <span className="num" style={{ fontSize: 12, color:'var(--ink-2)' }}>{a.value}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Holdings */}
      <SectionHead title="Holdings" action={`${data.holdings.length} positions`} />
      <div className="card" style={{ margin: '0 16px 12px', padding: '4px 0' }}>
        {data.holdings.map((h, i) => {
          const ticker = c.tickers.find(t => t.sym === h.sym) || c.tickers[0];
          const value = h.shares * (ticker?.px || h.avg);
          const isBond = h.cls.includes('Bond') || h.cls.includes('Trust') || h.cls.includes('Equity') === false;
          return (
            <div key={h.sym + i}>
              {i > 0 && <div className="hr" style={{ margin: '0 16px' }}/>}
              <div className="row" style={{ padding: '12px 14px', gap: 12 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, background: 'var(--bg-2)',
                  color: 'var(--ink-2)', fontFamily:'Geist Mono', fontWeight: 600, fontSize: 11,
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0,
                }}>{h.sym.slice(0,4)}</div>
                <div className="col" style={{ flex: 1, gap: 2, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {h.name || ticker.name}
                  </div>
                  <div className="muted" style={{ fontSize: 11 }}>
                    {h.cls}{h.yield ? ` · ${h.yield}% yield` : ''}
                  </div>
                </div>
                <div className="col" style={{ alignItems:'flex-end', gap: 2 }}>
                  <div className="num" style={{ fontSize: 13, fontWeight: 500 }}>
                    {fmtMoney(value, country, { compact:true })}
                  </div>
                  {!isBond && ticker.ch !== undefined && (
                    <div className="num" style={{ fontSize: 11, color: ticker.ch >= 0 ? 'var(--up)' : 'var(--down)' }}>
                      {fmtPct(ticker.ch)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Buy / Sell CTA */}
      <div className="row" style={{ gap: 8, padding: '0 16px 14px' }}>
        <button className="btn btn-primary" style={{ flex: 1 }}>Buy</button>
        <button className="btn btn-ghost" style={{ flex: 1 }}>Sell</button>
      </div>

      <div className="muted" style={{ fontSize: 10, padding: '0 16px 80px', textAlign:'center' }}>
        Settled in {c.currency.code} · {c.exchange.name}<br/>
        Regulated by {c.markets.short}
      </div>

      <MobileTabBar active="wealth" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  GOALS — life goals tracker
// ═══════════════════════════════════════════════════════════════
function GoalsScreen({ country = 'RW', state = 'typical', onCountryClick }) {
  const data = DATASETS[country][state];
  const totalTarget = data.goals.reduce((s, g) => s + g.target, 0);
  const totalSaved  = data.goals.reduce((s, g) => s + g.saved, 0);
  const overall = totalTarget ? totalSaved / totalTarget * 100 : 0;

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%', paddingTop: 52, paddingBottom: 90 }}>
      <div className="row" style={{ padding: '14px 16px', justifyContent:'space-between' }}>
        <div className="font-serif" style={{ fontSize: 26 }}>Goals</div>
        <CountryChip country={country} onClick={onCountryClick}/>
      </div>

      {/* Overall progress ring */}
      <div className="card" style={{ margin: '0 16px 14px', padding: 18 }}>
        <div className="row" style={{ gap: 18, alignItems:'center' }}>
          <RingProgress pct={overall} size={92} thickness={10} />
          <div className="col" style={{ flex: 1 }}>
            <div className="muted" style={{ fontSize: 11 }}>Saved across all goals</div>
            <div className="font-serif" style={{ fontSize: 24, lineHeight: 1.1, marginTop: 2 }}>
              {fmtMoney(totalSaved, country, { compact:true })}
              <span className="muted" style={{ fontSize: 14 }}> / {fmtMoney(totalTarget, country, { compact:true })}</span>
            </div>
            <div className="row" style={{ gap: 6, marginTop: 8 }}>
              <span className="pill pill-up">On pace</span>
              <span className="pill pill-soft">3 active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Each goal */}
      <SectionHead title="All goals" action="＋ Add" />
      <div className="col" style={{ gap: 10, padding: '0 16px 12px' }}>
        {data.goals.map(g => {
          const pct = Math.min(g.saved / g.target * 100, 100);
          const col = `var(--${g.color})`;
          const monthsLeft = g.by === 'On track' ? null : 18;
          const monthly = monthsLeft ? Math.round((g.target - g.saved) / monthsLeft) : 0;
          return (
            <div key={g.id} className="card" style={{ padding: 16 }}>
              <div className="row" style={{ justifyContent:'space-between', marginBottom: 10 }}>
                <div className="row" style={{ gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `color-mix(in oklab, ${col} 18%, transparent)`, color: col, display:'flex', alignItems:'center', justifyContent:'center', fontSize: 18 }}>
                    {g.id === 'house' ? '◐' : g.id === 'edu' ? '▢' : g.id === 'emergency' ? '◇' : g.id === 'villa' ? '◆' : g.id === 'venture' ? '↑' : '⊛'}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{g.label}</div>
                    <div className="muted" style={{ fontSize: 11 }}>Target: {g.by}</div>
                  </div>
                </div>
                <div className="num" style={{ fontSize: 14, fontWeight: 600, color: col }}>{pct.toFixed(0)}%</div>
              </div>
              <div style={{ height: 8, background:'var(--bg-2)', borderRadius:999, overflow:'hidden' }}>
                <div style={{ width: pct+'%', height:'100%', background: col, borderRadius:999 }}/>
              </div>
              <div className="row" style={{ justifyContent:'space-between', marginTop: 10, fontSize: 11 }}>
                <div className="col" style={{ gap: 1 }}>
                  <span className="muted">Saved</span>
                  <span className="num" style={{ fontSize: 12, fontWeight: 500 }}>{fmtMoney(g.saved, country, { compact:true })}</span>
                </div>
                <div className="col" style={{ gap: 1 }}>
                  <span className="muted">Target</span>
                  <span className="num" style={{ fontSize: 12, fontWeight: 500 }}>{fmtMoney(g.target, country, { compact:true })}</span>
                </div>
                {monthly > 0 && (
                  <div className="col" style={{ gap: 1, alignItems:'flex-end' }}>
                    <span className="muted">Auto‑save/mo</span>
                    <span className="num t-brand" style={{ fontSize: 12, fontWeight: 500 }}>{fmtMoney(monthly, country, { compact:true })}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Insight */}
      <div style={{ margin: '4px 16px 14px', padding: 14, borderRadius: 14, background: 'var(--paper)', border: '0.5px solid var(--line)' }}>
        <div style={{ fontSize: 12, color:'var(--ink-3)', textTransform:'uppercase', letterSpacing:'0.06em' }}>RSSB tip</div>
        <div style={{ fontSize: 13, marginTop: 6, lineHeight: 1.4 }}>
          Add a <b>{COUNTRIES[country].pension.short}</b> long‑term savings goal — voluntary contributions are deductible from PAYE.
        </div>
      </div>

      <MobileTabBar active="more" />
    </div>
  );
}

function RingProgress({ pct, size = 80, thickness = 8, color = 'var(--brand)' }) {
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  const dash = (pct / 100) * C;
  return (
    <div style={{ position:'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} stroke="var(--bg-2)" strokeWidth={thickness} fill="none"/>
        <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={thickness} fill="none"
          strokeDasharray={`${dash} ${C}`} strokeLinecap="round"/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily:'Instrument Serif, serif', fontSize: size * 0.32 }}>{pct.toFixed(0)}%</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TRANSACTIONS — feed
// ═══════════════════════════════════════════════════════════════
function TransactionsScreen({ country = 'RW', state = 'typical', onCountryClick }) {
  const data = DATASETS[country][state];
  const c = COUNTRIES[country];
  // Group by day
  const grouped = {};
  data.txns.forEach(t => { (grouped[t.d] = grouped[t.d] || []).push(t); });
  const days = Object.keys(grouped);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%', paddingTop: 52, paddingBottom: 90 }}>
      <div className="row" style={{ padding: '14px 16px', justifyContent:'space-between' }}>
        <div className="font-serif" style={{ fontSize: 26 }}>Transactions</div>
        <CountryChip country={country} onClick={onCountryClick}/>
      </div>

      {/* Search + filters */}
      <div className="row" style={{ gap: 8, padding: '0 16px 12px' }}>
        <div className="row" style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background:'var(--paper)', border: '0.5px solid var(--line)', gap: 8 }}>
          <span className="muted">⌕</span>
          <span className="muted" style={{ fontSize: 13 }}>Search merchant, category…</span>
        </div>
        <div className="row" style={{ padding: '10px 12px', borderRadius: 10, background:'var(--paper)', border: '0.5px solid var(--line)' }}>⇅</div>
      </div>

      <div className="row" style={{ gap: 6, padding: '0 16px 14px', overflowX:'auto' }}>
        {['All', 'MoMo only', 'Card', 'Bank', 'Income', 'Investment'].map((f, i) => (
          <span key={f} className="chip" style={{
            background: i === 0 ? 'var(--ink)' : 'var(--bg-2)',
            color:      i === 0 ? 'var(--paper)' : 'var(--ink-2)',
            fontSize: 11,
          }}>{f}</span>
        ))}
      </div>

      {/* Day groups */}
      {days.map(day => {
        const dayTxns = grouped[day];
        const dayTotal = dayTxns.reduce((s,t) => s + t.amt, 0);
        return (
          <div key={day}>
            <div className="row" style={{ justifyContent:'space-between', padding: '0 18px 8px' }}>
              <span style={{ fontSize: 11, color:'var(--ink-3)', fontWeight: 600, letterSpacing:'0.06em', textTransform:'uppercase' }}>{day}</span>
              <span className="num" style={{ fontSize: 11, color: dayTotal >= 0 ? 'var(--up)' : 'var(--ink-3)' }}>
                {dayTotal >= 0 ? '+' : ''}{fmtMoney(dayTotal, country, { compact:true })}
              </span>
            </div>
            <div className="card" style={{ margin: '0 16px 14px', padding: '4px 0' }}>
              {dayTxns.map((tx, i) => (
                <div key={i}>
                  {i > 0 && <div className="hr" style={{ margin: '0 16px' }}/>}
                  <div className="row" style={{ padding: '11px 14px', gap: 12 }}>
                    <CatGlyph color={CAT_COLOR[tx.cat] || 'var(--ink-3)'} glyph={CAT_GLYPH[tx.cat] || '·'} size={34} />
                    <div className="col" style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{tx.who}</div>
                      <div className="muted" style={{ fontSize: 11 }}>{tx.t} · {tx.via}</div>
                    </div>
                    <div className="num" style={{
                      fontSize: 13, fontWeight: 500,
                      color: tx.amt >= 0 ? 'var(--up)' : 'var(--ink)',
                    }}>
                      {tx.amt >= 0 ? '+' : ''}{fmtMoney(tx.amt, country, { compact:true })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <MobileTabBar active="more" />
    </div>
  );
}

Object.assign(window, { WealthScreen, GoalsScreen, TransactionsScreen, RingProgress });
})();
