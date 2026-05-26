import { Children, cloneElement, isValidElement, useId } from 'react';
import { Sparkline } from './charts.jsx';

export const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 'var(--r-sm)',
  border: '1px solid var(--line-strong)',
  background: 'var(--paper-2)', color: 'var(--ink)',
  fontFamily: 'inherit', fontSize: 13,
  transition: 'border-color 0.14s, box-shadow 0.14s',
};

export function Input({ value, onChange, type = 'text', placeholder, id, ...rest }) {
  return (
    <input
      type={type} value={value} id={id}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={inputStyle}
      {...rest}
    />
  );
}

/**
 * Field — wraps a label + input. Automatically generates an `id` and forwards
 * it to the child input so the <label htmlFor> association is correct for
 * screen readers (WCAG 1.3.1 Info & Relationships, 3.3.2 Labels).
 */
export function Field({ label, hint, children, top = 14, error }) {
  const fieldId = useId();
  const hintId  = `${fieldId}-hint`;
  const errId   = `${fieldId}-err`;

  // Inject id + aria-describedby + aria-invalid into the first valid React
  // element child (input/select/textarea). Callers can opt out by passing a
  // child with an explicit id, in which case we leave it untouched.
  const enhancedChildren = Children.map(children, child => {
    if (!isValidElement(child)) return child;
    const props = { ...child.props };
    if (!props.id) props.id = fieldId;
    const desc = [hint && hintId, error && errId].filter(Boolean).join(' ');
    if (desc) props['aria-describedby'] = desc;
    if (error) props['aria-invalid'] = true;
    return cloneElement(child, props);
  });

  return (
    <div style={{ marginTop: top }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <label htmlFor={fieldId} style={{
          fontSize: 11, fontWeight: 600, color: 'var(--ink-2)',
          letterSpacing: '0.02em',
        }}>{label}</label>
        {hint && <span id={hintId} className="muted" style={{ fontSize: 10 }}>{hint}</span>}
      </div>
      {enhancedChildren}
      {error && (
        <div id={errId} role="alert" style={{ fontSize: 11, color: 'var(--down)', marginTop: 4 }}>
          {error}
        </div>
      )}
    </div>
  );
}

export function KPI({ label, value, sub, accent = 'var(--brand)' }) {
  return (
    <div className="card-stat" style={{ '--stat-accent': accent }}>
      <div className="muted" style={{
        fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
      }}>{label}</div>
      <div className="font-serif" style={{
        fontSize: 26, marginTop: 6, letterSpacing: '-0.015em', lineHeight: 1,
        color: accent === 'var(--brand)' ? 'var(--ink)' : accent,
      }}>{value}</div>
      {sub && (
        <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{sub}</div>
      )}
    </div>
  );
}

/**
 * TrendCard renders one market indicator.
 * Props:
 *   d        — domain object from TREND_DOMAINS
 *   big      — larger layout (used on Trends page)
 *   override — live data from market.js: { value, change, live, source, fetchedAt }
 *              If null/undefined the domain's static values are used.
 */
export function TrendCard({ d, big = false, override = null, isWatched = false, onToggleWatch = null }) {
  // Merge live override on top of static domain data
  const value    = override?.value  ?? d.value;
  const change   = override?.change ?? d.change;
  const source   = override?.source ?? d.source;
  const isLive   = override?.live   ?? false;

  // Badge logic
  // 'live'      → green pill with pulsing dot
  // 'reference' → gold pill (uses --gold-ink for AA contrast)
  // 'modeled'   → muted pill
  const kind = isLive ? 'live' : (d.dataKind ?? 'modeled');
  const BADGE = {
    live:      { bg: 'color-mix(in oklab, var(--up) 14%, transparent)',   color: 'var(--up-ink)',   label: 'Live'      },
    reference: { bg: 'color-mix(in oklab, var(--gold) 14%, transparent)', color: 'var(--gold-ink)', label: 'Reference' },
    modeled:   { bg: 'var(--bg-2)',                                        color: 'var(--ink-3)',   label: 'Modeled'   },
  };
  const badge = BADGE[kind] || BADGE.modeled;

  const hasChange = change !== null && change !== undefined && !isNaN(change);
  const isUp = hasChange ? change >= 0 : true;

  return (
    <div className="card hover-lift" style={{ padding: big ? 20 : 16, position: 'relative', cursor: 'default' }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6, alignItems: 'center', gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)', flex: 1, minWidth: 0 }}>{d.label}</div>
        {onToggleWatch && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleWatch(d.id); }}
            aria-label={isWatched ? `Remove ${d.label} from watchlist` : `Add ${d.label} to watchlist`}
            title={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
            style={{
              background: 'transparent', border: 0, cursor: 'pointer', padding: 2,
              fontSize: 13, lineHeight: 1, color: isWatched ? 'var(--gold)' : 'var(--ink-4)',
              transition: 'color 160ms ease, transform 160ms cubic-bezier(0.23,1,0.32,1)',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <span aria-hidden="true">{isWatched ? '★' : '☆'}</span>
          </button>
        )}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '2px 7px', borderRadius: 20,
          background: badge.bg, fontSize: 9, fontWeight: 700, color: badge.color,
        }}>
          {kind === 'live' && (
            <span aria-hidden="true" style={{
              width: 5, height: 5, borderRadius: '50%', background: badge.color, flexShrink: 0,
              animation: 'imari-dot-pulse 2s ease-in-out infinite',
            }} />
          )}
          {badge.label}
        </div>
      </div>

      {override?.spread ? (
        // BNR FX card: Buy / Sell side-by-side as the primary display.
        // No "mid" rate shown — Buy is what the app uses for foreign→RWF totals,
        // Sell is what it uses for RWF→foreign payouts (see toBase/fromBase in data.js).
        <div
          style={{ display: 'flex', gap: big ? 28 : 20, alignItems: 'flex-end' }}
          title="Buy = bank buys foreign currency from you. Sell = bank sells foreign currency to you. Imari uses Buy for foreign→RWF totals and Sell for RWF→foreign payouts."
        >
          <div>
            <div className="muted" style={{
              fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em',
              textTransform: 'uppercase', marginBottom: 3, color: 'var(--ink-3)',
            }}>Buy</div>
            <div className="font-serif num" style={{
              fontSize: big ? 24 : 18, letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--ink)',
            }}>
              {override.spread.buy.toLocaleString('en-US', { maximumFractionDigits: 4 })}
            </div>
          </div>
          <div>
            <div className="muted" style={{
              fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em',
              textTransform: 'uppercase', marginBottom: 3, color: 'var(--ink-3)',
            }}>Sell</div>
            <div className="font-serif num" style={{
              fontSize: big ? 24 : 18, letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--ink)',
            }}>
              {override.spread.sell.toLocaleString('en-US', { maximumFractionDigits: 4 })}
            </div>
          </div>
        </div>
      ) : (
        <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
          <div className="font-serif num" style={{
            fontSize: big ? 28 : 20,
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}>
            {d.unit === '$' ? '$' : ''}
            {(value ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}
            {d.unit && d.unit !== '$' ? d.unit : ''}
          </div>
          {hasChange && (
            <div className="num" style={{
              fontSize: 11, fontWeight: 600,
              color: isUp ? 'var(--up-ink)' : 'var(--down-ink)',
            }}>
              <span aria-hidden="true">{isUp ? '▲' : '▼'}</span> {Math.abs(change).toFixed(2)}{d.unit === '%' ? 'pp' : '%'}
            </div>
          )}
          {!hasChange && kind === 'live' && (
            <div className="muted" style={{ fontSize: 10 }}>live rate</div>
          )}
        </div>
      )}

      <div style={{ marginTop: 8, color: d.color }} aria-hidden="true">
        <Sparkline data={d.series} w={big ? 240 : 160} h={big ? 40 : 30} stroke={d.color} fill />
      </div>
      <div className="muted" style={{ fontSize: 9.5, marginTop: 4, lineHeight: 1.4 }}>
        {source}
        {/* Per-indicator timestamp.
            - Live data → relative "Xm ago" from the fetch
            - Reference / modeled → static asOf string (last published period) */}
        {override?.fetchedAt && (
          <span style={{ marginLeft: 4, opacity: 0.6 }}>· {timeSince(override.fetchedAt)}</span>
        )}
        {!override?.fetchedAt && d.asOf && (
          <span style={{ marginLeft: 4, opacity: 0.6 }}>· {d.asOf}</span>
        )}
        {/* Modeled-indicator methodology disclosure — appears inline so users
            know exactly how the number was composed. Native <details> works
            without extra JS and keyboard-navigable for free. */}
        {d.methodology && (
          <details style={{ marginTop: 4 }}>
            <summary style={{ cursor: 'pointer', color: 'var(--brand)', fontSize: 9.5, fontWeight: 600 }}>
              How is this computed?
            </summary>
            <div style={{ marginTop: 4, padding: '6px 8px', background: 'var(--bg-2)', borderRadius: 4, whiteSpace: 'pre-line', fontSize: 9.5, lineHeight: 1.5, color: 'var(--ink-3)' }}>
              {d.methodology}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function timeSince(isoStr) {
  const s = Math.floor((Date.now() - new Date(isoStr)) / 1000);
  if (s < 60)   return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
