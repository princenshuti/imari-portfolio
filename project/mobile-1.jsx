// mobile-1.jsx — Onboarding, Home, Budget
// Screens designed for 402 × ~788 inner area (within IOSDevice).
// All money/currency comes from window.fmtMoney(n, country).

(function(){
const { Sparkline, AreaChart, Donut, BudgetBar, CatGlyph, CAT_COLOR, CAT_GLYPH,
        Avatar, CountryChip, MobileTabBar, SectionHead, genSeries } = window;
const { COUNTRIES, DATASETS, fmtMoney, fmtPct } = window;

// ─── Greeting strip (shared) ──────────────────────────────────
function GreetStrip({ country, name, onCountryClick }) {
  const c = COUNTRIES[country];
  return (
    <div className="row" style={{ padding: '14px 16px 12px', justifyContent: 'space-between' }}>
      <div>
        <div className="muted" style={{ fontSize: 12 }}>{c.greeting},</div>
        <div className="font-serif" style={{ fontSize: 24, marginTop: 2, lineHeight: 1.1 }}>{name.split(' ')[0]}</div>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <CountryChip country={country} onClick={onCountryClick} />
        <Avatar name={name} size={36} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ONBOARDING — 3 cards stacked vertically to show the flow
// ═══════════════════════════════════════════════════════════════
function OnboardingScreen({ country = 'RW' }) {
  const c = COUNTRIES[country];
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%', paddingTop: 52 }}>
      {/* Step 1 — Welcome */}
      <div style={{
        margin: '0 16px 14px', padding: '32px 22px 26px', borderRadius: 22,
        background: 'linear-gradient(180deg, var(--brand) 0%, var(--brand-2) 100%)',
        color: 'var(--brand-ink)', position: 'relative', overflow: 'hidden',
      }}>
        {/* hill silhouettes */}
        <svg viewBox="0 0 400 80" style={{ position:'absolute', bottom:0, left:0, right:0, opacity:0.25 }}>
          <path d="M0 80 L0 50 Q40 20 80 40 T160 35 T240 30 T320 38 T400 32 L400 80 Z" fill="rgba(255,255,255,0.35)"/>
          <path d="M0 80 L0 65 Q60 45 120 55 T220 50 T320 55 T400 50 L400 80 Z" fill="rgba(255,255,255,0.5)"/>
        </svg>
        <div className="row" style={{ gap: 6, fontSize: 11, opacity: 0.85, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          <span>● imari</span>
          <span style={{ marginLeft:'auto', opacity: 0.7 }}>1 / 4</span>
        </div>
        <div className="font-serif" style={{ fontSize: 38, lineHeight: 1.05, marginTop: 16, letterSpacing: '-0.02em' }}>
          {c.greeting},<br/>let's grow your<br/><em style={{ fontStyle:'italic' }}>umutungo.</em>
        </div>
        <div style={{ marginTop: 14, fontSize: 13, opacity: 0.85, lineHeight: 1.5, maxWidth: 280, position:'relative' }}>
          Budget, invest and plan — all in {c.currency.code}, with rules written for {c.name}.
        </div>
      </div>

      {/* Step 2 — Connect */}
      <div className="card" style={{ margin: '0 16px 14px', padding: 18 }}>
        <div className="row" style={{ justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform:'uppercase' }}>Step 2 · Connect</div>
            <div className="font-serif" style={{ fontSize: 22, marginTop: 6 }}>Link your money</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>2 / 4</div>
        </div>
        <div className="col" style={{ gap: 8, marginTop: 14 }}>
          {[
            { name: 'MTN MoMo',         meta: 'Mobile money · most common', on: true },
            { name: 'Bank of Kigali',   meta: 'Current + savings',           on: true },
            { name: 'Airtel Money',     meta: 'Mobile money',                on: false },
            { name: 'I&M Bank',         meta: 'Current + investment',        on: false },
          ].map((b, i) => (
            <div key={i} className="row" style={{
              padding: '10px 12px', borderRadius: 12, border: '1px solid var(--line)',
              background: b.on ? 'var(--brand-soft)' : 'var(--paper)',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{b.name}</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 1 }}>{b.meta}</div>
              </div>
              <div style={{
                width: 22, height: 22, borderRadius: 999,
                border: b.on ? '0' : '1.5px solid var(--line)',
                background: b.on ? 'var(--brand)' : 'transparent', color: 'var(--brand-ink)',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize: 13,
              }}>{b.on && '✓'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Step 3 — Goal */}
      <div className="card" style={{ margin: '0 16px 14px', padding: 18 }}>
        <div className="row" style={{ justifyContent:'space-between' }}>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform:'uppercase' }}>Step 3 · Plan</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>3 / 4</div>
        </div>
        <div className="font-serif" style={{ fontSize: 22, marginTop: 6 }}>What are you saving for?</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8, marginTop: 14 }}>
          {[
            ['Down payment','◐', true],
            ['Education',  '▢', false],
            ['Emergency',  '◇', true],
            ['Retirement', '⊛', false],
            ['Business',   '◆', false],
            ['Travel',     '✈', false],
          ].map(([label, glyph, on]) => (
            <div key={label} className="col" style={{
              padding: 12, borderRadius: 12, border: '1px solid var(--line)',
              background: on ? 'var(--brand-soft)' : 'var(--paper)', gap: 4, alignItems:'flex-start',
              color: on ? 'var(--brand)' : 'var(--ink)',
            }}>
              <div style={{ fontSize: 22 }}>{glyph}</div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>
        <button className="btn btn-primary" style={{ width:'100%', marginTop: 16 }}>Continue · 3 of 4</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  HOME — overview dashboard
// ═══════════════════════════════════════════════════════════════
function HomeScreen({ country = 'RW', state = 'typical', onCountryClick }) {
  const data = DATASETS[country][state];
  const c = COUNTRIES[country];
  const trend = genSeries(30, data.networth * 0.92, 0.09, 0.02, 7);
  trend.push(data.networth);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%', paddingTop: 52, paddingBottom: 90 }}>
      <GreetStrip country={country} name={data.name} onCountryClick={onCountryClick} />

      {/* Net worth card */}
      <div className="card" style={{ margin: '0 16px 12px', padding: '18px 18px 12px' }}>
        <div className="row" style={{ justifyContent:'space-between' }}>
          <div className="muted" style={{ fontSize: 12 }}>Net worth</div>
          <div className="pill pill-up">▲ {fmtPct(2.4)} · 30d</div>
        </div>
        <div className="font-serif" style={{ fontSize: 38, marginTop: 4, letterSpacing: '-0.02em' }}>
          {fmtMoney(data.networth, country, { compact: state === 'wealthy' })}
        </div>
        <div className="row" style={{ gap: 16, marginTop: 12, fontSize: 11 }}>
          <Item label="Cash"        v={fmtMoney(data.cash, country, { compact:true })} dot="var(--sky)" />
          <Item label="Invested"    v={fmtMoney(data.invest, country, { compact:true })} dot="var(--brand)" />
          {data.property && <Item label="Property" v={fmtMoney(data.property, country, { compact:true })} dot="var(--gold)" />}
        </div>
        <div style={{ marginTop: 8, color: 'var(--brand)' }}>
          <AreaChart data={trend} w={370} h={70} stroke="var(--brand)" accent="var(--brand)" showGuides={false} />
        </div>
      </div>

      {/* Quick actions */}
      <div className="row" style={{ gap: 8, padding: '4px 16px 14px', overflowX:'auto' }}>
        {[
          ['Send', '↗'], ['Top up', '↘'], ['Invest', '◆'], ['Pay bill', '⌬'], ['Save', '⊛'],
        ].map(([l, g]) => (
          <div key={l} className="col" style={{
            padding: '10px 14px', borderRadius: 14, background: 'var(--paper)',
            border: '0.5px solid var(--line-soft)', gap: 4, alignItems:'center', minWidth: 70,
          }}>
            <div style={{ fontSize: 18, color:'var(--brand)' }}>{g}</div>
            <div style={{ fontSize: 11, fontWeight: 500 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* This month */}
      <SectionHead title="This month" action="View all →" />
      <div className="card" style={{ margin: '0 16px 12px', padding: 16 }}>
        <div className="row" style={{ justifyContent:'space-between' }}>
          <div>
            <div className="muted" style={{ fontSize: 11 }}>Spent</div>
            <div className="font-serif" style={{ fontSize: 22 }}>{fmtMoney(data.monthlySpend, country, { compact:true })}</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div className="muted" style={{ fontSize: 11 }}>Income</div>
            <div className="font-serif t-up" style={{ fontSize: 22 }}>{fmtMoney(data.monthlyIncome, country, { compact:true })}</div>
          </div>
        </div>
        <div style={{ marginTop: 10, position:'relative', height: 8, background:'var(--bg-2)', borderRadius: 999, overflow:'hidden' }}>
          {(() => {
            const cats = data.budget.slice(0, 5);
            const total = cats.reduce((s, c) => s + c.spent, 0);
            let acc = 0;
            return cats.map((cat, i) => {
              const w = (cat.spent / total) * 100;
              const el = <div key={i} style={{
                position:'absolute', top: 0, bottom: 0, left: acc + '%', width: w + '%',
                background: CAT_COLOR[cat.color] || CAT_COLOR[cat.cat] || 'var(--brand)',
                borderRight: '1.5px solid var(--paper)',
              }} />;
              acc += w;
              return el;
            });
          })()}
        </div>
        <div className="row" style={{ gap: 10, marginTop: 10, flexWrap:'wrap' }}>
          {data.budget.slice(0,4).map(b => (
            <div key={b.cat} className="row" style={{ gap: 4, fontSize: 11, color:'var(--ink-3)' }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: CAT_COLOR[b.color] || 'var(--brand)' }}/>
              {b.cat}
            </div>
          ))}
        </div>
      </div>

      {/* Goals preview */}
      {data.goals.length > 0 && <>
        <SectionHead title="Goals" action={`${data.goals.length} active`} />
        <div className="row" style={{ gap: 10, padding: '0 16px 12px', overflowX:'auto' }}>
          {data.goals.map(g => {
            const pct = Math.min(g.saved / g.target * 100, 100);
            const col = `var(--${g.color})`;
            return (
              <div key={g.id} className="card" style={{ padding: 14, minWidth: 180, maxWidth: 180 }}>
                <div className="row" style={{ justifyContent:'space-between' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: col }}/>
                  <span className="num" style={{ fontSize: 11, color: col, fontWeight: 600 }}>{pct.toFixed(0)}%</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, marginTop: 10, lineHeight: 1.3 }}>{g.label}</div>
                <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>by {g.by}</div>
                <div style={{ marginTop: 10, height: 4, background:'var(--bg-2)', borderRadius:999, overflow:'hidden' }}>
                  <div style={{ width: pct+'%', height:'100%', background: col, borderRadius: 999 }} />
                </div>
                <div className="num" style={{ fontSize: 11, marginTop: 8, color:'var(--ink-2)' }}>
                  {fmtMoney(g.saved, country, { compact:true })} <span className="muted">/ {fmtMoney(g.target, country, { compact:true })}</span>
                </div>
              </div>
            );
          })}
        </div>
      </>}

      {/* AI insight teaser */}
      {data.insights?.[0] && (
        <div style={{ margin: '0 16px 14px', padding: 14, borderRadius: 14,
          background: 'var(--paper)', border: '0.5px solid var(--line)' }}>
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--brand)', color: 'var(--brand-ink)',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize: 13, fontFamily:'Instrument Serif, serif' }}>✦</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing:'0.06em', textTransform:'uppercase' }}>Imari · insight</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.35 }}>{data.insights[0].title}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.4 }}>{data.insights[0].body}</div>
        </div>
      )}

      {/* Regulator footer */}
      <div className="muted row" style={{ fontSize: 10, gap: 8, padding: '12px 16px 80px', justifyContent:'center', textAlign:'center' }}>
        <span>● Regulated by {c.regulator.short}</span>
        <span>·</span>
        <span>{c.markets.short} licence #2018-44</span>
      </div>

      <MobileTabBar active="home" />
    </div>
  );
}

function Item({ label, v, dot }) {
  return (
    <div className="col" style={{ gap: 2 }}>
      <div className="row" style={{ gap: 5 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: dot }}/>
        <span className="muted">{label}</span>
      </div>
      <div className="num" style={{ fontSize: 13, color:'var(--ink)' }}>{v}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  BUDGET — categories tracker
// ═══════════════════════════════════════════════════════════════
function BudgetScreen({ country = 'RW', state = 'typical', onCountryClick }) {
  const data = DATASETS[country][state];
  const totalSpent = data.budget.reduce((s,b) => s + b.spent, 0);
  const totalBudget = data.budget.reduce((s,b) => s + b.budget, 0);
  const remaining = totalBudget - totalSpent;
  const pct = totalSpent / totalBudget * 100;
  const slices = data.budget.map(b => ({ color: `var(--${b.color})`, value: b.spent, label: b.cat }));

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%', paddingTop: 52, paddingBottom: 90 }}>
      <div className="row" style={{ padding: '14px 16px', justifyContent:'space-between' }}>
        <div className="font-serif" style={{ fontSize: 26 }}>Budget</div>
        <CountryChip country={country} onClick={onCountryClick}/>
      </div>

      {/* Month picker strip */}
      <div className="row" style={{ gap: 8, padding: '0 16px 14px', overflowX:'auto' }}>
        {['Apr','May','Jun'].map((m, i) => (
          <div key={m} className="col" style={{
            padding: '10px 16px', borderRadius: 10,
            background: i === 2 ? 'var(--ink)' : 'var(--paper)',
            color: i === 2 ? 'var(--paper)' : 'var(--ink-3)',
            border: i === 2 ? '0' : '0.5px solid var(--line)', fontSize: 12,
            alignItems:'center', gap: 2,
          }}>
            <span style={{ fontSize: 10, opacity: 0.7 }}>2026</span>
            <span style={{ fontWeight: 500 }}>{m}</span>
          </div>
        ))}
      </div>

      {/* Donut + key numbers */}
      <div className="card" style={{ margin: '0 16px 14px', padding: 18 }}>
        <div className="row" style={{ gap: 18, alignItems:'center' }}>
          <div style={{ position:'relative', width: 120, height: 120 }}>
            <Donut slices={slices} size={120} thickness={14} />
            <div style={{ position:'absolute', inset: 0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
              <div className="num" style={{ fontSize: 18, fontWeight: 600 }}>{pct.toFixed(0)}%</div>
              <div className="muted" style={{ fontSize: 10 }}>spent</div>
            </div>
          </div>
          <div className="col" style={{ gap: 10, flex: 1 }}>
            <div>
              <div className="muted" style={{ fontSize: 11 }}>Spent</div>
              <div className="font-serif" style={{ fontSize: 22 }}>{fmtMoney(totalSpent, country, { compact:true })}</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 11 }}>Left for June</div>
              <div className="font-serif t-brand" style={{ fontSize: 22 }}>{fmtMoney(remaining, country, { compact:true })}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Categories */}
      <SectionHead title="Categories" action="Edit" />
      <div className="card" style={{ margin: '0 16px 14px', padding: '4px 0' }}>
        {data.budget.map((b, i) => {
          const over = b.spent > b.budget;
          return (
            <div key={b.cat}>
              {i > 0 && <div className="hr" style={{ margin: '0 16px' }}/>}
              <div className="row" style={{ padding: '12px 14px', gap: 12 }}>
                <CatGlyph color={`var(--${b.color})`} glyph={CAT_GLYPH[b.cat] || '·'} size={32} />
                <div className="col" style={{ flex: 1, gap: 6 }}>
                  <div className="row" style={{ justifyContent:'space-between' }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{b.cat}</div>
                    <div className="num" style={{ fontSize: 13, color: over ? 'var(--down)' : 'var(--ink)' }}>
                      {fmtMoney(b.spent, country, { compact:true })}
                      <span className="muted" style={{ fontSize: 11 }}> / {fmtMoney(b.budget, country, { compact:true })}</span>
                    </div>
                  </div>
                  <BudgetBar spent={b.spent} budget={b.budget} color={`var(--${b.color})`} />
                  {over && <div className="t-down" style={{ fontSize: 10 }}>Over by {fmtMoney(b.spent - b.budget, country, { compact:true })}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI nudge */}
      <div style={{ margin: '0 16px 14px', padding: '14px 16px', borderRadius: 14,
        border: '1px dashed var(--brand)', background: 'var(--brand-soft)', color: 'var(--brand)' }}>
        <div className="row" style={{ gap: 8, marginBottom: 4 }}>
          <span style={{ fontFamily: 'Instrument Serif, serif', fontSize: 16 }}>✦</span>
          <span style={{ fontSize: 11, letterSpacing: '0.06em', textTransform:'uppercase', fontWeight: 600 }}>Imari suggests</span>
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.4 }}>
          Move {fmtMoney(17_000, country, { compact:true })} from <b>Eating out</b> to <b>Groceries</b> to align with last 3 months' pattern.
        </div>
      </div>

      <MobileTabBar active="budget" />
    </div>
  );
}

Object.assign(window, { OnboardingScreen, HomeScreen, BudgetScreen, GreetStrip });
})();
