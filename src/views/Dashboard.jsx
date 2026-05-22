import { useState, useEffect, useMemo } from 'react';
import { CLASSES, TREND_DOMAINS, valueRWF, costRWF, suggestValue, toBase, fmtBase, fmt } from '../data.js';
import { getApiKey, completeText } from '../ai.js';
import { AreaChart } from '../components/charts.jsx';
import { Donut } from '../components/charts.jsx';
import { KPI, TrendCard } from '../components/Field.jsx';

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

function renderMD(s) {
  const esc = s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  return esc
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function DashboardInsight({ state, dispatch }) {
  const { profile, assets, insight } = state;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

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
    const apiKey = getApiKey();
    if (!apiKey) {
      setError('Add your Anthropic API key in Settings to see AI insights.');
      return;
    }
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
      const reply = await completeText(apiKey, prompt);
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

  useEffect(() => {
    if (assets.length === 0) return;
    if (!getApiKey()) return;
    if (!insight || insight.key !== snapshotKey) {
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
          {error} {error.includes('Settings') ? null : <span onClick={generate} style={{ textDecoration:'underline', cursor:'pointer' }}>Try again</span>}
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

export default function DashboardView({ state, dispatch }) {
  const { profile, assets } = state;
  const today = new Date();

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

  const movers = useMemo(() => {
    return assets.map(a => {
      const cur = a.currentValue !== '' && a.currentValue != null ? a.currentValue : suggestValue(a, today);
      const pct = a.purchasePrice ? (cur - a.purchasePrice) / a.purchasePrice * 100 : 0;
      return { ...a, _current: cur, _pct: pct, _gain: cur - a.purchasePrice };
    }).sort((a,b) => Math.abs(b._pct) - Math.abs(a._pct)).slice(0, 4);
  }, [assets]);

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
      <div style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ padding: 24 }}>
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

        <div className="col" style={{ gap: 16 }}>
          <KPI label="Cost basis" value={fmtBase(stats.totalCost, profile.displayCurrency, { compact:true })} sub={`${assets.length} assets`} accent="var(--ink)" />
          <KPI label="Unrealised P/L" value={`${stats.gain >= 0 ? '+' : ''}${fmtBase(stats.gain, profile.displayCurrency, { compact:true })}`} sub={`${stats.gainPct.toFixed(1)}% vs cost`} accent={stats.gain >= 0 ? 'var(--up)' : 'var(--down)'} />
        </div>
      </div>

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

      <div className="row" style={{ justifyContent:'space-between', marginBottom: 12 }}>
        <div className="font-serif" style={{ fontSize: 20 }}>Markets you watch</div>
        <span onClick={() => dispatch({ type:'nav', to:'trends' })} style={{ fontSize: 12, color:'var(--brand)', cursor:'pointer' }}>See all trends →</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
        {watchlist.map(d => <TrendCard key={d.id} d={d} />)}
      </div>

      <DashboardInsight state={state} dispatch={dispatch} />
    </div>
  );
}
