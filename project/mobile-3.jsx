// mobile-3.jsx — Advisor (AI chat), Insights, Tax & Country

(function(){
const { Sparkline, AreaChart, Donut, CatGlyph, CAT_COLOR,
        Avatar, CountryChip, MobileTabBar, SectionHead, genSeries } = window;
const { COUNTRIES, DATASETS, fmtMoney, fmtPct } = window;

// ═══════════════════════════════════════════════════════════════
//  ADVISOR — AI robo-advisor chat
// ═══════════════════════════════════════════════════════════════
function AdvisorScreen({ country = 'RW', state = 'typical', onCountryClick }) {
  const c = COUNTRIES[country];
  const data = DATASETS[country][state];

  const messages = [
    { who:'imari', t:'10:42', body:
      `${c.greeting} ${data.name.split(' ')[0]}. I've reviewed your numbers from this week — three things stood out. Want me to walk through them?`
    },
    { who:'me', t:'10:43', body: `Yes, start with my biggest risk.` },
    { who:'imari', t:'10:43', kind:'card', card:{
      title:'Concentration risk · RSE',
      body:`Your equity exposure is heavily weighted to ${c.exchange.short}. Consider regional diversification.`,
      stat:'78%', statLabel:'on RSE',
    }},
    { who:'imari', t:'10:43', body:
      `One option: move ~${fmtMoney(state==='wealthy' ? 25_000_000 : 250_000, country, { compact:true })} into the 7-yr ${c.regulator.short} Treasury Bond at 13.25%. Income is taxed under ${c.tax.short} schedule — I can show you the after-tax math.`
    },
    { who:'imari', t:'10:43', kind:'actions', actions:['Show the math', 'Compare to T-Bill', 'Skip for now'] },
  ];

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%', paddingTop: 52, paddingBottom: 90, display:'flex', flexDirection:'column' }}>
      {/* Custom header */}
      <div className="row" style={{ padding: '12px 16px 14px', justifyContent:'space-between', borderBottom: '0.5px solid var(--line)', background: 'var(--paper)' }}>
        <div className="row" style={{ gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 11,
            background: 'linear-gradient(135deg, var(--brand), var(--brand-2))',
            color: 'var(--brand-ink)', display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:'Instrument Serif, serif', fontSize: 22,
          }}>✦</div>
          <div className="col" style={{ gap: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Imari Advisor</div>
            <div className="row" style={{ gap: 6, fontSize: 11, color:'var(--ink-3)' }}>
              <span style={{ width:6, height:6, borderRadius:999, background:'var(--up)' }}/>
              <span>AI · trained on {c.regulator.short} & {c.tax.short} rules</span>
            </div>
          </div>
        </div>
        <CountryChip country={country} onClick={onCountryClick} mini />
      </div>

      {/* Conversation */}
      <div className="col" style={{ gap: 10, padding: '14px 14px 18px', flex: 1 }}>
        <div className="row" style={{ justifyContent:'center', fontSize: 10, color:'var(--ink-4)', padding: '2px 0 8px' }}>
          Today · 10:42
        </div>

        {messages.map((m, i) => {
          if (m.who === 'imari') {
            return (
              <div key={i} className="col" style={{ alignItems:'flex-start', gap: 4, maxWidth: '86%' }}>
                {m.kind === 'card' ? (
                  <div style={{
                    padding: 14, borderRadius: '14px 14px 14px 4px',
                    background: 'var(--paper)', border: '1px solid var(--brand-soft)',
                    boxShadow: 'var(--shadow-1)',
                  }}>
                    <div className="row" style={{ gap: 6, fontSize: 10, color:'var(--down)', letterSpacing:'0.06em', textTransform:'uppercase', fontWeight: 600 }}>
                      ▲ insight
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>{m.card.title}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.4 }}>{m.card.body}</div>
                    <div className="row" style={{ gap: 14, marginTop: 10, paddingTop: 10, borderTop: '0.5px solid var(--line)' }}>
                      <div>
                        <div className="font-serif" style={{ fontSize: 22, color:'var(--brand)' }}>{m.card.stat}</div>
                        <div className="muted" style={{ fontSize: 10 }}>{m.card.statLabel}</div>
                      </div>
                      <div style={{ flex:1, color:'var(--brand)' }}>
                        <Sparkline data={[78, 76, 80, 78, 82, 78, 78]} w={120} h={32} stroke="var(--brand)" fill />
                      </div>
                    </div>
                  </div>
                ) : m.kind === 'actions' ? (
                  <div className="col" style={{ gap: 6, width: '100%' }}>
                    {m.actions.map((a, j) => (
                      <div key={a} style={{
                        padding: '10px 14px', borderRadius: 10,
                        background: j === 0 ? 'var(--brand)' : 'var(--paper)',
                        color: j === 0 ? 'var(--brand-ink)' : 'var(--brand)',
                        border: j === 0 ? '0' : '1px solid var(--brand-soft)',
                        fontSize: 13, fontWeight: 500, textAlign:'left',
                      }}>{a}</div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    padding: '10px 14px', borderRadius: '14px 14px 14px 4px',
                    background: 'var(--paper)', border: '0.5px solid var(--line)',
                    fontSize: 13, lineHeight: 1.45,
                  }}>{m.body}</div>
                )}
                <div className="muted" style={{ fontSize: 10, paddingLeft: 8 }}>Imari · {m.t}</div>
              </div>
            );
          }
          return (
            <div key={i} className="col" style={{ alignItems:'flex-end', gap: 4, maxWidth: '86%', alignSelf:'flex-end' }}>
              <div style={{
                padding: '10px 14px', borderRadius: '14px 14px 4px 14px',
                background: 'var(--brand)', color: 'var(--brand-ink)',
                fontSize: 13, lineHeight: 1.45,
              }}>{m.body}</div>
              <div className="muted" style={{ fontSize: 10 }}>{m.t}</div>
            </div>
          );
        })}
      </div>

      {/* Compose */}
      <div style={{ padding: '0 14px 12px' }}>
        <div className="row" style={{
          padding: '10px 12px', borderRadius: 22, background: 'var(--paper)',
          border: '0.5px solid var(--line)', gap: 10, alignItems:'center',
        }}>
          <span className="muted">＋</span>
          <span className="muted" style={{ flex: 1, fontSize: 13 }}>Ask anything about your money…</span>
          <span style={{
            width: 30, height: 30, borderRadius: 999, background:'var(--brand)', color:'var(--brand-ink)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize: 14,
          }}>↑</span>
        </div>
        <div className="muted" style={{ fontSize: 9, textAlign:'center', marginTop: 6, padding: '0 20px' }}>
          AI advice. Not human advisor. Compliant with {c.markets.short} robo-advisor guidance.
        </div>
      </div>

      <MobileTabBar active="advisor" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  INSIGHTS — Imari surfaces card stack
// ═══════════════════════════════════════════════════════════════
function InsightsScreen({ country = 'RW', state = 'typical', onCountryClick }) {
  const data = DATASETS[country][state];
  const insights = data.insights || [];

  const kindMeta = {
    warn: { color:'var(--down)', bg:'var(--down-soft)', label:'Watch out',     glyph:'▲' },
    good: { color:'var(--up)',   bg:'var(--up-soft)',   label:'On track',      glyph:'✓' },
    idea: { color:'var(--brand)',bg:'var(--brand-soft)',label:'Opportunity',   glyph:'✦' },
  };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%', paddingTop: 52, paddingBottom: 90 }}>
      <div className="row" style={{ padding: '14px 16px', justifyContent:'space-between' }}>
        <div>
          <div className="muted" style={{ fontSize: 12 }}>This week</div>
          <div className="font-serif" style={{ fontSize: 26 }}>Insights</div>
        </div>
        <CountryChip country={country} onClick={onCountryClick}/>
      </div>

      {/* Score card */}
      <div className="card" style={{ margin: '0 16px 14px', padding: 18, background: 'linear-gradient(180deg, var(--paper), var(--bg-2))' }}>
        <div className="row" style={{ justifyContent:'space-between' }}>
          <div>
            <div className="muted" style={{ fontSize: 11, letterSpacing:'0.06em', textTransform:'uppercase' }}>Financial health</div>
            <div className="font-serif" style={{ fontSize: 44, lineHeight: 1, marginTop: 4 }}>
              82<span className="muted" style={{ fontSize: 18 }}>/100</span>
            </div>
            <div className="row" style={{ gap: 6, marginTop: 8 }}>
              <span className="pill pill-up">▲ 4 this month</span>
              <span className="pill pill-soft">Strong</span>
            </div>
          </div>
          <div style={{ width: 100, height: 100, position:'relative' }}>
            <svg width="100" height="100" style={{ transform:'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r="42" stroke="var(--bg-2)" strokeWidth="8" fill="none"/>
              <circle cx="50" cy="50" r="42" stroke="var(--brand)" strokeWidth="8" fill="none"
                strokeDasharray={`${0.82 * 2 * Math.PI * 42} ${2 * Math.PI * 42}`} strokeLinecap="round"/>
            </svg>
          </div>
        </div>
        <div className="hr" style={{ margin: '14px 0' }}/>
        <div className="row" style={{ justifyContent:'space-between', fontSize: 11 }}>
          {[
            ['Savings rate', '32%', 'var(--up)'],
            ['Debt ratio',   '8%',  'var(--up)'],
            ['Diversified',  '64%', 'var(--gold)'],
            ['Emergency',    '75%', 'var(--up)'],
          ].map(([l, v, c]) => (
            <div key={l} className="col" style={{ gap: 2, alignItems:'center' }}>
              <div className="num" style={{ fontWeight: 600, color: c, fontSize: 13 }}>{v}</div>
              <div className="muted" style={{ fontSize: 10 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Insight cards */}
      <div className="col" style={{ gap: 10, padding: '0 16px 14px' }}>
        {insights.map((ins, i) => {
          const meta = kindMeta[ins.kind];
          return (
            <div key={i} className="card" style={{ padding: 16 }}>
              <div className="row" style={{ gap: 8, alignItems:'flex-start' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, background: meta.bg, color: meta.color,
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize: 14, fontWeight: 600, flexShrink: 0,
                }}>{meta.glyph}</div>
                <div className="col" style={{ flex: 1, gap: 4 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: meta.color, textTransform:'uppercase', letterSpacing:'0.06em' }}>{meta.label}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.3 }}>{ins.title}</div>
                  <div className="muted" style={{ fontSize: 12, lineHeight: 1.45 }}>{ins.body}</div>
                  <div className="row" style={{ gap: 8, marginTop: 8 }}>
                    <span style={{ padding: '5px 10px', borderRadius: 8, background: meta.bg, color: meta.color, fontSize: 11, fontWeight: 500 }}>
                      {ins.kind === 'warn' ? 'Adjust' : ins.kind === 'idea' ? 'Explore' : 'Continue'}
                    </span>
                    <span style={{ padding: '5px 10px', fontSize: 11, color: 'var(--ink-3)' }}>Dismiss</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <MobileTabBar active="more" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TAX & COUNTRY — Tax view per country
// ═══════════════════════════════════════════════════════════════
function TaxScreen({ country = 'RW', state = 'typical', onCountryClick }) {
  const c = COUNTRIES[country];
  const data = DATASETS[country][state];

  // Tax owed YTD estimate
  const yearlyIncome = data.monthlyIncome * 12 || 0;
  const monthlyIncome = data.monthlyIncome || 0;
  let taxYTD = 0;
  let prevBand = 0;
  c.taxBands.forEach(band => {
    const taxable = Math.max(0, Math.min(monthlyIncome, band.upTo) - prevBand);
    taxYTD += taxable * band.rate;
    prevBand = band.upTo;
  });
  const monthsElapsed = 5; // arbitrary
  taxYTD = taxYTD * monthsElapsed;

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%', paddingTop: 52, paddingBottom: 90 }}>
      <div className="row" style={{ padding: '14px 16px', justifyContent:'space-between' }}>
        <div>
          <div className="muted" style={{ fontSize: 12 }}>{c.tax.short} · 2025–26</div>
          <div className="font-serif" style={{ fontSize: 26 }}>Tax & rules</div>
        </div>
        <CountryChip country={country} onClick={onCountryClick}/>
      </div>

      {/* Country context strip */}
      <div className="card" style={{ margin: '0 16px 12px', padding: 14 }}>
        <div className="row" style={{ gap: 12, alignItems:'flex-start' }}>
          <div style={{ fontSize: 30 }}>{c.flag}</div>
          <div className="col" style={{ flex: 1, gap: 6 }}>
            <div className="font-serif" style={{ fontSize: 18, lineHeight: 1.1 }}>{c.name}</div>
            <div className="muted" style={{ fontSize: 11 }}>{c.capital} · {c.currency.code} ({c.currency.symbol})</div>
            <div className="row" style={{ gap: 4, marginTop: 4, flexWrap:'wrap' }}>
              {c.languages.slice(0, 3).map(l => (
                <span key={l} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, background:'var(--bg-2)', color:'var(--ink-3)' }}>{l}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* YTD tax owed */}
      <div className="card" style={{ margin: '0 16px 12px', padding: 18 }}>
        <div className="row" style={{ justifyContent:'space-between' }}>
          <div>
            <div className="muted" style={{ fontSize: 11, letterSpacing:'0.06em', textTransform:'uppercase' }}>Income tax YTD</div>
            <div className="font-serif" style={{ fontSize: 30, marginTop: 4 }}>{fmtMoney(Math.round(taxYTD), country, { compact:true })}</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>Withheld by employer (PAYE)</div>
          </div>
          <div className="col" style={{ alignItems:'flex-end' }}>
            <span className="pill pill-soft">Filed automatically</span>
          </div>
        </div>

        {/* Tax band visualisation */}
        <div style={{ marginTop: 16 }}>
          <div className="row" style={{ justifyContent:'space-between', marginBottom: 6, fontSize: 11, color:'var(--ink-3)' }}>
            <span>Your income</span><span className="num" style={{ color:'var(--ink-2)', fontWeight: 500 }}>{fmtMoney(monthlyIncome, country, { compact:true })} / mo</span>
          </div>
          <div style={{ position:'relative', height: 32, background:'var(--bg-2)', borderRadius: 8, overflow:'hidden' }}>
            {(() => {
              const max = c.taxBands[c.taxBands.length - 2]?.upTo * 1.3 || monthlyIncome * 1.3;
              return c.taxBands.map((b, i) => {
                const left = i === 0 ? 0 : c.taxBands[i - 1].upTo / max * 100;
                const right = Math.min(b.upTo / max * 100, 100);
                const w = right - left;
                if (w <= 0) return null;
                const intensity = 0.15 + (b.rate * 1.5);
                return (
                  <div key={i} style={{
                    position:'absolute', top: 0, bottom: 0, left: left + '%', width: w + '%',
                    background: `color-mix(in oklab, var(--brand) ${Math.min(intensity * 100, 90)}%, transparent)`,
                    borderRight: '1.5px solid var(--paper)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize: 10, fontWeight: 600, color: b.rate > 0.15 ? '#fff' : 'var(--ink)',
                  }}>{(b.rate * 100).toFixed(0)}%</div>
                );
              });
            })()}
            {(() => {
              const max = c.taxBands[c.taxBands.length - 2]?.upTo * 1.3 || monthlyIncome * 1.3;
              const pos = Math.min(monthlyIncome / max * 100, 99);
              return (
                <div style={{ position:'absolute', top:-4, bottom:-4, left: pos + '%', width: 2, background:'var(--ink)' }}>
                  <div style={{ position:'absolute', top:-14, left:-18, width: 38, fontSize: 9, textAlign:'center', color:'var(--ink)', fontWeight: 600 }}>You</div>
                </div>
              );
            })()}
          </div>
        </div>

        <div className="col" style={{ gap: 6, marginTop: 14 }}>
          {c.taxBands.map((b, i) => (
            <div key={i} className="row" style={{ justifyContent:'space-between', fontSize: 12 }}>
              <span className="muted">{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Regulator stack */}
      <SectionHead title="Who regulates you" />
      <div className="card" style={{ margin: '0 16px 14px', padding: '4px 0' }}>
        {[
          { r: c.regulator, role: 'Central bank, banking' },
          { r: c.markets,   role: 'Investments, advisor licensing' },
          { r: c.tax,       role: 'Income & capital gains tax' },
          { r: c.pension,   role: 'Mandatory pension' },
        ].map((row, i) => (
          <div key={row.r.short}>
            {i > 0 && <div className="hr" style={{ margin: '0 16px' }}/>}
            <div className="row" style={{ padding: '12px 14px', gap: 12 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 8, background:'var(--bg-2)', color:'var(--brand)',
                display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Instrument Serif, serif', fontSize: 15, fontWeight: 500,
              }}>{row.r.short}</div>
              <div className="col" style={{ flex: 1, gap: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{row.r.name}</div>
                <div className="muted" style={{ fontSize: 11 }}>{row.role}</div>
              </div>
              <div style={{ color:'var(--ink-3)' }}>↗</div>
            </div>
          </div>
        ))}
      </div>

      {/* Optimisation tip */}
      <div style={{ margin: '0 16px 14px', padding: 14, borderRadius: 14, background:'var(--gold-soft)', border:'1px solid var(--gold)' }}>
        <div className="row" style={{ gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 14 }}>◆</span>
          <span style={{ fontSize: 11, fontWeight: 600, color:'var(--gold)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Optimise</span>
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.45, color:'var(--ink-2)' }}>
          Voluntary <b>{c.pension.short}</b> contributions reduce taxable income. Adding {fmtMoney(50_000, country, { compact:true })}/mo could save you ~{fmtMoney(15_000, country, { compact:true })}/mo in tax.
        </div>
      </div>

      <MobileTabBar active="more" />
    </div>
  );
}

Object.assign(window, { AdvisorScreen, InsightsScreen, TaxScreen });
})();
