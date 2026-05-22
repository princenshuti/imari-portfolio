// portfolio-views.jsx — Dashboard, Assets, Trends, AI Advisor, Settings

(function(){
const { useState, useEffect, useMemo, useRef } = React;
const {
  CURRENCIES, CLASSES, FX, TREND_DOMAINS, KIGALI_NEIGHBOURHOODS,
  suggestValue, valueRWF, costRWF, fmt, fmtBase, toBase, fromBase,
  Sidebar, TopBar, AssetRow, AssetEditor, KPI, TrendCard,
  Sparkline, AreaChart, Donut, Field,
  exportJSON, importJSONFile,
} = window;

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════
function DashboardView({ state, dispatch }) {
  const { profile, assets } = state;
  const today = new Date();

  // Aggregate
  const stats = useMemo(() => {
    let totalValue = 0, totalCost = 0;
    const byGroup = {};
    assets.forEach(a => {
      const v = valueRWF(a, today);
      const c = costRWF(a);
      totalValue += v;
      totalCost += c;
      const cls = CLASSES.find(x => x.kind === a.kind) || CLASSES[CLASSES.length-1];
      const g = cls.group;
      if (!byGroup[g]) byGroup[g] = { group: g, value: 0, cost: 0, count: 0, color: cls.color };
      byGroup[g].value += v;
      byGroup[g].cost += c;
      byGroup[g].count += 1;
    });
    return {
      totalValue, totalCost, gain: totalValue - totalCost,
      gainPct: totalCost ? ((totalValue - totalCost) / totalCost * 100) : 0,
      groups: Object.values(byGroup).sort((a,b) => b.value - a.value),
    };
  }, [assets]);

  // Top movers
  const movers = useMemo(() => {
    return assets.map(a => {
      const cur = a.currentValue !== '' && a.currentValue != null ? a.currentValue : suggestValue(a, today);
      const pct = a.purchasePrice ? (cur - a.purchasePrice) / a.purchasePrice * 100 : 0;
      return { ...a, _current: cur, _pct: pct, _gain: cur - a.purchasePrice };
    }).sort((a,b) => Math.abs(b._pct) - Math.abs(a._pct)).slice(0, 4);
  }, [assets]);

  // Net worth synthetic trend (compose from group values + estimated past)
  const trend = useMemo(() => {
    const arr = [];
    for (let m = 24; m >= 0; m--) {
      const t = new Date(); t.setMonth(t.getMonth() - m);
      let v = 0;
      assets.forEach(a => {
        if (new Date(a.purchaseDate) > t) return;
        const snap = { ...a, currentValue: '' };
        v += toBase(suggestValue(snap, t), a.currency || 'RWF');
      });
      arr.push(Math.round(v));
    }
    return arr;
  }, [assets]);

  const watchlist = TREND_DOMAINS.slice(0, 4);

  return (
    <div style={{ padding: 28, background:'var(--bg)', minHeight:'calc(100vh - 70px)' }}>
      {/* Hero row */}
      <div style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Net worth */}
        <div className="card" style={{ padding: 24, gridColumn:'span 1' }}>
          <div className="row" style={{ justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div className="muted" style={{ fontSize: 11, letterSpacing:'0.06em', textTransform:'uppercase', fontWeight: 600 }}>Net worth</div>
              <div className="font-serif" style={{ fontSize: 50, lineHeight: 1, marginTop: 6, letterSpacing:'-0.02em' }}>
                {fmtBase(stats.totalValue, profile.displayCurrency, { compact: stats.totalValue > 1e8 })}
              </div>
              <div className="row" style={{ gap: 10, marginTop: 8 }}>
                <span className={`pill ${stats.gain >= 0 ? 'pill-up' : 'pill-down'}`}>
                  {stats.gain >= 0 ? '▲' : '▼'} {Math.abs(stats.gainPct).toFixed(1)}% all-time
                </span>
                <span className="num muted" style={{ fontSize: 12 }}>
                  {stats.gain >= 0 ? '+' : ''}{fmtBase(stats.gain, profile.displayCurrency, { compact: true })} vs. cost basis
                </span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 18, color:'var(--brand)' }}>
            <AreaChart data={trend} w={680} h={170} stroke="var(--brand)" accent="var(--brand)" />
          </div>
          <div className="row" style={{ justifyContent:'space-between', fontSize: 10, color:'var(--ink-4)', paddingTop: 4 }}>
            <span>24m ago</span><span>18m</span><span>12m</span><span>6m</span><span>Today</span>
          </div>
        </div>

        {/* Composition */}
        <div className="card" style={{ padding: 22 }}>
          <div className="font-serif" style={{ fontSize: 18, marginBottom: 14 }}>Composition</div>
          <div className="row" style={{ gap: 16, alignItems:'center' }}>
            <Donut size={120} thickness={16}
              slices={stats.groups.map(g => ({ value: g.value, color: g.color }))} />
            <div className="col" style={{ flex: 1, gap: 8 }}>
              {stats.groups.map(g => (
                <div key={g.group} className="row" style={{ gap: 8, fontSize: 12, justifyContent:'space-between' }}>
                  <div className="row" style={{ gap: 8, minWidth: 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: g.color, flexShrink: 0 }}/>
                    <span style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{g.group}</span>
                  </div>
                  <span className="num" style={{ color:'var(--ink-2)', fontWeight: 500 }}>
                    {(g.value / stats.totalValue * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* KPI stack */}
        <div className="col" style={{ gap: 16 }}>
          <KPI label="Cost basis"     value={fmtBase(stats.totalCost, profile.displayCurrency, { compact:true })} sub={`${assets.length} assets`} accent="var(--ink)" />
          <KPI label="Unrealised P/L" value={`${stats.gain >= 0 ? '+' : ''}${fmtBase(stats.gain, profile.displayCurrency, { compact:true })}`} sub={`${stats.gainPct.toFixed(1)}% vs cost`} accent={stats.gain >= 0 ? 'var(--up)' : 'var(--down)'} />
        </div>
      </div>

      {/* Top movers */}
      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <div className="row" style={{ justifyContent:'space-between', marginBottom: 14 }}>
          <div className="font-serif" style={{ fontSize: 20 }}>Top movers</div>
          <span className="muted" style={{ fontSize: 11 }}>Since purchase · biggest swings</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 12 }}>
          {movers.map(m => {
            const cls = CLASSES.find(c => c.kind === m.kind);
            return (
              <div key={m.id} style={{ padding: 14, borderRadius: 10, background:'var(--bg-2)' }}>
                <div className="row" style={{ gap: 8, marginBottom: 8 }}>
                  <span style={{ color: cls.color, fontSize: 16 }}>{cls.glyph}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', flex: 1 }}>{m.name}</span>
                </div>
                <div className="num" style={{ fontSize: 18, fontWeight: 600, color: m._pct >= 0 ? 'var(--up)' : 'var(--down)' }}>
                  {m._pct >= 0 ? '+' : ''}{m._pct.toFixed(1)}%
                </div>
                <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>
                  {m._pct >= 0 ? '+' : ''}{fmt(m._gain, m.currency, { compact: true })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Watchlist preview */}
      <div className="row" style={{ justifyContent:'space-between', marginBottom: 12 }}>
        <div className="font-serif" style={{ fontSize: 20 }}>Markets you watch</div>
        <span onClick={() => dispatch({ type:'nav', to:'trends' })} style={{ fontSize: 12, color:'var(--brand)', cursor:'pointer' }}>See all trends →</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
        {watchlist.map(d => <TrendCard key={d.id} d={d} />)}
      </div>

      {/* AI Advisor — auto-generated portfolio insight */}
      <DashboardInsight state={state} dispatch={dispatch} />
    </div>
  );
}

// ─── Auto-generated AI Advisor card for the dashboard ──────────
function DashboardInsight({ state, dispatch }) {
  const { profile, assets, insight } = state;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  // Compact snapshot used both to ask the AI and as a cache key
  const snapshot = useMemo(() => {
    const today = new Date();
    let totalRWF = 0, totalCost = 0;
    const byGroup = {};
    const items = assets.map(a => {
      const cls = CLASSES.find(c => c.kind === a.kind) || CLASSES[CLASSES.length-1];
      const cur = a.currentValue !== '' && a.currentValue != null ? a.currentValue : suggestValue(a, today);
      const vRWF = toBase(cur, a.currency || 'RWF');
      const cRWF = toBase(a.purchasePrice || 0, a.currency || 'RWF');
      totalRWF += vRWF; totalCost += cRWF;
      byGroup[cls.group] = (byGroup[cls.group] || 0) + vRWF;
      return {
        name: a.name, class: cls.label, group: cls.group, currency: a.currency,
        purchasePrice: a.purchasePrice, purchaseDate: a.purchaseDate,
        currentValue: Math.round(cur),
        gainPct: a.purchasePrice ? +((cur - a.purchasePrice) / a.purchasePrice * 100).toFixed(1) : 0,
        valueRWF: Math.round(vRWF),
      };
    });
    const compositionPct = Object.fromEntries(
      Object.entries(byGroup).map(([k, v]) => [k, +(v / (totalRWF || 1) * 100).toFixed(1)])
    );
    return {
      profile: { name: profile.name, displayCurrency: profile.displayCurrency },
      totals: {
        netWorthRWF: Math.round(totalRWF),
        costBasisRWF: Math.round(totalCost),
        unrealisedGainRWF: Math.round(totalRWF - totalCost),
        gainPct: totalCost ? +((totalRWF - totalCost) / totalCost * 100).toFixed(2) : 0,
      },
      compositionPct,
      assets: items,
    };
  }, [assets, profile]);

  const snapshotKey = useMemo(() => JSON.stringify(snapshot.totals) + ':' + assets.length, [snapshot, assets.length]);

  const generate = async () => {
    if (pending) return;
    setPending(true); setError(null);

    const prompt = `You are Imari Advisor, an AI financial assistant for ${profile.name || 'the user'} in Rwanda. You see their full portfolio below.

Write a SHORT dashboard insight (3 bullet points, max 1 sentence each, total under 80 words) that this person should know RIGHT NOW about THEIR portfolio. Be specific — cite actual asset names and concrete numbers from the data. Each bullet should fit one of:
  • a concentration / diversification observation
  • a top performer or laggard worth noting
  • one actionable next step (savings, tax, rebalance — grounded in Rwanda RRA/BNR/CMA rules)

Tone: warm, plain English, like a friend who's good with money. NO greeting. NO disclaimer. Start each bullet with "• " (bullet + space). Bold key numbers/names with **...**. Display amounts in ${profile.displayCurrency} unless quoting the asset's own currency.

PORTFOLIO DATA:
${JSON.stringify(snapshot, null, 2)}`;

    try {
      const reply = await window.claude.complete(prompt);
      dispatch({ type:'setInsight', insight: {
        content: reply.trim(),
        generatedAt: Date.now(),
        key: snapshotKey,
      }});
    } catch (e) {
      setError(e.message || 'Could not reach the AI service.');
    } finally {
      setPending(false);
    }
  };

  // Auto-generate on first visit (or when the snapshot key changes meaningfully)
  useEffect(() => {
    if (assets.length === 0) return;
    if (!insight || insight.key !== snapshotKey) {
      // Debounce slightly so rapid edits don't spam the model.
      const t = setTimeout(() => { generate(); }, 600);
      return () => clearTimeout(t);
    }
  }, [snapshotKey, assets.length]);

  if (assets.length === 0) return null;

  const stale = insight && insight.key !== snapshotKey;
  const bullets = insight?.content ? insight.content.split(/\n+/).filter(l => l.trim()) : [];

  return (
    <div className="card" style={{
      marginTop: 8, padding: 24,
      background: 'linear-gradient(135deg, var(--paper) 0%, var(--brand-soft) 140%)',
      border: '1px solid var(--brand-soft)',
    }}>
      <div className="row" style={{ justifyContent:'space-between', alignItems:'flex-start', marginBottom: 14 }}>
        <div className="row" style={{ gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background:'linear-gradient(135deg, var(--brand), var(--brand-2))',
            color:'var(--brand-ink)', display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:'Instrument Serif, serif', fontSize: 20,
          }}>✦</div>
          <div>
            <div className="font-serif" style={{ fontSize: 20, lineHeight: 1.1 }}>What I'm seeing in your portfolio</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
              Imari Advisor · auto-generated from your {assets.length} assets
              {insight?.generatedAt && !pending && !stale && ` · ${timeAgo(insight.generatedAt)}`}
              {stale && ' · portfolio changed — refreshing'}
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button onClick={generate} disabled={pending} title="Regenerate"
            style={{ padding:'7px 12px', borderRadius: 999, border:'1px solid var(--line)',
              background:'var(--paper)', cursor: pending ? 'default' : 'pointer',
              fontSize: 11, color:'var(--ink-3)', fontFamily:'inherit',
              opacity: pending ? 0.5 : 1 }}>
            ↻ Refresh
          </button>
          <button onClick={() => dispatch({ type:'nav', to:'advisor' })}
            style={{ padding:'7px 12px', borderRadius: 999, border:0,
              background:'var(--brand)', color:'var(--brand-ink)',
              cursor:'pointer', fontSize: 11, fontFamily:'inherit' }}>
            Open chat →
          </button>
        </div>
      </div>

      {pending && bullets.length === 0 && (
        <div className="col" style={{ gap: 10 }}>
          {[0, 1, 2].map(i => (
            <div key={i} className="row" style={{ gap: 10 }}>
              <span style={{ color:'var(--brand)', fontSize: 14, opacity: 0.4 }}>•</span>
              <div style={{
                flex: 1, height: 14, borderRadius: 4,
                background: 'linear-gradient(90deg, var(--bg-2) 0%, var(--brand-soft) 50%, var(--bg-2) 100%)',
                backgroundSize: '200% 100%',
                animation: 'imari-shimmer 1.6s infinite',
              }}/>
            </div>
          ))}
        </div>
      )}

      {!pending && error && (
        <div style={{ padding: 14, borderRadius: 10, background:'var(--down-soft)', color:'var(--down)', fontSize: 12.5, lineHeight: 1.5 }}>
          Couldn't generate insight: {error}. <span onClick={generate} style={{ textDecoration:'underline', cursor:'pointer' }}>Try again</span>.
        </div>
      )}

      {bullets.length > 0 && (
        <div className="col" style={{ gap: 10 }}>
          {bullets.map((line, i) => {
            const text = line.replace(/^[•\-\*]\s*/, '');
            return (
              <div key={i} className="row" style={{ gap: 12, alignItems:'flex-start' }}>
                <span style={{
                  flexShrink: 0, marginTop: 2,
                  width: 22, height: 22, borderRadius: 999,
                  background: 'var(--brand-soft)', color: 'var(--brand)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:'Geist Mono', fontSize: 11, fontWeight: 600,
                }}>{i + 1}</span>
                <div style={{ flex: 1, fontSize: 13.5, lineHeight: 1.55, color:'var(--ink)' }}
                  dangerouslySetInnerHTML={{ __html: renderMD(text) }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

// ═══════════════════════════════════════════════════════════════
//  ASSETS
// ═══════════════════════════════════════════════════════════════
function AssetsView({ state, dispatch }) {
  const { assets, profile } = state;
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const today = new Date();
  const groups = useMemo(() => {
    const out = {};
    assets.forEach(a => {
      const cls = CLASSES.find(c => c.kind === a.kind) || CLASSES[CLASSES.length-1];
      const g = cls.group;
      out[g] = out[g] || { group: g, color: cls.color, items: [], total: 0, cost: 0 };
      out[g].items.push(a);
      out[g].total += valueRWF(a, today);
      out[g].cost  += costRWF(a);
    });
    return Object.values(out).sort((a,b) => b.total - a.total);
  }, [assets]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return groups
      .map(g => ({ ...g, items: g.items.filter(a => {
        if (filter !== 'all' && (CLASSES.find(c => c.kind === a.kind)?.group !== filter)) return false;
        if (q && !a.name.toLowerCase().includes(q)) return false;
        return true;
      })}))
      .filter(g => g.items.length > 0);
  }, [groups, filter, search]);

  return (
    <div style={{ padding: 28, background:'var(--bg)', minHeight:'calc(100vh - 70px)' }}>
      {/* Toolbar */}
      <div className="row" style={{ gap: 10, marginBottom: 18 }}>
        <div className="row" style={{ flex: 1, padding: '9px 12px', borderRadius: 9, background:'var(--paper)', border:'1px solid var(--line)', gap: 8 }}>
          <span className="muted">⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets…" style={{
            flex: 1, border: 0, outline: 'none', background:'transparent', fontSize: 13, fontFamily:'inherit', color:'var(--ink)',
          }}/>
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{
          padding: '9px 12px', borderRadius: 9, border:'1px solid var(--line)', background:'var(--paper)', fontSize: 13, fontFamily:'inherit',
        }}>
          <option value="all">All classes</option>
          {Array.from(new Set(CLASSES.map(c => c.group))).map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <button onClick={() => setEditing({})} className="btn btn-primary">＋ Add asset</button>
      </div>

      {/* Asset groups */}
      {filtered.map(g => (
        <div key={g.group} className="card" style={{ marginBottom: 14, padding: 0 }}>
          <div className="row" style={{ padding: '16px 22px', justifyContent:'space-between' }}>
            <div className="row" style={{ gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: g.color }}/>
              <div className="font-serif" style={{ fontSize: 17 }}>{g.group}</div>
              <span className="pill pill-soft">{g.items.length}</span>
            </div>
            <div className="row" style={{ gap: 12, fontSize: 12 }}>
              <span className="muted">Cost · <span className="num" style={{ color:'var(--ink-2)' }}>{fmtBase(g.cost, profile.displayCurrency, { compact:true })}</span></span>
              <span className="muted">Today · <span className="num" style={{ color:'var(--ink)', fontWeight: 600 }}>{fmtBase(g.total, profile.displayCurrency, { compact:true })}</span></span>
              <span className={`pill ${g.total >= g.cost ? 'pill-up' : 'pill-down'}`} style={{ fontSize: 10 }}>
                {g.total >= g.cost ? '▲' : '▼'} {(((g.total - g.cost) / g.cost) * 100 || 0).toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="hr"/>
          <div className="row muted" style={{
            display:'grid', gridTemplateColumns:'2.3fr 1fr 1.2fr 1.2fr 0.9fr 60px',
            padding:'8px 22px', fontSize: 10, fontWeight: 600, letterSpacing:'0.06em', textTransform:'uppercase', gap: 12,
          }}>
            <span>Name</span><span>Bought</span><span>Today's value</span><span>In {profile.displayCurrency}</span><span style={{ textAlign:'right' }}>P/L</span><span></span>
          </div>
          <div className="hr"/>
          {g.items.map((a, i) => (
            <React.Fragment key={a.id}>
              {i > 0 && <div className="hr" style={{ margin: '0 22px' }}/>}
              <AssetRow asset={a} displayCurrency={profile.displayCurrency}
                onEdit={asset => setEditing(asset)}
                onDelete={asset => {
                  if (confirm(`Delete "${asset.name}"?`)) dispatch({ type:'deleteAsset', id: asset.id });
                }}
              />
            </React.Fragment>
          ))}
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="card" style={{ padding: 60, textAlign:'center' }}>
          <div className="font-serif" style={{ fontSize: 22, marginBottom: 8 }}>No assets yet</div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 18 }}>Start by adding your first asset — a plot, vehicle, savings account, or anything else.</div>
          <button onClick={() => setEditing({})} className="btn btn-primary">＋ Add your first asset</button>
        </div>
      )}

      {editing && <AssetEditor asset={editing}
        onSave={a => { dispatch({ type:'upsertAsset', asset: a }); setEditing(null); }}
        onCancel={() => setEditing(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TRENDS
// ═══════════════════════════════════════════════════════════════
function TrendsView({ state }) {
  const groups = useMemo(() => {
    const out = {};
    TREND_DOMAINS.forEach(d => { (out[d.group] = out[d.group] || []).push(d); });
    return out;
  }, []);

  return (
    <div style={{ padding: 28, background:'var(--bg)', minHeight:'calc(100vh - 70px)' }}>
      {/* Honest disclaimer */}
      <div className="card" style={{ padding: 14, marginBottom: 18, borderLeft:'3px solid var(--gold)' }}>
        <div className="row" style={{ gap: 10 }}>
          <span style={{ fontSize: 18, color:'var(--gold)' }}>◆</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Values are illustrative</div>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 2, lineHeight: 1.45 }}>
              This personal portal runs entirely in your browser and can't reliably fetch live market data.
              The series below are synthesised so the trends and shapes are realistic, but the absolute numbers
              are placeholders. Replace them by updating your asset's "last price" or yield.
            </div>
          </div>
        </div>
      </div>

      {Object.entries(groups).map(([groupName, domains]) => (
        <div key={groupName} style={{ marginBottom: 22 }}>
          <div className="row" style={{ justifyContent:'space-between', marginBottom: 12 }}>
            <div className="font-serif" style={{ fontSize: 20 }}>{groupName}</div>
            <span className="muted" style={{ fontSize: 11 }}>{domains.length} indicators</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 14 }}>
            {domains.map(d => <TrendCard key={d.id} d={d} big />)}
          </div>
        </div>
      ))}

      {/* Kigali real-estate detail */}
      <div className="card" style={{ padding: 22, marginTop: 8 }}>
        <div className="row" style={{ justifyContent:'space-between', marginBottom: 14 }}>
          <div>
            <div className="font-serif" style={{ fontSize: 20 }}>Kigali real-estate · per neighbourhood</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>Indicative price per m² · sorted by value</div>
          </div>
          <span className="pill pill-soft">illustrative</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap: 10 }}>
          {KIGALI_NEIGHBOURHOODS.sort((a,b) => b.pricePerSqm - a.pricePerSqm).map(n => (
            <div key={n.name} className="row" style={{ padding: '12px 14px', borderRadius: 9, background:'var(--bg-2)', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{n.name}</div>
                <div className="muted" style={{ fontSize: 11 }}>per m²</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div className="num" style={{ fontSize: 14, fontWeight: 600 }}>{fmt(n.pricePerSqm, 'RWF', { compact: true })}</div>
                <div className="num" style={{ fontSize: 10, color: n.change >= 0 ? 'var(--up)' : 'var(--down)' }}>{n.change >= 0 ? '▲' : '▼'} {Math.abs(n.change)}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  AI ADVISOR
// ═══════════════════════════════════════════════════════════════
function AdvisorView({ state, dispatch }) {
  const { profile, assets, chat } = state;
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chat, pending]);

  const portfolioContext = useMemo(() => {
    const today = new Date();
    const totalRWF = assets.reduce((s, a) => s + valueRWF(a, today), 0);
    const totalCost = assets.reduce((s, a) => s + costRWF(a), 0);
    return {
      profile: { name: profile.name || 'the user', displayCurrency: profile.displayCurrency },
      totals: {
        netWorthRWF: Math.round(totalRWF),
        costBasisRWF: Math.round(totalCost),
        unrealisedGainRWF: Math.round(totalRWF - totalCost),
        gainPct: totalCost ? +((totalRWF - totalCost) / totalCost * 100).toFixed(2) : 0,
      },
      assets: assets.map(a => {
        const cls = CLASSES.find(c => c.kind === a.kind);
        const cur = a.currentValue !== '' && a.currentValue != null ? a.currentValue : suggestValue(a, today);
        return {
          name: a.name, class: cls.label, group: cls.group,
          currency: a.currency,
          purchasePrice: a.purchasePrice,
          purchaseDate: a.purchaseDate,
          currentValue: cur,
          gainPct: a.purchasePrice ? +((cur - a.purchasePrice) / a.purchasePrice * 100).toFixed(2) : 0,
          ...(a.ticker && { ticker: a.ticker }),
          ...(a.shares && { shares: a.shares }),
          ...(a.units && { units: a.units }),
          ...(a.yieldPct && { yieldPct: a.yieldPct }),
          ...(a.neighbourhood && { neighbourhood: a.neighbourhood }),
        };
      }),
      country: 'Rwanda',
      regulators: { central: 'BNR', markets: 'CMA', tax: 'RRA', pension: 'RSSB' },
      taxNotes: 'RRA progressive PAYE: 0% up to 60k RWF/mo, 20% 60-100k, 30% above 100k. Capital gains on shares held <12mo. Govt bond interest favourably treated.',
    };
  }, [assets, profile]);

  const ask = async (question) => {
    if (!question.trim() || pending) return;
    const userMsg = { role: 'user', content: question, ts: Date.now() };
    dispatch({ type:'appendChat', msg: userMsg });
    setInput('');
    setPending(true);

    const systemPrompt = `You are Imari Advisor — an AI financial assistant for ${profile.name || 'the user'} in Rwanda.
You can see their full portfolio in the context below. Be concrete, cite the user's specific assets and numbers when relevant.
Reply in plain English, short paragraphs. Use Markdown-style **bold** for emphasis but no headings.
Display amounts in their primary currency (${profile.displayCurrency}) unless quoting an asset's own currency.
Be honest: Rwanda-specific regulations (BNR, CMA, RRA, RSSB) inform your reasoning. Not professional advice.
If asked about live market prices you don't have, say so and suggest the user update the asset's last price.

PORTFOLIO CONTEXT:
${JSON.stringify(portfolioContext, null, 2)}`;

    try {
      const reply = await window.claude.complete({
        messages: [
          ...chat.slice(-10).map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: `${systemPrompt}\n\nUSER QUESTION: ${question}` },
        ],
      });
      dispatch({ type:'appendChat', msg: { role:'assistant', content: reply, ts: Date.now() } });
    } catch (e) {
      dispatch({ type:'appendChat', msg: { role:'assistant', content: `I hit an error reaching the AI service: ${e.message}. Try again in a moment.`, ts: Date.now() } });
    } finally {
      setPending(false);
    }
  };

  const suggestions = [
    `What's my net worth right now and how is it split?`,
    `Which asset has gained the most since I bought it?`,
    `Am I too concentrated in any single asset?`,
    `Rough RRA tax exposure if I sold my BOK shares today?`,
    `How do I reach a net worth of 500M RWF by 2030?`,
  ];

  // Dynamic templates — group with categories, reference user's actual assets.
  const templates = useMemo(() => buildTemplates(assets, profile), [assets, profile]);

  return (
    <div style={{ background:'var(--bg)', height:'calc(100vh - 70px)', display:'flex', flexDirection:'column' }}>
      <div style={{ padding: '20px 28px 14px', borderBottom:'0.5px solid var(--line)', background:'var(--paper)' }}>
        <div className="row" style={{ gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 11,
            background:'linear-gradient(135deg, var(--brand), var(--brand-2))',
            color:'var(--brand-ink)', display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:'Instrument Serif, serif', fontSize: 24,
          }}>✦</div>
          <div className="col" style={{ gap: 2 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Imari Advisor</div>
            <div className="row" style={{ gap: 6, fontSize: 11, color:'var(--ink-3)' }}>
              <span style={{ width:6, height:6, borderRadius:999, background:'var(--up)' }}/>
              <span>Sees your {assets.length} assets · grounded in RW rules · not professional advice</span>
            </div>
          </div>
          <button onClick={() => dispatch({ type:'clearChat' })} className="btn btn-ghost" style={{ marginLeft:'auto', padding:'7px 12px', fontSize: 12 }}>
            ↻ New chat
          </button>
        </div>
      </div>

      {/* Body — chat on left, template sidebar on right */}
      <div className="row" style={{ flex: 1, minHeight: 0, alignItems:'stretch' }}>
        {/* Chat column */}
        <div className="col" style={{ flex: 1, minWidth: 0 }}>
          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY:'auto', padding: 24 }}>
            {chat.length === 0 && !pending && (
              <div style={{ maxWidth: 720, margin:'40px auto' }}>
                <div className="font-serif" style={{ fontSize: 32, lineHeight: 1.15, marginBottom: 14 }}>
                  Hi {profile.name?.split(' ')[0] || 'there'} — what would you like to know?
                </div>
                <div className="muted" style={{ fontSize: 13, marginBottom: 22, lineHeight: 1.5 }}>
                  I can see all {assets.length} of your assets and their current valuations. Pick a template from the right, or ask anything.
                </div>
                <div className="col" style={{ gap: 8 }}>
                  {suggestions.map(s => (
                    <div key={s} onClick={() => ask(s)} style={{
                      padding:'12px 14px', borderRadius: 10, background:'var(--paper)', border:'1px solid var(--line)',
                      cursor:'pointer', fontSize: 13, color:'var(--ink-2)', transition:'all .12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background='var(--brand-soft)'; e.currentTarget.style.borderColor='var(--brand)'; e.currentTarget.style.color='var(--brand)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background='var(--paper)'; e.currentTarget.style.borderColor='var(--line)'; e.currentTarget.style.color='var(--ink-2)'; }}
                    >→ {s}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="col" style={{ gap: 14, maxWidth: 780, margin:'0 auto' }}>
              {chat.map((m, i) => (
                <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth:'85%' }}>
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: m.role === 'user' ? 'var(--brand)' : 'var(--paper)',
                    color: m.role === 'user' ? 'var(--brand-ink)' : 'var(--ink)',
                    border: m.role === 'user' ? '0' : '1px solid var(--line)',
                    fontSize: 13.5, lineHeight: 1.55, whiteSpace:'pre-wrap',
                  }} dangerouslySetInnerHTML={{ __html: m.role === 'user' ? escapeHTML(m.content) : renderMD(m.content) }}/>
                </div>
              ))}
              {pending && (
                <div style={{ alignSelf:'flex-start', padding:'12px 16px', borderRadius:'14px 14px 14px 4px', background:'var(--paper)', border:'1px solid var(--line)' }}>
                  <div className="row" style={{ gap: 6 }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{
                        width: 6, height: 6, borderRadius: 999, background:'var(--brand)',
                        animation: `imari-dot 1.4s infinite ${i * 0.2}s`,
                      }}/>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Input */}
          <div style={{ padding: '16px 24px 20px', borderTop:'0.5px solid var(--line)', background:'var(--paper)' }}>
            <div style={{ maxWidth: 780, margin:'0 auto' }}>
              <form onSubmit={e => { e.preventDefault(); ask(input); }} className="row" style={{
                padding:'12px 16px', borderRadius: 14, background:'var(--bg-2)',
                border: '1px solid var(--line)', gap: 10,
              }}>
                <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask about your portfolio, taxes, goals…"
                  disabled={pending}
                  style={{ flex: 1, border: 0, outline:'none', background:'transparent', fontSize: 13.5, fontFamily:'inherit', color:'var(--ink)' }}/>
                <button type="submit" disabled={!input.trim() || pending} style={{
                  width: 32, height: 32, borderRadius: 999, border: 0,
                  background: input.trim() && !pending ? 'var(--brand)' : 'var(--ink-4)',
                  color:'var(--brand-ink)', cursor: input.trim() && !pending ? 'pointer' : 'default', fontSize: 16,
                }}>↑</button>
              </form>
              <div className="muted" style={{ fontSize: 10, textAlign:'center', marginTop: 8 }}>
                AI advice based on your portfolio data. Not professional financial advice.
              </div>
            </div>
          </div>
        </div>

        {/* Template sidebar */}
        <TemplateSidebar templates={templates} onPick={ask} disabled={pending} />
      </div>
    </div>
  );
}

// ─── Template sidebar ─────────────────────────────────────────
function TemplateSidebar({ templates, onPick, disabled }) {
  return (
    <div className="col" style={{
      width: 320, flexShrink: 0, borderLeft: '0.5px solid var(--line)',
      background: 'var(--paper)', overflowY: 'auto',
    }}>
      <div style={{ padding: '20px 20px 12px', borderBottom: '0.5px solid var(--line-soft)' }}>
        <div className="font-serif" style={{ fontSize: 17 }}>Ask Imari</div>
        <div className="muted" style={{ fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>
          Templates tailored to your portfolio. Click any to send.
        </div>
      </div>

      <div className="col" style={{ padding: '16px 16px 28px', gap: 18 }}>
        {templates.map(group => (
          <div key={group.label}>
            <div className="row" style={{ gap: 6, alignItems:'center', marginBottom: 8 }}>
              <span style={{ color: group.color, fontSize: 13 }}>{group.glyph}</span>
              <span className="muted" style={{ fontSize: 10, fontWeight: 600, letterSpacing:'0.08em', textTransform:'uppercase' }}>
                {group.label}
              </span>
            </div>
            <div className="col" style={{ gap: 5 }}>
              {group.items.map((q, i) => (
                <div key={i} onClick={() => !disabled && onPick(q)} style={{
                  padding: '9px 11px', borderRadius: 8,
                  background: 'var(--bg-2)', border:'1px solid transparent',
                  cursor: disabled ? 'default' : 'pointer',
                  fontSize: 12, color:'var(--ink-2)', lineHeight: 1.45,
                  transition: 'all .12s', opacity: disabled ? 0.5 : 1,
                }}
                onMouseEnter={e => { if (disabled) return; e.currentTarget.style.background='var(--brand-soft)'; e.currentTarget.style.borderColor='var(--brand)'; e.currentTarget.style.color='var(--brand)'; }}
                onMouseLeave={e => { e.currentTarget.style.background='var(--bg-2)'; e.currentTarget.style.borderColor='transparent'; e.currentTarget.style.color='var(--ink-2)'; }}
                >{q}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Build templates from the user's actual portfolio ─────────
function buildTemplates(assets, profile) {
  const today = new Date();
  const enriched = assets.map(a => {
    const cur = a.currentValue !== '' && a.currentValue != null ? a.currentValue : suggestValue(a, today);
    const pct = a.purchasePrice ? (cur - a.purchasePrice) / a.purchasePrice * 100 : 0;
    return { ...a, _pct: pct, _value: cur };
  });

  // Find specific assets to reference
  const topMover = [...enriched].sort((a,b) => b._pct - a._pct)[0];
  const worstMover = [...enriched].sort((a,b) => a._pct - b._pct)[0];
  const biggest = [...enriched].sort((a,b) => (b._value * (window.FX[b.currency]||1)) - (a._value * (window.FX[a.currency]||1)))[0];
  const stockAsset = enriched.find(a => a.kind === 'rse-equity' || a.kind === 'foreign-equity');
  const realestateAsset = enriched.find(a => a.kind === 'realestate-land' || a.kind === 'realestate-house');
  const cryptoAsset = enriched.find(a => a.kind === 'crypto');
  const livestockAsset = enriched.find(a => a.kind === 'livestock');
  const vehicleAsset = enriched.find(a => a.kind === 'vehicle');
  const bondAsset = enriched.find(a => a.kind === 'bond');

  const ref = (asset, fallback) => asset?.name || fallback;
  const cur = profile.displayCurrency || 'RWF';

  return [
    {
      label: 'Overview',
      glyph: '◐',
      color: 'var(--brand)',
      items: [
        `What's my net worth right now and how is it split?`,
        `Give me a one-paragraph summary of my financial health.`,
        biggest && `Why is **${biggest.name}** my biggest holding — should I be worried?`,
        `Compare my portfolio to a typical Rwandan middle-class household.`,
      ].filter(Boolean),
    },
    {
      label: 'Performance',
      glyph: '↗',
      color: 'var(--up)',
      items: [
        topMover && `${ref(topMover, 'Which asset')} has gained the most — is it likely to keep going?`,
        worstMover && worstMover._pct < 0 && `Why is ${ref(worstMover)} losing value — should I sell?`,
        `Rank my assets by total return since purchase.`,
        `Which class has performed best in the last year — real estate, stocks, or bonds?`,
        `What's my annualised return on the whole portfolio?`,
      ].filter(Boolean),
    },
    {
      label: 'Risk & diversification',
      glyph: '▲',
      color: 'var(--down)',
      items: [
        `Am I too concentrated in any single asset or class?`,
        biggest && `If ${ref(biggest)} lost half its value tomorrow, what happens to my net worth?`,
        `What's my biggest concentration risk right now?`,
        `Suggest a diversification move I could make this month.`,
        realestateAsset && `Is my real-estate exposure healthy or excessive?`,
      ].filter(Boolean),
    },
    {
      label: 'Tax (RRA)',
      glyph: '§',
      color: 'var(--gold)',
      items: [
        stockAsset && `Rough RRA tax if I sold all my ${ref(stockAsset)} today?`,
        `What's my approximate annual RRA tax exposure on capital gains?`,
        `How much can I deduct via voluntary RSSB contributions?`,
        bondAsset && `Is the interest on my ${ref(bondAsset)} taxable?`,
        `Are there RRA-deductible expenses I'm probably missing?`,
      ].filter(Boolean),
    },
    {
      label: 'Goals & planning',
      glyph: '⊛',
      color: 'var(--sky)',
      items: [
        `How do I reach a net worth of 500M ${cur} by 2030?`,
        `If I save 200,000 ${cur}/month, when do I hit 50M ${cur}?`,
        `Build a 12-month plan to grow my net worth 25%.`,
        `What's a realistic retirement target for someone my age in Rwanda?`,
        realestateAsset && `Can I afford a second property in Kacyiru in 3 years?`,
      ].filter(Boolean),
    },
    {
      label: 'Asset ideas',
      glyph: '✦',
      color: 'var(--plum)',
      items: [
        stockAsset && `Should I buy more ${ref(stockAsset)} or rotate into another RSE name?`,
        `What's a sensible next investment for me given my current mix?`,
        `Should I increase or decrease my crypto allocation?`,
        cryptoAsset && `Is ${ref(cryptoAsset)} worth holding for another year?`,
        vehicleAsset && `My ${ref(vehicleAsset)} keeps depreciating — is keeping it rational?`,
        livestockAsset && `Are my cattle a good store of value vs a fixed deposit?`,
      ].filter(Boolean),
    },
  ];
}

function escapeHTML(s) {
  return s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
function renderMD(s) {
  // very light markdown: **bold**, *italic*, line breaks
  return escapeHTML(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="font-family:Geist Mono;font-size:0.92em;padding:1px 4px;background:var(--bg-2);border-radius:3px">$1</code>');
}

// ═══════════════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════════════
function SettingsView({ state, dispatch }) {
  const fileRef = useRef(null);
  const [fxLocal, setFxLocal] = useState(state.fx);

  const onImport = async (file) => {
    try {
      const obj = await importJSONFile(file);
      if (confirm(`Import will replace your current data (${state.assets.length} assets → ${obj.assets.length}). Continue?`)) {
        dispatch({ type:'replaceAll', state: obj });
      }
    } catch (e) {
      alert('Import failed: ' + e.message);
    }
  };

  const handleSaveFx = () => {
    dispatch({ type:'setFx', fx: Object.fromEntries(Object.entries(fxLocal).map(([k,v]) => [k, +v || 1])) });
  };

  return (
    <div style={{ padding: 28, background:'var(--bg)', minHeight:'calc(100vh - 70px)', maxWidth: 820 }}>
      <Section title="Profile">
        <Field label="Your name (used in greetings)">
          <input value={state.profile.name} onChange={e => dispatch({ type:'setProfile', patch: { name: e.target.value } })}
            placeholder="e.g. Prince" style={{ width:'100%', padding:'10px 12px', borderRadius: 8, border:'1px solid var(--line)', background:'var(--paper-2)', fontSize: 13, fontFamily:'inherit', color:'var(--ink)' }}/>
        </Field>
        <Field label="Primary display currency" top={14}>
          <select value={state.profile.displayCurrency} onChange={e => dispatch({ type:'setProfile', patch: { displayCurrency: e.target.value } })}
            style={{ width:'100%', padding:'10px 12px', borderRadius: 8, border:'1px solid var(--line)', background:'var(--paper-2)', fontSize: 13, fontFamily:'inherit', color:'var(--ink)' }}>
            {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.label}</option>)}
          </select>
        </Field>
      </Section>

      <Section title="Exchange rates" subtitle="Edit if the FX values look off. All amounts convert via these rates.">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap: 12 }}>
          {CURRENCIES.filter(c => c.code !== 'RWF').map(c => (
            <Field key={c.code} label={`1 ${c.code} = ? RWF`} hint={c.label}>
              <input type="number" value={fxLocal[c.code]} onChange={e => setFxLocal(s => ({ ...s, [c.code]: e.target.value }))}
                style={{ width:'100%', padding:'10px 12px', borderRadius: 8, border:'1px solid var(--line)', background:'var(--paper-2)', fontSize: 13, fontFamily:'Geist Mono' }}/>
            </Field>
          ))}
        </div>
        <button onClick={handleSaveFx} className="btn btn-primary" style={{ marginTop: 14 }}>Save FX rates</button>
      </Section>

      <Section title="Backup & restore" subtitle="Your portfolio lives in this browser's storage. Export to back up, or import to restore on another device.">
        <div className="row" style={{ gap: 10, flexWrap:'wrap' }}>
          <button onClick={() => exportJSON(state)} className="btn btn-primary">↓ Export to JSON</button>
          <button onClick={() => fileRef.current?.click()} className="btn btn-ghost">↑ Import from JSON</button>
          <input ref={fileRef} type="file" accept="application/json" style={{ display:'none' }}
            onChange={e => e.target.files?.[0] && onImport(e.target.files[0])} />
        </div>
      </Section>

      <Section title="Danger zone">
        <button onClick={() => {
          if (confirm('Reset to seed assets? Your current data will be replaced.')) dispatch({ type:'reset' });
        }} className="btn btn-ghost">↻ Reset to sample portfolio</button>
        <button onClick={() => {
          if (confirm('Delete ALL your assets? This cannot be undone.')) dispatch({ type:'clearAssets' });
        }} className="btn btn-ghost" style={{ marginLeft: 8, color:'var(--down)', borderColor:'var(--down-soft)' }}>✕ Delete all assets</button>
      </Section>

      <div className="muted" style={{ fontSize: 11, marginTop: 30, padding: 16, background:'var(--bg-2)', borderRadius: 10, lineHeight: 1.55 }}>
        <strong>About Imari Portfolio.</strong> A personal asset & wealth tracker built for Rwanda. Data is stored
        only in this browser (LocalStorage) — nothing is sent to any server except when you ask the AI Advisor a
        question, in which case your portfolio is passed in as context. Use the export button to back up regularly.
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div className="font-serif" style={{ fontSize: 22, marginBottom: subtitle ? 4 : 14 }}>{title}</div>
      {subtitle && <div className="muted" style={{ fontSize: 12, marginBottom: 14, lineHeight: 1.5, maxWidth: 600 }}>{subtitle}</div>}
      <div className="card" style={{ padding: 22 }}>{children}</div>
    </div>
  );
}

// First-run name prompt
function NamePrompt({ onSubmit }) {
  const [name, setName] = useState('');
  return (
    <div style={{
      position:'fixed', inset: 0, background:'rgba(20,20,16,0.65)', backdropFilter:'blur(6px)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex: 2147483640,
    }}>
      <div className="card" style={{ padding: 32, width: '90%', maxWidth: 440, background:'var(--paper)' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, background:'var(--brand)', color:'var(--brand-ink)',
          display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Instrument Serif, serif', fontSize: 28, marginBottom: 16,
        }}>●</div>
        <div className="font-serif" style={{ fontSize: 32, lineHeight: 1.1, letterSpacing:'-0.02em' }}>Muraho.</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 6, marginBottom: 22, lineHeight: 1.5 }}>
          Welcome to your personal wealth portal. What should I call you?
        </div>
        <form onSubmit={e => { e.preventDefault(); if (name.trim()) onSubmit(name.trim()); }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
            autoFocus
            style={{ width:'100%', padding:'12px 14px', borderRadius: 9, border:'1px solid var(--line)', background:'var(--paper-2)', fontSize: 14, fontFamily:'inherit' }}/>
          <button type="submit" disabled={!name.trim()} className="btn btn-primary" style={{ width:'100%', marginTop: 12 }}>
            Continue →
          </button>
        </form>
        <div className="muted" style={{ fontSize: 10, marginTop: 14, textAlign:'center', lineHeight: 1.5 }}>
          Your data stays in this browser. Nothing leaves until you choose to back it up.
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardView, AssetsView, TrendsView, AdvisorView, SettingsView, NamePrompt });
})();
