import { useMemo } from 'react';
import { TREND_DOMAINS, KIGALI_NEIGHBOURHOODS, fmt } from '../data.js';
import { TrendCard } from '../components/Field.jsx';
import { useMarket } from '../contexts/MarketContext.jsx';

/** Count live domains from a given overrides map */
function countLive(overrides) {
  return Object.values(overrides).filter(o => o?.live).length;
}

export default function TrendsView({ state, dispatch }) {
  // Single source of truth — same `overrides` map Dashboard's watchlist reads from.
  // No more divergent USD/RWF rates between views.
  const { overrides, status, error: errorMsg, fetchedAt, refresh } = useMarket();
  const load = refresh;

  // Personal watchlist — domain IDs stored on profile. Star toggles in/out.
  // Watched cards float to the top of each group. (UX review #44.)
  const watchlist = state?.profile?.watchlist || [];
  const toggleWatch = (domainId) => {
    if (!dispatch) return;
    const next = watchlist.includes(domainId)
      ? watchlist.filter(x => x !== domainId)
      : [...watchlist, domainId];
    dispatch({ type: 'setProfile', patch: { watchlist: next } });
  };

  const groups = useMemo(() => {
    const out = {};
    TREND_DOMAINS.forEach(d => {
      (out[d.group] = out[d.group] || []).push(d);
    });
    return out;
  }, []);

  const liveCount = countLive(overrides);
  const totalLiveable = TREND_DOMAINS.filter(d => d.dataKind === 'live').length;

  function relativeTime(date) {
    if (!date) return '';
    const s = Math.floor((Date.now() - date) / 1000);
    if (s < 60)   return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
  }

  return (
    <div style={{ padding: 28, background: 'var(--bg)', minHeight: 'calc(100vh - 70px)' }}>

      {/* ── Status bar ──────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
        marginBottom: 18, padding: '12px 16px', borderRadius: 12,
        background: 'var(--paper)', border: '0.5px solid var(--line)',
        boxShadow: 'var(--shadow-1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>

          {/* Live indicators pill */}
          {status === 'loading' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'var(--ink-3)' }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: 'var(--ink-3)',
                animation: 'imari-dot-pulse 1.4s ease-in-out infinite',
              }} />
              Fetching live rates…
            </div>
          ) : liveCount > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%', background: 'var(--up)', flexShrink: 0,
                animation: 'imari-dot-pulse 2.4s ease-in-out infinite',
              }} />
              <span style={{ color: 'var(--up)', fontWeight: 700 }}>{liveCount} live</span>
              <span style={{ color: 'var(--ink-3)' }}>
                · {totalLiveable - liveCount > 0 ? `${totalLiveable - liveCount} unavailable · ` : ''}
                {fetchedAt ? `updated ${relativeTime(fetchedAt)}` : ''}
              </span>
            </div>
          ) : (
            <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'var(--gold-ink)' }}>
              <span aria-hidden="true" style={{ fontSize: 12 }}>◆</span>
              {errorMsg ? `${errorMsg} — showing reference values` : 'Live APIs unreachable — showing reference values'}
            </div>
          )}

          {/* Badge legend */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {[
              { label: 'Live',      bg: 'color-mix(in oklab, var(--up) 14%, transparent)',   color: 'var(--up)'   },
              { label: 'Reference', bg: 'color-mix(in oklab, var(--gold) 14%, transparent)', color: 'var(--gold)' },
              { label: 'Modeled',   bg: 'var(--bg-2)',                                        color: 'var(--ink-4)'},
            ].map(b => (
              <div key={b.label} style={{
                padding: '2px 8px', borderRadius: 20, fontSize: 9, fontWeight: 700,
                background: b.bg, color: b.color,
              }}>{b.label}</div>
            ))}
          </div>
        </div>

        <button
          onClick={() => load(true)}
          disabled={status === 'loading'}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 13px', borderRadius: 8, border: '1px solid var(--line)',
            background: 'transparent', cursor: status === 'loading' ? 'default' : 'pointer',
            fontSize: 11, color: 'var(--ink-2)', fontFamily: 'inherit',
            opacity: status === 'loading' ? 0.5 : 1,
            transition: 'background 0.14s, opacity 0.14s',
          }}
          onMouseEnter={e => { if (status !== 'loading') e.currentTarget.style.background = 'var(--bg-2)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ fontSize: 13, lineHeight: 1 }}>↻</span>
          Refresh
        </button>
      </div>

      {/* ── Data coverage note ────────────────────────────────────── */}
      <div style={{
        marginBottom: 20, padding: '12px 16px', borderRadius: 10,
        background: 'var(--bg-2)', fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.55,
      }}>
        <strong style={{ color: 'var(--ink-2)' }}>Data sources</strong>
        {' · '}
        <strong style={{ color: 'var(--up)' }}>Live</strong>: FX (ExchangeRate-API), Gold (metals.live), Crypto (CoinGecko)
        {' · '}
        <strong style={{ color: 'var(--gold)' }}>Reference</strong>: BNR repo rate, NISR CPI, RSE ASI, 10yr Treasury — no public APIs exist; values are manually sourced from official publications
        {' · '}
        <strong style={{ color: 'var(--ink-4)' }}>Modeled</strong>: Kigali RE (no official index)
      </div>

      {/* ── Indicator groups ──────────────────────────────────────── */}
      {Object.entries(groups).map(([groupName, domains]) => (
        <div key={groupName} style={{ marginBottom: 26 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="font-serif" style={{ fontSize: 20 }}>{groupName}</div>
            <span className="muted" style={{ fontSize: 11 }}>{domains.length} indicator{domains.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            {[...domains]
              .sort((a, b) => Number(watchlist.includes(b.id)) - Number(watchlist.includes(a.id)))
              .map(d => (
                <TrendCard
                  key={d.id}
                  d={d}
                  big
                  override={overrides[d.id] ?? null}
                  isWatched={watchlist.includes(d.id)}
                  onToggleWatch={toggleWatch}
                />
              ))}
          </div>
        </div>
      ))}

      {/* ── Kigali neighbourhoods ─────────────────────────────────── */}
      <div className="card" style={{ padding: 22, marginTop: 8 }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div className="font-serif" style={{ fontSize: 20 }}>Kigali real estate · by neighbourhood</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
              Indicative price per m² · no official source · community estimates
            </div>
          </div>
          <div style={{
            padding: '3px 9px', borderRadius: 20, fontSize: 9, fontWeight: 700,
            background: 'var(--bg-2)', color: 'var(--ink-4)',
          }}>Modeled</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {KIGALI_NEIGHBOURHOODS.sort((a, b) => b.pricePerSqm - a.pricePerSqm).map(n => (
            <div key={n.name} className="row" style={{
              padding: '12px 14px', borderRadius: 9, background: 'var(--bg-2)',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{n.name}</div>
                <div className="muted" style={{ fontSize: 11 }}>per m²</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="num" style={{ fontSize: 14, fontWeight: 600 }}>
                  {fmt(n.pricePerSqm, 'RWF', { compact: true })}
                </div>
                <div className="num" style={{
                  fontSize: 10,
                  color: n.change >= 0 ? 'var(--up)' : 'var(--down)',
                }}>
                  {n.change >= 0 ? '▲' : '▼'} {Math.abs(n.change)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Keyframe for live dot pulse ───────────────────────────── */}
      <style>{`
        @keyframes imari-dot-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.45; transform: scale(0.7); }
        }
      `}</style>
    </div>
  );
}
