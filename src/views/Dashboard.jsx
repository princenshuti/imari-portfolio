import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CLASSES, TREND_DOMAINS, valueRWF, costRWF, suggestValue,
  toBase, fmtBase, fmt, GOAL_CATEGORIES,
  fixedAssetTax, VEHICLE_CATEGORIES, EXPENSE_CATEGORIES,
} from '../data.js';
import { getApiKey, completeText } from '../ai.js';
import { AreaChart, PortfolioChart, BenchmarkBar, Donut } from '../components/charts.jsx';
import { TrendCard } from '../components/Field.jsx';
import AssetIcon from '../components/AssetIcon.jsx';
import { filterByRange, calcReturn } from '../services/snapshots.js';
import { useMarket } from '../contexts/MarketContext.jsx';
import { monthlyPayment } from '../services/finance.js';
import { runInsights } from '../engine/insights/index.js';
import { SEVERITY_RANK } from '../engine/insights/_shared.js';
import { staleNetWorthInsight, netWorthAsOf } from '../engine/freshness.js';
import { REFERENCE } from '../engine/insights/refs.js';
import { projectPension } from '../engine/retirement/index.js';
import CostOfAbsence from '../components/CostOfAbsence.jsx';
import MetricWidget from '../components/MetricWidget.jsx';

// ─── Asset classification ──────────────────────────────────────────────────
// Liquid = cash or near-cash (withdrawable same-day)
const LIQUID_KINDS = new Set(['savings', 'momo-cash']);
// Maintenance-heavy = assets with ongoing upkeep costs
const MAINT_KINDS  = new Set(['realestate-house', 'realestate-land', 'vehicle', 'livestock']);

function isIncomeGenerating(a) {
  if (a.incomeGenerates) return true; // explicit user flag from AssetEditor
  if (a.kind === 'bond') return true;
  if ((a.kind === 'savings' || a.kind === 'receivable') && (a.yieldPct || 0) > 0) return true;
  if (a.kind === 'rse-equity' || a.kind === 'foreign-equity') return true;
  if (a.kind === 'realestate-house') return true; // assumed rental
  return false;
}

/** Return monthly income in RWF from an asset's incomeAmount/Frequency fields */
function assetMonthlyIncomeRWF(a) {
  if (!a.incomeGenerates || !a.incomeAmount || isNaN(+a.incomeAmount)) return 0;
  const base = toBase(+a.incomeAmount, a.incomeCurrency || a.currency || 'RWF');
  return a.incomeFrequency === 'annually' ? base / 12 : base;
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function renderMD(s) {
  const esc = s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  return esc
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

// ─── AI Insight card ──────────────────────────────────────────────────────
// The Insight Engine decides WHAT to surface (deterministic, testable); the AI
// only PHRASES it (§2 step 4). If the AI proxy is unreachable, the raw engine
// headlines still render — graceful degrade, never a blank card (NFR-REL-1).
function DashboardInsight({ state, dispatch, insights = [] }) {
  const { profile, insight } = state;
  const [pending, setPending] = useState(false);
  const [aiError, setAiError] = useState(false);

  // Cache key: re-narrate only when the engine's output actually changes.
  const insightsKey = useMemo(() => JSON.stringify(
    insights.map(i => [i.id, i.dataAsOf, i.costOfAbsence?.amount ?? null])
  ), [insights]);

  const INSIGHT_TTL_MS = 24 * 60 * 60 * 1000; // 24h hard refresh ceiling

  const generate = async () => {
    if (pending) return;
    const apiKey = getApiKey();
    if (!apiKey || insights.length === 0) return; // no key → fallback bullets render
    setPending(true); setAiError(false);
    const lines = insights.map((i, idx) =>
      `${idx + 1}. ${i.headline} — ${i.body}${i.costOfAbsence ? ` (cost if ignored: ${i.costOfAbsence.costStatement})` : ''}`
    ).join('\n');
    const prompt = `You are Imari Advisor for ${profile.name || 'the user'} in Rwanda. Below are factual insights ALREADY computed from their portfolio. The numbers are correct — do NOT change them and do NOT invent new ones.

Rewrite each insight as ONE short, warm, plain-English bullet (max one sentence, ~20 words). Keep the exact figures. Start each line with "• ". Bold the key number or name with **...**. No greeting, no preamble, no disclaimer.

INSIGHTS:
${lines}`;
    try {
      const reply = await completeText(apiKey, prompt);
      dispatch({ type: 'setInsight', insight: { content: reply.trim(), generatedAt: Date.now(), key: insightsKey } });
    } catch {
      setAiError(true); // fall back to raw engine bullets below
    } finally {
      setPending(false);
    }
  };

  useEffect(() => {
    if (insights.length === 0 || !getApiKey()) return;
    const expired = insight?.generatedAt && (Date.now() - insight.generatedAt > INSIGHT_TTL_MS);
    if (!insight || insight.key !== insightsKey || expired) {
      const t = setTimeout(() => generate(), 600);
      return () => clearTimeout(t);
    }
  }, [insightsKey, insights.length]);

  if (insights.length === 0) return null;

  const expired = insight?.generatedAt && (Date.now() - insight.generatedAt > INSIGHT_TTL_MS);
  const aiFresh = insight?.content && insight.key === insightsKey && !expired;
  const aiBullets = aiFresh ? insight.content.split(/\n+/).filter(l => l.trim()) : null;
  const hasKey = !!getApiKey();

  // Raw engine bullets — the deterministic fallback that always works.
  const engineBullets = insights.map(i => `${i.headline} — ${i.body}`);
  const bullets = aiBullets || engineBullets;
  const usingAI = !!aiBullets;

  let footnote;
  if (pending && !aiBullets) footnote = ' · personalizing…';
  else if (usingAI && insight?.generatedAt) footnote = ` · ${timeAgo(insight.generatedAt)}`;
  else if (aiError) footnote = ' · showing computed insights (AI unavailable)';
  else if (!hasKey) footnote = ' · connect AI in Settings to personalize';

  return (
    <div className="dash-insight-card" style={{
      marginBottom: 16, borderRadius: 'var(--r-xl)',
      background: 'linear-gradient(135deg, var(--paper) 0%, var(--brand-softer) 120%)',
      border: '0.5px solid var(--brand-soft)', boxShadow: 'var(--shadow-2)',
    }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div className="row" style={{ gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg, var(--brand), var(--brand-2))',
            color: 'var(--brand-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Instrument Serif, serif', fontSize: 22, boxShadow: 'var(--shadow-brand)',
          }}>✦</div>
          <div>
            <div className="font-serif" style={{ fontSize: 19, lineHeight: 1.1 }}>What I'm seeing in your portfolio</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
              Imari Advisor · {insights.length} insight{insights.length === 1 ? '' : 's'} from your data{footnote}
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: 6, flexShrink: 0 }}>
          {hasKey && (
            <button onClick={generate} disabled={pending} title="Regenerate" aria-label="Regenerate insight" style={{
              padding: '7px 12px', borderRadius: 'var(--r-pill)',
              border: '0.5px solid var(--line-strong)', background: 'var(--paper)',
              cursor: pending ? 'default' : 'pointer', fontSize: 11, color: 'var(--ink-3)',
              fontFamily: 'inherit', opacity: pending ? 0.7 : 1,
              transition: 'background 140ms ease-out, opacity 140ms ease-out',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <span className={`dash-refresh-icon${pending ? ' is-spinning' : ''}`} aria-hidden="true">↻</span>
              {pending ? 'Refreshing' : 'Refresh'}
            </button>
          )}
          <button onClick={() => dispatch({ type: 'nav', to: 'advisor' })} style={{
            padding: '7px 14px', borderRadius: 'var(--r-pill)',
            border: 0, background: 'var(--brand)', color: 'var(--brand-ink)',
            cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', boxShadow: 'var(--shadow-brand)',
          }}>Open chat →</button>
        </div>
      </div>
      <div className="col" style={{ gap: 10 }}>
        {bullets.map((line, i) => {
          const text = line.replace(/^[•\-\*]\s*/, '');
          return (
            <div key={i} className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
              <span style={{
                flexShrink: 0, marginTop: 2,
                width: 22, height: 22, borderRadius: '50%',
                background: 'var(--brand-soft)', color: 'var(--brand)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Geist Mono', fontSize: 11, fontWeight: 700,
              }}>{i + 1}</span>
              <div style={{ flex: 1, fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink)' }}
                dangerouslySetInnerHTML={{ __html: renderMD(text) }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

/** §9 — Idle-cash card: running forgone-yield counter + a CMA-licensed broker
 *  INTRODUCTION (referral only — Imari never executes a trade or moves money). */
function IdleCashCard({ insight, displayCurrency, now }) {
  const [showBroker, setShowBroker] = useState(false);
  const monthly = insight.costOfAbsence?.amount || 0;
  const days = insight.dataAsOf ? Math.max(0, Math.floor((now - new Date(insight.dataAsOf)) / 86400000)) : 0;
  const cumulative = (monthly / 30.44) * days;
  return (
    <div className="card dash-section-card" style={{ padding: '22px 24px' }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div className="font-serif" style={{ fontSize: 19 }}>Idle cash is costing you</div>
          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{insight.body}</div>
        </div>
        <span className="muted" style={{ fontSize: 9, padding: '3px 8px', borderRadius: 'var(--r-pill)', background: 'var(--bg-2)', border: '0.5px solid var(--line)', alignSelf: 'flex-start' }}>Reference yield</span>
      </div>
      <div className="row" style={{ gap: 22, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Forgone / month</div>
          <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--gold-ink, var(--gold))' }}>{fmtBase(monthly, displayCurrency, { compact: true })}</div>
        </div>
        {days > 0 && (
          <div>
            <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Forgone since {new Date(insight.dataAsOf).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--down)' }}>{fmtBase(cumulative, displayCurrency, { compact: true })}</div>
          </div>
        )}
      </div>
      <div style={{ marginTop: 16 }}>
        <button onClick={() => setShowBroker(v => !v)} style={{
          padding: '8px 16px', borderRadius: 'var(--r-pill)', border: 0,
          background: 'var(--brand)', color: 'var(--brand-ink)', cursor: 'pointer',
          fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
        }}>{showBroker ? 'Hide' : 'Request a broker introduction →'}</button>
        {showBroker && (
          <div role="region" style={{ marginTop: 12, padding: '14px 16px', borderRadius: 'var(--r-md)', background: 'var(--bg-2)', border: '0.5px solid var(--line)' }}>
            <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink-2)' }}>
              Imari can introduce you to a <strong>CMA-licensed intermediary</strong> who runs BNR Treasury-bill / bond auctions. This is an <strong>introduction only</strong> — Imari does not give investment advice, execute trades, or move your money. You deal with the broker directly and decide everything yourself.
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 10 }}>
              To proceed, contact your bank's treasury desk or a CMA-licensed broker. <em>Not professional financial advice.</em>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Single KPI tile in the executive strip — semantic <button> when clickable */
function KpiTile({ label, value, sub, accent, delay, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={onClick ? `${label}: ${value}. ${sub || ''}` : undefined}
      className={`dash-kpi-tile${onClick ? ' is-interactive' : ''}`}
      style={{
        padding: '16px 20px', borderRadius: 'var(--r-md)',
        background: 'var(--paper)', border: '0.5px solid var(--line)',
        boxShadow: 'var(--shadow-1)',
        animation: 'imari-slideUp 240ms cubic-bezier(0.23,1,0.32,1) both',
        animationDelay: `${delay}ms`,
        textAlign: 'left', fontFamily: 'inherit', width: '100%', display: 'block',
      }}
    >
      <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div className="num" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: accent || 'var(--ink)', lineHeight: 1.1 }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 10.5, marginTop: 5, lineHeight: 1.4 }}>{sub}</div>}
    </Tag>
  );
}

/** Horizontal ratio progress bar with label */
/**
 * Ratio bar with optional threshold markers.
 * `thresholds` is an array like [{at: 25, label: 'Low'}, {at: 55, label: 'Ample'}] —
 * tick marks render at those percentages with a tooltip label on hover so the
 * green/amber/red banding has explicit numerical anchors (UX review #14).
 */
function RatioBar({ label, value, color, hint, thresholds }) {
  const capped = Math.min(Math.max(value, 0), 100);
  const c = color || (capped > 55 ? 'var(--up)' : capped > 25 ? 'var(--gold)' : 'var(--down)');
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span className="muted" style={{ fontSize: 11.5 }}>{label}</span>
        <span className="num" style={{ fontSize: 13, fontWeight: 700, color: c }}>{value.toFixed(1)}%</span>
      </div>
      <div style={{ position: 'relative', height: 4, borderRadius: 2, background: 'var(--bg-2)', overflow: 'visible' }}>
        <div style={{
          height: '100%', width: capped + '%', background: c, borderRadius: 2,
          transition: 'width 0.6s cubic-bezier(0.23,1,0.32,1)',
        }} />
        {thresholds && thresholds.map(t => (
          <span
            key={t.at}
            title={`${t.label} threshold: ${t.at}%`}
            aria-label={`${t.label} threshold at ${t.at}%`}
            style={{
              position: 'absolute', top: -2, left: `${t.at}%`,
              width: 2, height: 8, background: 'var(--ink-3)', opacity: 0.5,
              borderRadius: 1, transform: 'translateX(-1px)', cursor: 'help',
            }}
          />
        ))}
      </div>
      {thresholds && (
        <div className="muted" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginTop: 3 }}>
          {thresholds.map(t => (
            <span key={t.at} style={{ flex: `0 0 ${t.at}%`, textAlign: 'right', paddingRight: 2 }}>{t.label} {t.at}%</span>
          ))}
        </div>
      )}
      {hint && <div className="muted" style={{ fontSize: 10, marginTop: 3, lineHeight: 1.4 }}>{hint}</div>}
    </div>
  );
}

/** 6-month income vs expense bar chart */
function IncomeTrendBars({ months, displayCurrency }) {
  const maxVal = Math.max(...months.map(m => Math.max(m.inc, m.exp)), 1);
  const hasData = months.some(m => m.inc > 0 || m.exp > 0);
  if (!hasData) return (
    <div style={{ height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-4)', fontSize: 12 }}>
      No cashflow data — add entries to see trends
    </div>
  );
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 72 }}>
        {months.map((m, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ width: '100%', display: 'flex', gap: 2, alignItems: 'flex-end', height: 56 }}>
              <div title={`Income: ${fmtBase(m.inc, displayCurrency, { compact: true })}`}
                style={{ flex: 1, background: 'var(--up)', borderRadius: '3px 3px 0 0', height: `${(m.inc / maxVal) * 100}%`, minHeight: m.inc > 0 ? 3 : 0, opacity: 0.75 }} />
              <div title={`Expenses: ${fmtBase(m.exp, displayCurrency, { compact: true })}`}
                style={{ flex: 1, background: 'var(--down)', borderRadius: '3px 3px 0 0', height: `${(m.exp / maxVal) * 100}%`, minHeight: m.exp > 0 ? 3 : 0, opacity: 0.75 }} />
            </div>
            <div style={{ fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.02em' }}>{m.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
        {[{ c: 'var(--up)', l: 'Income' }, { c: 'var(--down)', l: 'Expenses' }].map(x => (
          <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: x.c, opacity: 0.75 }} />
            <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{x.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Asset group performance — horizontal bars sorted by gain % */
function CategoryBars({ groups, totalValue }) {
  const maxAbs = Math.max(...groups.map(g => Math.abs(g.gainPct)), 0.1);
  return (
    <div className="col" style={{ gap: 13 }}>
      {groups.map((g, i) => {
        const isUp = g.gainPct >= 0;
        const barW = (Math.abs(g.gainPct) / maxAbs * 100).toFixed(1);
        const alloc = totalValue > 0 ? (g.value / totalValue * 100).toFixed(0) : '0';
        return (
          <div key={g.group} style={{
            animation: 'imari-slideUp 260ms cubic-bezier(0.23,1,0.32,1) both',
            animationDelay: `${i * 55}ms`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0, flex: 1 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: g.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{g.group}</span>
                <span className="muted" style={{ fontSize: 10 }}>{g.count} asset{g.count !== 1 ? 's' : ''} · {alloc}%</span>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                <span className="num" style={{ fontSize: 13, fontWeight: 700, color: isUp ? 'var(--up)' : 'var(--down)', minWidth: 72, textAlign: 'right' }}>
                  <span aria-hidden="true" style={{ marginRight: 3 }}>{isUp ? '▲' : '▼'}</span>{isUp ? '+' : ''}{g.gainPct.toFixed(1)}%
                </span>
              </div>
            </div>
            <div style={{ height: 5, background: 'var(--bg-2)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: barW + '%',
                background: isUp ? g.color : 'var(--down)', borderRadius: 3,
                transition: 'width 0.6s cubic-bezier(0.23,1,0.32,1)',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Asset card used in Top Gainers and Highest Depreciation */
function MoverCard({ asset, delay, onClick }) {
  const cls = CLASSES.find(c => c.kind === asset.kind) || CLASSES[CLASSES.length - 1];
  const isUp = asset._pct >= 0;
  const isInteractive = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isInteractive}
      aria-label={isInteractive ? `Open ${asset.name} in Assets` : undefined}
      className={isInteractive ? 'dash-mover-card' : undefined}
      style={{
        all: 'unset',
        boxSizing: 'border-box',
        display: 'block', width: '100%',
        padding: '14px 16px', borderRadius: 'var(--r-md)',
        background: isUp ? 'color-mix(in oklab, var(--up) 6%, var(--bg-2))' : 'color-mix(in oklab, var(--down) 6%, var(--bg-2))',
        border: `0.5px solid ${isUp ? 'color-mix(in oklab, var(--up) 18%, transparent)' : 'color-mix(in oklab, var(--down) 18%, transparent)'}`,
        animation: 'imari-slideUp 260ms cubic-bezier(0.23,1,0.32,1) both',
        animationDelay: `${delay}ms`,
        cursor: isInteractive ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <AssetIcon kind={asset.kind} color={cls.color} size={26} />
        <span style={{ fontSize: 12, fontWeight: 500, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--ink)' }}>{asset.name}</span>
      </div>
      <div className="num" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: isUp ? 'var(--up)' : 'var(--down)', lineHeight: 1 }}>
        <span aria-hidden="true" style={{ fontSize: 14, marginRight: 4 }}>{isUp ? '▲' : '▼'}</span>
        {isUp ? '+' : ''}{asset._pct.toFixed(1)}%
      </div>
      <div className="muted" style={{ fontSize: 10, marginTop: 4 }}>
        {isUp ? '+' : ''}{fmt(asset._gain, asset.currency, { compact: true })} · {cls.label}
      </div>
    </button>
  );
}

/** Compact alert row (concentration / risk / maintenance) */
function AlertCard({ title, accentColor, items, emptyHide, onNav, navLabel }) {
  if (emptyHide && items.length === 0) return null;
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: items.length > 0 ? 14 : 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: accentColor, flexShrink: 0 }} />
          <div className="font-serif" style={{ fontSize: 15 }}>{title}</div>
        </div>
        {onNav && (
          <button onClick={onNav} style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 11, color: 'var(--brand)', fontFamily: 'inherit', padding: 0 }}>
            {navLabel || 'View all →'}
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          <span style={{ color: 'var(--up)', marginRight: 6 }}>✓</span>No issues detected
        </div>
      ) : (
        <div className="col" style={{ gap: 9 }}>
          {items.map((item, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              paddingBottom: i < items.length - 1 ? 9 : 0,
              borderBottom: i < items.length - 1 ? '0.5px solid var(--line-soft)' : 'none',
              animation: 'imari-slideUp 240ms cubic-bezier(0.23,1,0.32,1) both',
              animationDelay: `${i * 45}ms`,
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0, flex: 1 }}>
                <AssetIcon kind={item.kind} size={20} color={accentColor} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                  {item.sub && <div className="muted" style={{ fontSize: 10, marginTop: 1 }}>{item.sub}</div>}
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: accentColor, flexShrink: 0, marginLeft: 8 }}>{item.badge}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Dashboard layout: drag-to-reorder + hideable sections ────────────────
const SECTION_META = {
  kpi:        { label: 'KPI Strip',              canHide: false },
  widgets:    { label: 'Key Metrics',             canHide: true  },
  hero:       { label: 'Portfolio Overview',      canHide: false },
  insight:    { label: 'AI Insight',              canHide: true  },
  retirement: { label: 'Retirement Readiness',     canHide: true  },
  idlecash:   { label: 'Idle Cash / T-Bill',       canHide: true  },
  financials: { label: 'Financial Monitoring',    canHide: true  },
  cashflow:   { label: 'Cash Flow by Category',    canHide: true  },
  macro:      { label: 'Personal Macro Overlay',   canHide: true  },
  chart:      { label: 'Net Worth Timeline',      canHide: true  },
  category:   { label: 'Category Performance',    canHide: true  },
  movers:     { label: 'Top Movers',              canHide: true  },
  alerts:     { label: 'Alerts',                  canHide: true  },
  benchmarks: { label: 'Benchmarks & Goals',      canHide: true  },
  markets:    { label: 'Markets Watchlist',       canHide: true  },
};
// "Am I OK?" (kpi+widgets+hero) → "What needs attention?" (alerts+insight) → "What
// changed?" (movers+chart) → "How am I positioned?" (financials+cashflow+macro+
// category+benchmarks) → "Markets".
const DEFAULT_SECTION_ORDER = ['kpi','widgets','hero','alerts','insight','retirement','idlecash','movers','chart','cashflow','financials','macro','category','benchmarks','markets'];

function useDashboardLayout() {
  const [order, setOrder] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('imari-dash-order') || 'null');
      if (Array.isArray(s) && s.every(x => DEFAULT_SECTION_ORDER.includes(x))) {
        // Append any sections added since this layout was saved so new features
        // (widgets, cashflow, macro…) appear instead of silently vanishing.
        const missing = DEFAULT_SECTION_ORDER.filter(x => !s.includes(x));
        return [...s, ...missing];
      }
    } catch {}
    return [...DEFAULT_SECTION_ORDER];
  });
  const [hidden, setHidden] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('imari-dash-hidden') || '[]');
      if (Array.isArray(s)) return new Set(s);
    } catch {}
    return new Set();
  });
  const [editMode, setEditMode] = useState(false);

  const reorder = useCallback((fromId, toId) => {
    setOrder(prev => {
      if (fromId === toId) return prev;
      const next = [...prev];
      const fi = next.indexOf(fromId), ti = next.indexOf(toId);
      if (fi < 0 || ti < 0) return prev;
      next.splice(fi, 1);
      next.splice(ti, 0, fromId);
      localStorage.setItem('imari-dash-order', JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleHide = useCallback((id) => {
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem('imari-dash-hidden', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const resetLayout = useCallback(() => {
    setOrder([...DEFAULT_SECTION_ORDER]);
    setHidden(new Set());
    localStorage.removeItem('imari-dash-order');
    localStorage.removeItem('imari-dash-hidden');
  }, []);

  return { order, hidden, editMode, setEditMode, reorder, toggleHide, resetLayout };
}

function SectionShell({ id, label, canHide, isHidden, hasData, editMode, onReorder, onToggleHide, children }) {
  const [dragOver, setDragOver] = useState(false);
  const collapsed = isHidden || !hasData;

  return (
    <div
      draggable={editMode}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('dash-section', id); }}
      onDragOver={(e) => { if (!editMode) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (!editMode) return;
        e.preventDefault(); setDragOver(false);
        const fromId = e.dataTransfer.getData('dash-section');
        if (fromId && fromId !== id) onReorder(fromId, id);
      }}
      onDragEnd={() => setDragOver(false)}
      style={{
        marginBottom: 16,
        outline: dragOver
          ? '2px solid var(--brand)'
          : editMode ? '1.5px dashed var(--line-strong)' : 'none',
        outlineOffset: 4,
        borderRadius: 12,
        transition: 'outline-color 0.1s ease',
        cursor: editMode ? 'grab' : 'default',
      }}
    >
      {/* Edit-mode drag handle strip */}
      {editMode && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px', marginBottom: collapsed ? 6 : 8,
          background: 'var(--paper)', border: '1px solid var(--line)',
          borderRadius: 8, userSelect: 'none',
          animation: 'imari-slideUp 0.16s cubic-bezier(0.23,1,0.32,1) both',
        }}>
          {/* 6-dot grip icon */}
          <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true">
            {[[3,2],[7,2],[3,7],[7,7],[3,12],[7,12]].map(([cx,cy],i) => (
              <circle key={i} cx={cx} cy={cy} r={1.5} fill="var(--ink-3)" />
            ))}
          </svg>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)', flex: 1 }}>{label}</span>
          {!hasData && <span style={{ fontSize: 10, color: 'var(--ink-4)', fontStyle: 'italic' }}>no data yet</span>}
          {canHide && hasData && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleHide(id); }}
              style={{
                fontSize: 10, padding: '3px 10px', borderRadius: 6,
                cursor: 'pointer', fontFamily: 'inherit',
                border: '1px solid',
                background: isHidden ? 'var(--brand-soft)' : 'var(--bg-2)',
                color:      isHidden ? 'var(--brand)'      : 'var(--ink-3)',
                borderColor: isHidden ? 'var(--brand)'     : 'transparent',
                transition: 'background 0.12s ease, color 0.12s ease, border-color 0.12s ease',
              }}
            >{isHidden ? '◎ Shown' : '◯ Hide'}</button>
          )}
          {!canHide && (
            <span style={{ fontSize: 10, color: 'var(--ink-4)', padding: '3px 10px' }}>always visible</span>
          )}
        </div>
      )}

      {/* Section content — animated collapse */}
      <div style={{
        overflow: 'hidden',
        maxHeight: collapsed ? 0 : 4000,
        opacity: collapsed ? 0 : 1,
        transition: 'max-height 0.3s cubic-bezier(0.23,1,0.32,1), opacity 0.22s ease-out',
        pointerEvents: collapsed ? 'none' : 'auto',
      }}>
        {children}
      </div>
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────
export default function DashboardView({ state, dispatch, netWorth: appNetWorth, totalCost: appTotalCost }) {
  const { profile, assets, snapshots = [], goals = [], liabilities = [], cashflows = [] } = state;
  const today = new Date();

  // ── Insight Engine + Cost-of-Absence (Phase 0 foundations) ────
  // The engine decides WHAT matters (deterministic, tested); the dashboard pins
  // the single highest-severity cost above the KPI strip and lets the AI card
  // narrate the rest. Dismissals are session-local — a cost re-surfaces on reload
  // or when the underlying data changes.
  const [dismissedCosts, setDismissedCosts] = useState(() => new Set());
  const engine = useMemo(
    () => runInsights(state, { now: today, dismissed: dismissedCosts }),
    [state, dismissedCosts],
  );
  const pinnedCost = useMemo(() => {
    const rank = c => SEVERITY_RANK[c?.costOfAbsence?.severity] || 0;
    const candidates = [engine.topCost, staleNetWorthInsight(state, { now: today })]
      .filter(Boolean)
      .filter(c => !dismissedCosts.has(c.id));
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => rank(b) - rank(a) || (b.costOfAbsence?.amount || 0) - (a.costOfAbsence?.amount || 0));
    return candidates[0];
  }, [engine, state, dismissedCosts]);
  const dismissCost = useCallback((id) => {
    setDismissedCosts(prev => new Set(prev).add(id));
  }, []);

  // Live market overrides for the "Markets you watch" watchlist. Reads from the
  // same context Trends uses, so USD/RWF (and crypto, gold, S&P) shows the same
  // value here and there — no more 1300-vs-1463 mismatch.
  const { overrides: marketOverrides } = useMarket();

  // ── Core portfolio stats ──────────────────────────────────────
  // Authoritative totals come from App.jsx via props (appNetWorth / appTotalCost)
  // so the sidebar and dashboard headline can never drift apart due to async
  // FX rate updates between renders. Per-group breakdowns still recompute
  // locally because they're sorted by relative size, not exact totals.
  const stats = useMemo(() => {
    let liquidValue = 0, incomeGenValue = 0;
    const byGroup = {};
    assets.forEach(a => {
      const v = valueRWF(a, today);
      const c = costRWF(a);
      if (LIQUID_KINDS.has(a.kind)) liquidValue += v;
      if (isIncomeGenerating(a))    incomeGenValue += v;
      const cls = CLASSES.find(x => x.kind === a.kind) || CLASSES[CLASSES.length - 1];
      const g = cls.group;
      if (!byGroup[g]) byGroup[g] = { group: g, value: 0, cost: 0, count: 0, color: cls.color };
      byGroup[g].value += v;
      byGroup[g].cost  += c;
      byGroup[g].count += 1;
    });
    const groups = Object.values(byGroup)
      .map(g => ({ ...g, gainPct: g.cost > 0 ? ((g.value - g.cost) / g.cost * 100) : 0 }))
      .sort((a, b) => b.value - a.value);
    // Pull canonical totals from App so sidebar + headline always agree.
    const debt = (state.liabilities || []).reduce((s, l) => s + toBase(l.remainingAmount || 0, l.currency || 'RWF'), 0);
    const totalValue = (appNetWorth ?? 0) + debt;       // gross value
    const totalCost  = appTotalCost ?? 0;
    const gain = totalValue - totalCost;
    return {
      totalValue, totalCost, gain,
      gainPct:       totalCost  ? (gain / totalCost * 100)          : 0,
      liquidityRatio: totalValue ? (liquidValue / totalValue * 100)   : 0,
      incomeGenRatio: totalValue ? (incomeGenValue / totalValue * 100): 0,
      liquidValue, incomeGenValue,
      groups,
    };
  }, [assets, appNetWorth, appTotalCost, state.liabilities]);

  // ── Liabilities & ratios ──────────────────────────────────────
  const totalDebt = useMemo(() =>
    liabilities.reduce((s, l) => s + toBase(l.remainingAmount || 0, l.currency || 'RWF'), 0),
  [liabilities]);
  const trueNetWorth  = stats.totalValue - totalDebt;
  const debtToAsset   = stats.totalValue > 0 ? (totalDebt / stats.totalValue * 100) : 0;

  // ── Cashflow: 6-month income trend + savings rate ─────────────
  const incomeTrend = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
      const y = d.getFullYear(), m = d.getMonth();
      let inc = 0, exp = 0;
      cashflows.forEach(cf => {
        const ed = new Date(cf.date);
        const applies = cf.recurring !== 'once'
          ? ed <= new Date(y, m + 1, 0)
          : ed.getFullYear() === y && ed.getMonth() === m;
        if (!applies) return;
        let ma;
        if (cf.recurring === 'monthly')   ma = toBase(cf.amount || 0, cf.currency || 'RWF');
        else if (cf.recurring === 'quarterly') ma = toBase(cf.amount || 0, cf.currency || 'RWF') / 3;
        else if (cf.recurring === 'annually')  ma = toBase(cf.amount || 0, cf.currency || 'RWF') / 12;
        else ma = toBase(cf.amount || 0, cf.currency || 'RWF');
        if (cf.type === 'income') inc += ma; else exp += ma;
      });
      return { label: d.toLocaleDateString('en-GB', { month: 'short' }), inc, exp, net: inc - exp };
    });
  }, [cashflows]);

  const totInc6M = incomeTrend.reduce((s, m) => s + m.inc, 0);
  const totExp6M = incomeTrend.reduce((s, m) => s + m.exp, 0);
  const savingsRate = totInc6M > 0 ? ((totInc6M - totExp6M) / totInc6M * 100) : null;

  // ── Financial Monitoring calculations ─────────────────────────
  const financialStats = useMemo(() => {
    // ① Monthly income by source — from recurring cashflows
    const incomeByCategory = {};
    cashflows.forEach(cf => {
      if (cf.type !== 'income') return;
      let monthly = 0;
      if (cf.recurring === 'monthly')        monthly = toBase(cf.amount || 0, cf.currency || 'RWF');
      else if (cf.recurring === 'quarterly') monthly = toBase(cf.amount || 0, cf.currency || 'RWF') / 3;
      else if (cf.recurring === 'annually')  monthly = toBase(cf.amount || 0, cf.currency || 'RWF') / 12;
      else return; // skip one-time cashflows from monthly income
      const cat = cf.category || 'other-inc';
      incomeByCategory[cat] = (incomeByCategory[cat] || 0) + monthly;
    });

    // ② Asset-derived income (from the new incomeGenerates field)
    let assetIncomeMonthly = 0;
    let passiveIncomeMonthly = 0;
    const assetIncomeByKind = {};
    assets.forEach(a => {
      const mo = assetMonthlyIncomeRWF(a);
      if (mo > 0) {
        assetIncomeMonthly += mo;
        const kindLabel = CLASSES.find(c => c.kind === a.kind)?.group || 'Other';
        assetIncomeByKind[kindLabel] = (assetIncomeByKind[kindLabel] || 0) + mo;
        // Passive = not salary/freelance
        passiveIncomeMonthly += mo;
      }
    });

    // Passive from cashflows (rental, dividends, bond-int)
    const passiveCfCats = new Set(['rental','dividends','bond-int']);
    Object.entries(incomeByCategory).forEach(([cat, mo]) => {
      if (passiveCfCats.has(cat)) passiveIncomeMonthly += mo;
    });

    const activeCfMonthly = Object.values(incomeByCategory).reduce((s, v) => s + v, 0);
    const totalMonthlyIncome = activeCfMonthly + assetIncomeMonthly;

    // Deduplicate: if an asset is both in cashflows (rental) AND incomeGenerates, don't double-count
    // For now, show them as separate sources with labels

    // ③ Passive income ratio
    const passiveIncomeRatio = totalMonthlyIncome > 0
      ? (passiveIncomeMonthly / totalMonthlyIncome * 100)
      : 0;

    // ④ Asset utilization rate — income-generating assets / total assets (by value)
    let utilizingValue = 0;
    assets.forEach(a => {
      if (isIncomeGenerating(a)) utilizingValue += valueRWF(a, today);
    });
    const assetUtilizationRate = stats.totalValue > 0
      ? (utilizingValue / stats.totalValue * 100)
      : 0;

    // ⑤ Return by asset class (annualized, value-weighted)
    const returnByClass = {};
    assets.forEach(a => {
      const cls = CLASSES.find(c => c.kind === a.kind) || CLASSES[CLASSES.length - 1];
      const v = valueRWF(a, today);
      const c = costRWF(a);
      if (!returnByClass[cls.group]) returnByClass[cls.group] = { value: 0, cost: 0, color: cls.color };
      returnByClass[cls.group].value += v;
      returnByClass[cls.group].cost  += c;
    });

    // ⑥ Maintenance obligations (assets with upkeep)
    const maintenanceCount = assets.filter(a => MAINT_KINDS.has(a.kind)).length;

    // ⑦ Monthly obligations from liabilities
    const monthlyObligations = liabilities.reduce((s, l) => {
      return s + toBase(l.monthlyPayment || 0, l.currency || 'RWF');
    }, 0);

    // ⑧ Net cash position
    const liquidRWF = assets
      .filter(a => LIQUID_KINDS.has(a.kind))
      .reduce((s, a) => s + valueRWF(a, today), 0);
    const netCashMonthly = totalMonthlyIncome - (totExp6M / 6);

    return {
      incomeByCategory,
      assetIncomeMonthly,
      assetIncomeByKind,
      totalMonthlyIncome,
      passiveIncomeMonthly,
      passiveIncomeRatio,
      assetUtilizationRate,
      returnByClass,
      maintenanceCount,
      monthlyObligations,
      liquidRWF,
      netCashMonthly,
    };
  }, [assets, cashflows, liabilities, stats.totalValue, totExp6M]);

  // ── Gainers & losers ──────────────────────────────────────────
  const moversAll = useMemo(() => assets.map(a => {
    const cur = a.currentValue !== '' && a.currentValue != null ? a.currentValue : suggestValue(a, today);
    const pct  = a.purchasePrice ? (cur - a.purchasePrice) / a.purchasePrice * 100 : 0;
    return { ...a, _current: cur, _pct: pct, _gain: cur - (a.purchasePrice || 0) };
  }), [assets]);
  const gainers = useMemo(() => [...moversAll].filter(a => a._pct > 0).sort((a, b) => b._pct - a._pct).slice(0, 4), [moversAll]);
  const losers  = useMemo(() => [...moversAll].filter(a => a._pct < 0).sort((a, b) => a._pct - b._pct).slice(0, 4), [moversAll]);

  // ── Alert signals ─────────────────────────────────────────────
  const concentrationAlerts = useMemo(() => {
    if (!stats.totalValue) return [];
    return moversAll
      .map(a => {
        const pct = valueRWF(a, today) / stats.totalValue * 100;
        return { ...a, _concPct: pct };
      })
      .filter(a => a._concPct > 25)
      .sort((a, b) => b._concPct - a._concPct)
      .map(a => ({
        name: a.name, kind: a.kind,
        badge: `${a._concPct.toFixed(0)}%`,
        sub: 'of portfolio — consider diversifying',
      }));
  }, [moversAll, stats.totalValue]);

  const riskAlerts = useMemo(() => {
    const alerts = [];
    moversAll.forEach(a => {
      if (a.kind === 'receivable' && a.dueDate) {
        const d = new Date(a.dueDate);
        if (d < today) alerts.push({ name: a.name, kind: a.kind, badge: `${Math.ceil((today - d) / 86400000)}d overdue`, sub: 'Receivable past due date' });
      }
      if (a.kind === 'bond' && a.maturity) {
        const d = new Date(a.maturity); const days = Math.ceil((d - today) / 86400000);
        if (days > 0 && days < 90) alerts.push({ name: a.name, kind: a.kind, badge: `${days}d left`, sub: 'Bond approaching maturity' });
      }
      if (a._pct < -20) alerts.push({ name: a.name, kind: a.kind, badge: `${a._pct.toFixed(0)}%`, sub: 'Significant unrealised loss' });
    });
    return alerts.slice(0, 5);
  }, [moversAll]);

  const maintenanceAssets = useMemo(() =>
    assets
      .filter(a => MAINT_KINDS.has(a.kind))
      .map(a => {
        const cls = CLASSES.find(c => c.kind === a.kind) || CLASSES[CLASSES.length - 1];
        return { name: a.name, kind: a.kind, badge: cls.label, sub: 'Ongoing upkeep required' };
      })
      .slice(0, 5),
  [assets]);

  // ── Portfolio trend (24-month synthetic) ──────────────────────
  const trend = useMemo(() => {
    const arr = [];
    for (let m = 24; m >= 0; m--) {
      const t = new Date(); t.setMonth(t.getMonth() - m);
      let v = 0;
      assets.forEach(a => {
        if (new Date(a.purchaseDate) > t) return;
        v += toBase(suggestValue({ ...a, currentValue: '' }, t), a.currency || 'RWF');
      });
      arr.push(Math.round(v));
    }
    return arr;
  }, [assets]);

  // ── Snapshot chart ────────────────────────────────────────────
  const [chartRange, setChartRange] = useState('3M');
  const chartSnaps = useMemo(() => filterByRange(snapshots, chartRange), [snapshots, chartRange]);
  const portfolioReturn = useMemo(() => calcReturn(chartSnaps), [chartSnaps]);
  // B11: same-period prior-year comparison + synthetic-seed honesty flag.
  const yearAgo = useMemo(() => {
    const sorted = [...(snapshots || [])].sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length < 2) return null;
    const last = sorted[sorted.length - 1];
    const targetMs = new Date(last.date).getTime() - 365 * 86400000;
    // Closest snapshot to one year before the latest.
    let best = null, bestGap = Infinity;
    for (const s of sorted) {
      const gap = Math.abs(new Date(s.date).getTime() - targetMs);
      if (gap < bestGap) { bestGap = gap; best = s; }
    }
    if (!best || bestGap > 75 * 86400000 || !best.netWorth) return null; // need a point near a year back
    const delta = last.netWorth - best.netWorth;
    return { delta, pct: (delta / best.netWorth) * 100, since: best.date, synthetic: !!best.synthetic };
  }, [snapshots]);
  const chartHasSynthetic = useMemo(() => chartSnaps.some(s => s.synthetic), [chartSnaps]);

  // ── B10: expense-by-category for the dashboard (matches Cash Flow module) ──
  const expenseByCategory = useMemo(() => {
    const monthIdx = (d) => d.getFullYear() * 12 + d.getMonth();
    const curM = monthIdx(today);
    const forMonth = (target) => {
      const cats = {};
      cashflows.forEach(cf => {
        if (cf.type !== 'expense') return;
        const d = new Date(cf.date);
        const dIdx = monthIdx(d);
        const base = toBase(cf.amount || 0, cf.currency || 'RWF');
        let amt = 0;
        if (cf.recurring && cf.recurring !== 'once') {
          if (dIdx <= target) amt = cf.recurring === 'quarterly' ? base / 3 : cf.recurring === 'annually' ? base / 12 : base;
        } else if (dIdx === target) {
          amt = base;
        }
        if (amt > 0) { const c = cf.category || 'other-exp'; cats[c] = (cats[c] || 0) + amt; }
      });
      return cats;
    };
    const cur = forMonth(curM);
    const prev = forMonth(curM - 1);
    const total = Object.values(cur).reduce((s, v) => s + v, 0);
    const rows = Object.entries(cur)
      .map(([id, amount]) => {
        const meta = EXPENSE_CATEGORIES.find(c => c.id === id);
        const prevAmt = prev[id] || 0;
        return {
          id, label: meta?.label || id, color: meta?.color || 'var(--ink-3)',
          amount, pct: total > 0 ? (amount / total) * 100 : 0,
          momPct: prevAmt > 0 ? ((amount - prevAmt) / prevAmt) * 100 : null,
        };
      })
      .sort((a, b) => b.amount - a.amount);
    return { rows, total };
  }, [cashflows]);

  // ── B17: personalized macro (NISR CPI Reference + Modeled category weights) ──
  const macroOverlay = useMemo(() => {
    const cpiDom = TREND_DOMAINS.find(d => d.id === 'cpi');
    const rseDom = TREND_DOMAINS.find(d => d.id === 'rse-asi');
    const headlineCpi = cpiDom?.value ?? 5.1;
    // Modeled per-category YoY inflation (illustrative; provenance = Modeled).
    const CAT_INFL = { food: 7, rent: 6, 'school-fees': 9, transport: 8, utilities: 5, healthcare: 6, insurance: 4, 'loan-repay': 0, 'sacco-cont': 0, entertainment: 5, 'bank-fees': 3, 'other-exp': 5 };
    let personalCpi = headlineCpi, personalized = false;
    if (expenseByCategory.total > 0) {
      personalCpi = expenseByCategory.rows.reduce(
        (s, r) => s + (r.amount / expenseByCategory.total) * (CAT_INFL[r.id] ?? headlineCpi), 0);
      personalized = true;
    }
    const rseAssets = assets.filter(a => a.kind === 'rse-equity');
    let rseGain = null;
    if (rseAssets.length) {
      const v = rseAssets.reduce((s, a) => s + valueRWF(a, today), 0);
      const c = rseAssets.reduce((s, a) => s + costRWF(a), 0);
      rseGain = c > 0 ? ((v - c) / c) * 100 : 0;
    }
    return {
      headlineCpi, personalCpi, personalized, cpiAsOf: cpiDom?.asOf,
      rseGain, rseChange: rseDom?.change ?? 0, rseAsOf: rseDom?.asOf,
      nominalYoY: yearAgo?.pct ?? null,
    };
  }, [assets, expenseByCategory, yearAgo]);

  const benchmarks = [
    { label: 'USD/RWF appreciation',   ret: 1.2 },
    { label: 'Rwanda CPI (inflation)', ret: 4.8 },
    { label: 'RSE All-Share Index',    ret: 6.2 },
    { label: 'BNR T-bond (13.5%/yr)', ret: chartRange === '1Y' ? 13.5 : chartRange === '6M' ? 6.75 : chartRange === '3M' ? 3.375 : 1.125 },
  ];

  const activeGoals = useMemo(() => goals.filter(g => !g.achieved).slice(0, 3), [goals]);
  const watchlist   = TREND_DOMAINS.slice(0, 4);
  const hasCF = cashflows.length > 0;
  const showAlerts = concentrationAlerts.length > 0 || riskAlerts.length > 0 || maintenanceAssets.length > 0;

  // ─── Layout state ──────────────────────────────────────────────
  const { order, hidden, editMode, setEditMode, reorder, toggleHide, resetLayout } = useDashboardLayout();

  // ─── Render ────────────────────────────────────────────────────

  // Section content map — values are null when data conditions not met
  const sectionContent = {
    // KPI strip. When debt exists, show Net worth / Gross portfolio / P/L / Savings.
    // When debt is zero, Net worth == Gross portfolio (same number) — collapse the
    // duplicate and promote "Liquid balance" so the strip carries 4 unique signals.
    kpi: (() => {
      const hasDebt = liabilities.length > 0;
      const tiles = [];
      tiles.push(
        <KpiTile
          key="nw"
          delay={0}
          label={hasDebt ? 'Net worth' : 'Portfolio value'}
          value={fmtBase(trueNetWorth, profile.displayCurrency, { compact: trueNetWorth > 1e8 })}
          sub={hasDebt ? `After ${fmtBase(totalDebt, profile.displayCurrency, { compact: true })} debt` : `${assets.length} asset${assets.length === 1 ? '' : 's'} · cost basis ${fmtBase(stats.totalCost, profile.displayCurrency, { compact: true })}`}
          accent="var(--ink)"
        />
      );
      if (hasDebt) {
        tiles.push(
          <KpiTile
            key="gross"
            delay={40}
            label="Gross portfolio"
            value={fmtBase(stats.totalValue, profile.displayCurrency, { compact: stats.totalValue > 1e8 })}
            sub={`Cost basis: ${fmtBase(stats.totalCost, profile.displayCurrency, { compact: true })}`}
            accent="var(--brand)"
          />
        );
      } else {
        // Replacement tile: liquid balance — clickable, takes user to cash + savings
        tiles.push(
          <KpiTile
            key="liquid"
            delay={40}
            label="Liquid balance"
            value={fmtBase(stats.liquidValue || 0, profile.displayCurrency, { compact: (stats.liquidValue || 0) > 1e7 })}
            sub={`${stats.liquidityRatio.toFixed(1)}% of portfolio — cash + mobile money + savings`}
            accent="var(--brand)"
            onClick={() => dispatch({ type: 'nav', to: 'accounts' })}
          />
        );
      }
      tiles.push(
        <KpiTile
          key="pl"
          delay={80}
          label="Unrealised P/L"
          value={`${stats.gain >= 0 ? '▲ ' : '▼ '}${stats.gain >= 0 ? '+' : ''}${fmtBase(stats.gain, profile.displayCurrency, { compact: true })}`}
          sub={`${stats.gainPct >= 0 ? '+' : ''}${stats.gainPct.toFixed(1)}% all-time vs cost`}
          accent={stats.gain >= 0 ? 'var(--up)' : 'var(--down)'}
        />
      );
      tiles.push(
        <KpiTile
          key="sr"
          delay={120}
          label="Savings rate"
          value={savingsRate !== null ? `${savingsRate.toFixed(1)}%` : '—'}
          sub={savingsRate !== null ? '6-month average of income saved' : 'Add cashflows to track'}
          accent={savingsRate === null ? 'var(--ink-3)' : savingsRate >= 20 ? 'var(--up)' : savingsRate > 0 ? 'var(--gold)' : 'var(--down)'}
          onClick={() => dispatch({ type: 'nav', to: 'cashflow' })}
        />
      );
      return <div className="dash-kpi-grid">{tiles}</div>;
    })(),

    // ── B6–B9 Key-metric widgets (shared MetricWidget on engine numbers) ──
    widgets: (() => {
      const wAsOf = netWorthAsOf(state);
      const avgMonthlyExpense = totExp6M / 6;
      const liquid = stats.liquidValue || 0;
      const months = avgMonthlyExpense > 0 ? liquid / avgMonthlyExpense : null;
      const nav = (to) => dispatch({ type: 'nav', to });

      // Tax estimate: Fixed Asset Tax (properties) + Vehicle Levy + nearest deadline.
      const nextAnnual = (m, d) => { const y = today.getFullYear(); let dt = new Date(y, m, d, 23, 59, 59); if (dt < today) dt = new Date(y + 1, m, d, 23, 59, 59); return dt; };
      let fat = 0; assets.filter(a => a.kind === 'realestate-land' || a.kind === 'realestate-house').forEach(a => { fat += fixedAssetTax(a, valueRWF(a, today)).tax; });
      let levy = 0; assets.filter(a => a.kind === 'vehicle').forEach(a => { levy += VEHICLE_CATEGORIES.find(v => v.id === a.vehicleCategory)?.levy ?? 50_000; });
      const taxTotal = fat + levy;
      const taxDeadline = [fat > 0 ? nextAnnual(2, 31) : null, levy > 0 ? nextAnnual(11, 31) : null].filter(Boolean).sort((a, b) => a - b)[0] || null;
      const taxDays = taxDeadline ? Math.ceil((taxDeadline - today) / 86400000) : null;

      // Investable surplus = liquid − a 3-month emergency buffer.
      const buffer = avgMonthlyExpense > 0 ? avgMonthlyExpense * 3 : 0;
      const investable = Math.max(0, liquid - buffer);
      const forgoneYr = investable * REFERENCE.tBillYieldPct / 100;

      const widgets = [
        <MetricWidget key="cash" delay={0} title="Cash in Hand"
          value={fmtBase(liquid, profile.displayCurrency, { compact: liquid > 1e7 })}
          subtext={months != null ? `${months.toFixed(1)} months of expenses` : 'cash + mobile money + bank'}
          asOf={wAsOf} now={today} deepLink="accounts" onNav={nav}
          severity={months != null && months < 3 ? 'warning' : 'good'}
          costHook={months != null && months < 3 ? 'Below the 3-month safety floor — thin cover if income pauses.' : undefined} />,
      ];
      if (taxTotal > 0) widgets.push(
        <MetricWidget key="tax" delay={40} title="Tax Estimate"
          value={fmtBase(taxTotal, profile.displayCurrency, { compact: taxTotal > 1e7 })}
          subtext={taxDays != null ? `next deadline in ${taxDays} days` : 'RRA obligations'}
          asOf={wAsOf} now={today} deepLink="tax" onNav={nav}
          severity={taxDays != null && taxDays <= 30 ? 'warning' : 'info'}
          costHook="Estimate, not a filing — late penalties accrue if a deadline is missed." />);
      if (liabilities.length > 0) widgets.push(
        <MetricWidget key="debt" delay={80} title="Debt"
          value={fmtBase(totalDebt, profile.displayCurrency, { compact: totalDebt > 1e7 })}
          subtext={`${debtToAsset.toFixed(1)}% debt-to-asset`}
          asOf={wAsOf} now={today} deepLink="liabilities" onNav={nav}
          severity={debtToAsset > 50 ? 'warning' : 'info'}
          costHook={financialStats.monthlyObligations > 0 ? `${fmtBase(financialStats.monthlyObligations, profile.displayCurrency, { compact: true })}/mo in repayments.` : undefined} />);
      widgets.push(
        <MetricWidget key="investable" delay={120} title="Investable"
          value={fmtBase(investable, profile.displayCurrency, { compact: investable > 1e7 })}
          subtext="liquid minus a 3-month buffer"
          asOf={wAsOf} now={today} deepLink="trends" onNav={nav}
          severity={investable > REFERENCE.idleCashFloorRWF ? 'warning' : 'good'}
          costHook={investable > REFERENCE.idleCashFloorRWF ? `Idle — at ~${REFERENCE.tBillYieldPct}% T-bill that's ~${fmtBase(forgoneYr, profile.displayCurrency, { compact: true })}/yr forgone.` : undefined} />);
      return <div className="dash-kpi-grid">{widgets}</div>;
    })(),

    hero: (
      <div className="dash-grid-3">

        {/* Net Worth Hero */}
        <div className="card-hero dash-hero-card">
          <div style={{
            position: 'absolute', top: -40, right: -40,
            width: 160, height: 160, borderRadius: '50%',
            background: 'radial-gradient(circle, var(--brand-softer) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div className="muted" style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Net worth</div>
          <div className="font-serif dash-hero-amount" style={{ lineHeight: 1, letterSpacing: '-0.025em' }}>
            {fmtBase(trueNetWorth, profile.displayCurrency, { compact: trueNetWorth > 1e8 })}
          </div>
          <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            <span className={`pill ${stats.gain >= 0 ? 'pill-up' : 'pill-down'}`}>
              {stats.gain >= 0 ? '▲' : '▼'} {Math.abs(stats.gainPct).toFixed(1)}% all-time
            </span>
            <span className="num muted" style={{ fontSize: 12 }}>
              {stats.gain >= 0 ? '+' : ''}{fmtBase(stats.gain, profile.displayCurrency, { compact: true })} vs cost
            </span>
          </div>
          <div style={{ marginTop: 18, color: 'var(--brand)' }}>
            <AreaChart
              data={trend}
              labels={Array.from({ length: trend.length }, (_, i) => {
                const d = new Date(); d.setMonth(d.getMonth() - (trend.length - 1 - i));
                return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
              })}
              w={680} h={140}
              stroke="var(--brand)" accent="var(--brand)" responsive
              formatValue={(v) => fmtBase(v, profile.displayCurrency, { compact: true })}
              ariaLabel={`24-month net worth chart. Latest: ${fmtBase(trueNetWorth, profile.displayCurrency, { compact: true })}.`}
            />
          </div>
          <div className="dash-chart-axis" aria-hidden="true">
            <span>24m ago</span><span>18m</span><span>12m</span><span>6m</span><span>Today</span>
          </div>
        </div>

        {/* Asset Allocation donut */}
        <div className="card" style={{ padding: 22 }}>
          <div className="font-serif" style={{ fontSize: 17, marginBottom: 16, letterSpacing: '-0.01em' }}>Asset allocation</div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, position: 'relative' }}>
            <Donut size={114} thickness={15}
              slices={stats.groups.map(g => ({ value: g.value, color: g.color, label: g.group }))}
              ariaLabel={`Asset allocation: ${stats.groups.map(g => `${g.group} ${stats.totalValue > 0 ? (g.value / stats.totalValue * 100).toFixed(0) : 0} percent`).join(', ')}`} />
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              textAlign: 'center', pointerEvents: 'none',
            }}>
              <div className="num" style={{ fontSize: 16, fontWeight: 700, lineHeight: 1 }}>{stats.groups.length}</div>
              <div className="muted" style={{ fontSize: 9, marginTop: 2 }}>groups</div>
            </div>
          </div>
          <div className="col" style={{ gap: 8 }}>
            {stats.groups.slice(0, 6).map(g => (
              <div key={g.group} className="row" style={{ gap: 8, fontSize: 12, justifyContent: 'space-between' }}>
                <div className="row" style={{ gap: 8, minWidth: 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: g.color, flexShrink: 0, marginTop: 1 }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--ink-2)' }}>{g.group}</span>
                </div>
                <span className="num" style={{ color: 'var(--ink)', fontWeight: 600, fontSize: 11, flexShrink: 0 }}>
                  {stats.totalValue > 0 ? (g.value / stats.totalValue * 100).toFixed(0) : 0}%
                </span>
              </div>
            ))}
            {stats.groups.length > 6 && (
              <div className="muted" style={{ fontSize: 10, textAlign: 'center' }}>+{stats.groups.length - 6} more groups</div>
            )}
          </div>
        </div>

        {/* Financial ratios column */}
        <div className="col" style={{ gap: 12 }}>
          <div className="card" style={{ padding: '18px 20px', flex: 1 }}>
            <div className="font-serif" style={{ fontSize: 15, marginBottom: 14 }}>Financial ratios</div>
            <div className="col" style={{ gap: 14 }}>
              <RatioBar
                label="Liquidity ratio"
                value={stats.liquidityRatio}
                color={stats.liquidityRatio > 15 ? 'var(--up)' : stats.liquidityRatio > 5 ? 'var(--gold)' : 'var(--down)'}
                hint={stats.liquidityRatio < 10 ? 'Low — keep 3-6 months expenses liquid' : 'Cash & savings as % of total assets'}
                thresholds={[
                  { at: 5,  label: 'Low' },
                  { at: 15, label: 'Healthy' },
                ]}
              />
              <RatioBar
                label="Income-generating"
                value={stats.incomeGenRatio}
                color={stats.incomeGenRatio > 50 ? 'var(--up)' : stats.incomeGenRatio > 25 ? 'var(--gold)' : 'var(--down)'}
                hint="% of portfolio actively yielding returns"
              />
              {liabilities.length > 0 && (
                <RatioBar
                  label="Debt-to-asset"
                  value={debtToAsset}
                  color={debtToAsset < 30 ? 'var(--up)' : debtToAsset < 60 ? 'var(--gold)' : 'var(--down)'}
                  hint={`${fmtBase(totalDebt, profile.displayCurrency, { compact: true })} total liabilities`}
                />
              )}
              {/* Debt-to-income — gold standard household-leverage metric.
                  Sum of amortising monthly payments / gross monthly income.
                  Only meaningful when both inputs exist. (UX review #35.) */}
              {liabilities.length > 0 && financialStats.totalMonthlyIncome > 0 && (() => {
                const today2 = new Date();
                const monthsBetween = (a, b) => {
                  if (!a || !b) return 0;
                  return Math.max(0, Math.round((new Date(b) - new Date(a)) / (30.4375 * 24 * 3600 * 1000)));
                };
                const monthlyDebt = liabilities.reduce((s, l) => {
                  const remaining = monthsBetween(today2.toISOString().slice(0, 10), l.endDate)
                    || monthsBetween(l.startDate, l.endDate);
                  const p = toBase(l.remainingAmount || 0, l.currency || 'RWF');
                  return s + monthlyPayment(p, l.interestRate || 0, remaining);
                }, 0);
                const dti = (monthlyDebt / financialStats.totalMonthlyIncome) * 100;
                return (
                  <RatioBar
                    label="Debt-to-income"
                    value={dti}
                    color={dti < 36 ? 'var(--up)' : dti < 50 ? 'var(--gold)' : 'var(--down)'}
                    hint={`${fmtBase(monthlyDebt, profile.displayCurrency, { compact: true })} / month in debt payments`}
                    thresholds={[
                      { at: 36, label: 'Comfortable' },
                      { at: 50, label: 'Stretched' },
                    ]}
                  />
                );
              })()}
            </div>
          </div>

          {/* Mini income trend */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
              <div className="font-serif" style={{ fontSize: 14 }}>Cash flow (6M)</div>
              {hasCF && (
                <button onClick={() => dispatch({ type: 'nav', to: 'cashflow' })}
                  style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 10, color: 'var(--brand)', fontFamily: 'inherit', padding: 0 }}>
                  Details →
                </button>
              )}
            </div>
            <IncomeTrendBars months={incomeTrend} displayCurrency={profile.displayCurrency} />
          </div>
        </div>
      </div>
    ),

    insight: <DashboardInsight state={state} dispatch={dispatch} insights={engine.insights} />,

    // ── §9: idle-cash card (forgone-yield counter + broker introduction) ──
    idlecash: (() => {
      const ins = engine.insights.find(i => i.id === 'idle-cash-yield-gap');
      return ins ? <IdleCashCard insight={ins} displayCurrency={profile.displayCurrency} now={today} /> : null;
    })(),

    // ── §5/B15: Retirement Readiness tile ──
    retirement: (() => {
      const pens = assets.filter(a => a.kind === 'rssb' || a.kind === 'ejoheza');
      if (pens.length === 0) return null;
      const contributionsToDate = pens.reduce((s, a) => s + valueRWF(a, today), 0);
      const monthlyContribution = pens.reduce((s, a) => s + (+a.monthlyContribution || 0), 0);
      const employerMatch = pens.reduce((s, a) => s + (+a.employerMatch || 0), 0);
      const ageAsset = pens.find(a => a.currentAge);
      const currentAge = ageAsset ? +ageAsset.currentAge : null;
      const annualSalary = pens.reduce((s, a) => Math.max(s, +a.annualSalary || 0), 0);
      const proj = projectPension({ currentAge, contributionsToDate, monthlyContribution, employerMatch, annualSalary, retirementAge: 60 });
      const lowReplacement = proj?.replacementRatio != null && proj.replacementRatio < 50;
      return (
        <div className="card dash-section-card" style={{ padding: '22px 24px' }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div className="font-serif" style={{ fontSize: 19 }}>Retirement readiness</div>
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>RSSB / Ejo Heza · projected to age 60 · modeled</div>
            </div>
          </div>
          {!proj ? (
            <div className="muted" style={{ fontSize: 12.5 }}>Add your age on the pension asset to project your replacement ratio and readiness score.</div>
          ) : (
            <div className="row" style={{ gap: 26, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {proj.readiness != null && (
                <div>
                  <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Readiness</div>
                  <div className="num" style={{ fontSize: 28, fontWeight: 700, color: proj.readiness >= 80 ? 'var(--up)' : proj.readiness >= 50 ? 'var(--gold)' : 'var(--down)' }}>{proj.readiness}<span style={{ fontSize: 16 }}>/100</span></div>
                </div>
              )}
              <div>
                <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Projected pot @60</div>
                <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>{fmtBase(proj.projectedPot, profile.displayCurrency, { compact: true })}</div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Monthly pension</div>
                <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>{fmtBase(proj.monthlyPension, profile.displayCurrency, { compact: true })}</div>
              </div>
              {proj.replacementRatio != null && (
                <div>
                  <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Replacement</div>
                  <div className="num" style={{ fontSize: 22, fontWeight: 700, color: lowReplacement ? 'var(--down)' : 'var(--ink)' }}>{Math.floor(proj.replacementRatio)}%</div>
                </div>
              )}
            </div>
          )}
          {lowReplacement && (
            <div style={{ marginTop: 14 }}>
              <CostOfAbsence severity="warning"
                costStatement={`At your current contributions you'll replace only ${Math.floor(proj.replacementRatio)}% of income at 60 — below a comfortable 60%. Topping up Ejo Heza closes the gap.`}
                action={{ label: 'Review pension', to: 'assets' }}
                onAction={(to) => dispatch({ type: 'nav', to })} />
            </div>
          )}
        </div>
      );
    })(),

    financials: (assets.length > 0 || cashflows.length > 0) ? (() => {
      const fs = financialStats;
      const INCOME_LABEL = {
        salary:    'Salary / Wages', rental:   'Rental income',
        dividends: 'Dividends',      'bond-int':'Bond interest',
        business:  'Business income','freelance':'Freelance',
        'other-inc':'Other income',
      };
      const INCOME_COLOR = {
        salary:    'var(--sky)',    rental:    'var(--brand)',
        dividends: 'var(--gold)',   'bond-int':'var(--gold)',
        business:  'var(--up)',     freelance: 'var(--plum)',
        'other-inc':'var(--ink-3)',
      };
      const allIncomeSources = [
        ...Object.entries(fs.incomeByCategory).map(([cat, mo]) => ({
          label: INCOME_LABEL[cat] || cat, color: INCOME_COLOR[cat] || 'var(--ink-3)', monthly: mo, source: 'cashflow',
        })),
        ...Object.entries(fs.assetIncomeByKind).map(([group, mo]) => ({
          label: `${group} (asset income)`, color: 'var(--brand)', monthly: mo, source: 'asset',
        })),
      ].sort((a, b) => b.monthly - a.monthly);
      const hasIncome = fs.totalMonthlyIncome > 0;
      return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>

          {/* Income by source */}
          <div className="card" style={{ padding: '20px 22px' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div className="font-serif" style={{ fontSize: 17 }}>Monthly income</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>By source · recurring + asset income</div>
              </div>
              <button onClick={() => dispatch({ type: 'nav', to: 'cashflow' })} style={{
                border: 0, background: 'transparent', cursor: 'pointer', fontSize: 11,
                color: 'var(--brand)', fontFamily: 'inherit', padding: 0,
              }}>Add →</button>
            </div>
            {hasIncome ? (
              <div className="col" style={{ gap: 11 }}>
                {allIncomeSources.map((src, i) => {
                  const pct = fs.totalMonthlyIncome > 0 ? (src.monthly / fs.totalMonthlyIncome * 100) : 0;
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: src.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{src.label}</span>
                        </div>
                        <div className="row" style={{ gap: 10 }}>
                          <span className="num" style={{ fontSize: 12, fontWeight: 700, color: 'var(--up)' }}>
                            {fmtBase(src.monthly, profile.displayCurrency, { compact: true })}
                          </span>
                          <span className="muted" style={{ fontSize: 10, minWidth: 30, textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div style={{ height: 4, background: 'var(--bg-2)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: pct + '%', background: src.color, borderRadius: 2,
                          transition: 'width 0.6s cubic-bezier(0.23,1,0.32,1)',
                        }} />
                      </div>
                    </div>
                  );
                })}
                <div style={{ paddingTop: 10, borderTop: '0.5px solid var(--line-soft)', display: 'flex', justifyContent: 'space-between' }}>
                  <span className="muted" style={{ fontSize: 11, fontWeight: 600 }}>Total / month</span>
                  <span className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--up)' }}>
                    {fmtBase(fs.totalMonthlyIncome, profile.displayCurrency, { compact: true })}
                  </span>
                </div>
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 12, lineHeight: 1.6, padding: '8px 0' }}>
                No recurring income recorded yet. Add cashflows or set income generation on assets to see breakdown.
              </div>
            )}
          </div>

          {/* Key financial ratios */}
          <div className="card" style={{ padding: '20px 22px' }}>
            <div className="font-serif" style={{ fontSize: 17, marginBottom: 14 }}>Financial ratios</div>
            <div className="col" style={{ gap: 15 }}>

              <RatioBar
                label="Passive income ratio"
                value={fs.passiveIncomeRatio}
                color={fs.passiveIncomeRatio > 50 ? 'var(--up)' : fs.passiveIncomeRatio > 25 ? 'var(--gold)' : 'var(--down)'}
                hint={fs.passiveIncomeRatio > 50 ? 'Majority of income is passive' : 'Grow passive income to build financial freedom'}
              />
              <RatioBar
                label="Asset utilization rate"
                value={fs.assetUtilizationRate}
                color={fs.assetUtilizationRate > 60 ? 'var(--up)' : fs.assetUtilizationRate > 30 ? 'var(--gold)' : 'var(--down)'}
                hint="Share of total assets actively generating returns"
              />
              <RatioBar
                label="Debt-to-asset ratio"
                value={debtToAsset}
                color={debtToAsset < 30 ? 'var(--up)' : debtToAsset < 60 ? 'var(--gold)' : 'var(--down)'}
                hint={liabilities.length === 0 ? 'No liabilities recorded' : `${fmtBase(totalDebt, profile.displayCurrency, { compact: true })} total debt`}
              />
              {totInc6M > 0 && savingsRate !== null && (
                <RatioBar
                  label="Savings rate (6M avg)"
                  value={savingsRate}
                  color={savingsRate >= 20 ? 'var(--up)' : savingsRate > 0 ? 'var(--gold)' : 'var(--down)'}
                  hint="Income saved after all expenses"
                />
              )}
            </div>
          </div>

          {/* Liquidity & obligations */}
          <div className="card" style={{ padding: '20px 22px' }}>
            <div className="font-serif" style={{ fontSize: 17, marginBottom: 14 }}>Liquidity position</div>
            <div className="col" style={{ gap: 14 }}>
              <div>
                <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Liquid balance</div>
                <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>
                  {fmtBase(fs.liquidRWF, profile.displayCurrency, { compact: fs.liquidRWF > 1e8 })}
                </div>
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>Cash + mobile money + bank savings</div>
              </div>
              {fs.monthlyObligations > 0 && (
                <div>
                  <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Monthly obligations</div>
                  <div className="num" style={{ fontSize: 20, fontWeight: 600, color: 'var(--down)' }}>
                    {fmtBase(fs.monthlyObligations, profile.displayCurrency, { compact: true })}
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>Loan repayments</div>
                </div>
              )}
              {fs.maintenanceCount > 0 && (
                <div style={{ padding: '10px 12px', borderRadius: 8, background: 'color-mix(in oklab, var(--clay) 8%, var(--bg-2))' }}>
                  <span style={{ color: 'var(--clay)', fontSize: 12, fontWeight: 600 }}>
                    {fs.maintenanceCount} maintenance asset{fs.maintenanceCount === 1 ? '' : 's'}
                  </span>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                    Properties, vehicles, and livestock require ongoing upkeep.
                  </div>
                </div>
              )}
              {fs.totalMonthlyIncome > 0 && (
                <div style={{ paddingTop: 10, borderTop: '0.5px solid var(--line-soft)' }}>
                  <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Net cash flow / month</div>
                  <div className="num" style={{ fontSize: 20, fontWeight: 600, color: fs.netCashMonthly >= 0 ? 'var(--up)' : 'var(--down)' }}>
                    <span aria-hidden="true">{fs.netCashMonthly >= 0 ? '▲' : '▼'}</span>{' '}
                    {fs.netCashMonthly >= 0 ? '+' : ''}{fmtBase(fs.netCashMonthly, profile.displayCurrency, { compact: true })}
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>Income minus avg monthly spend</div>
                </div>
              )}
            </div>
          </div>

          {/* Return by asset class */}
          {Object.keys(fs.returnByClass).length > 0 && (
            <div className="card" style={{ padding: '20px 22px' }}>
              <div className="font-serif" style={{ fontSize: 17, marginBottom: 14 }}>Return by asset class</div>
              <div className="col" style={{ gap: 12 }}>
                {Object.entries(fs.returnByClass)
                  .map(([group, d]) => ({
                    group, color: d.color,
                    retPct: d.cost > 0 ? ((d.value - d.cost) / d.cost * 100) : 0,
                    value: d.value,
                  }))
                  .sort((a, b) => b.retPct - a.retPct)
                  .map((r, i) => {
                    const isUp = r.retPct >= 0;
                    return (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{r.group}</span>
                          </div>
                          <span className="num" style={{ fontSize: 12, fontWeight: 700, color: isUp ? 'var(--up)' : 'var(--down)' }}>
                            <span aria-hidden="true" style={{ marginRight: 3 }}>{isUp ? '▲' : '▼'}</span>{isUp ? '+' : ''}{r.retPct.toFixed(1)}%
                          </span>
                        </div>
                        <div style={{ height: 4, background: 'var(--bg-2)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 2,
                            width: Math.min(Math.abs(r.retPct) / Math.max(...Object.values(fs.returnByClass).map(d => d.cost > 0 ? Math.abs((d.value - d.cost) / d.cost * 100) : 0), 1) * 100, 100) + '%',
                            background: isUp ? r.color : 'var(--down)',
                            transition: 'width 0.6s cubic-bezier(0.23,1,0.32,1)',
                          }} />
                        </div>
                        <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>
                          {fmtBase(r.value, profile.displayCurrency, { compact: true })} value
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      );
    })() : null,

    chart: (
      <div className="card dash-section-card" style={{ padding: '22px 24px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="font-serif" style={{ fontSize: 19 }}>Net worth timeline</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
              Net worth vs cost basis · {portfolioReturn >= 0 ? '+' : ''}{portfolioReturn.toFixed(1)}% this period
            </div>
            {yearAgo && (
              <div style={{ fontSize: 11, marginTop: 4, color: 'var(--ink-2)' }}>
                <span aria-hidden="true" style={{ color: yearAgo.delta >= 0 ? 'var(--up)' : 'var(--down)' }}>{yearAgo.delta >= 0 ? '▲' : '▼'}</span>{' '}
                vs 1 year ago: <strong style={{ color: yearAgo.delta >= 0 ? 'var(--up)' : 'var(--down)' }}>
                  {yearAgo.delta >= 0 ? '+' : ''}{fmtBase(yearAgo.delta, profile.displayCurrency, { compact: true })} ({yearAgo.pct >= 0 ? '+' : ''}{yearAgo.pct.toFixed(1)}%)
                </strong>
              </div>
            )}
          </div>
          <div className="row" style={{ gap: 6 }}>
            {['1M', '3M', '6M', '1Y', 'ALL'].map(r => (
              <button key={r} onClick={() => setChartRange(r)} className="dash-btn-range" style={{
                padding: '5px 11px', borderRadius: 'var(--r-pill)', fontSize: 11, cursor: 'pointer',
                background: chartRange === r ? 'var(--brand)' : 'var(--bg-2)',
                color: chartRange === r ? 'var(--brand-ink)' : 'var(--ink-2)',
                border: 0, fontFamily: 'inherit', fontWeight: chartRange === r ? 600 : 400,
              }}>{r}</button>
            ))}
          </div>
        </div>
        <PortfolioChart snapshots={chartSnaps} displayCurrency={profile.displayCurrency} height={200} />
        {chartHasSynthetic && (
          <div className="muted" style={{ fontSize: 10.5, marginTop: 8, fontStyle: 'italic' }}>
            Early history is a synthetic seed for illustration — real daily snapshots accrue from when you started using Imari.
          </div>
        )}
      </div>
    ),

    // ── B10: cash-flow by category (matches the Cash Flow module) ──
    cashflow: expenseByCategory.rows.length > 0 ? (
      <div className="card dash-section-card" style={{ padding: '22px 24px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, gap: 10 }}>
          <div>
            <div className="font-serif" style={{ fontSize: 19 }}>Where your money goes</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
              This month · {fmtBase(expenseByCategory.total, profile.displayCurrency, { compact: true })} across {expenseByCategory.rows.length} categories
            </div>
          </div>
          <button onClick={() => dispatch({ type: 'nav', to: 'cashflow' })} style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 11, color: 'var(--brand)', fontFamily: 'inherit', padding: 0 }}>
            Open Cash Flow →
          </button>
        </div>
        <div className="row" style={{ gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
          <Donut size={104} thickness={14}
            slices={expenseByCategory.rows.map(r => ({ value: r.amount, color: r.color, label: r.label }))}
            ariaLabel={`Expenses by category: ${expenseByCategory.rows.slice(0, 5).map(r => `${r.label} ${r.pct.toFixed(0)} percent`).join(', ')}`} />
          <div className="col" style={{ flex: 1, minWidth: 240, gap: 9 }}>
            {expenseByCategory.rows.slice(0, 6).map(r => (
              <button key={r.id} onClick={() => dispatch({ type: 'nav', to: 'cashflow' })} className="dash-link"
                style={{ all: 'unset', cursor: 'pointer', display: 'block' }}
                aria-label={`${r.label}: ${fmtBase(r.amount, profile.displayCurrency, { compact: true })}, ${r.pct.toFixed(0)}% of spend`}>
                <div className="row" style={{ justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                  <div className="row" style={{ gap: 8, minWidth: 0, alignItems: 'center' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</span>
                  </div>
                  <div className="row" style={{ gap: 10, flexShrink: 0, alignItems: 'center' }}>
                    {r.momPct != null && (
                      <span style={{ fontSize: 10.5, color: r.momPct >= 0 ? 'var(--down)' : 'var(--up)' }}>
                        <span aria-hidden="true">{r.momPct >= 0 ? '▲' : '▼'}</span>{Math.abs(r.momPct).toFixed(0)}%
                      </span>
                    )}
                    <span className="num" style={{ fontSize: 12.5, fontWeight: 600 }}>{fmtBase(r.amount, profile.displayCurrency, { compact: true })}</span>
                    <span className="muted num" style={{ fontSize: 10.5, minWidth: 34, textAlign: 'right' }}>{r.pct.toFixed(0)}%</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    ) : null,

    // ── B17: personalized macro overlay (provenance-tagged) ──
    macro: (() => {
      const m = macroOverlay;
      const Pill = ({ kind, asOf }) => (
        <span className="muted" style={{ fontSize: 9, padding: '2px 6px', borderRadius: 'var(--r-pill)', background: 'var(--bg-2)', border: '0.5px solid var(--line)', whiteSpace: 'nowrap' }}>
          {kind}{asOf ? ` · ${asOf}` : ''}
        </span>
      );
      const Card = ({ title, children }) => (
        <div className="card" style={{ padding: 18, flex: 1, minWidth: 240 }}>{title}{children}</div>
      );
      const realYoY = m.nominalYoY != null ? m.nominalYoY - m.headlineCpi : null;
      return (
        <div>
          <div className="font-serif" style={{ fontSize: 19, marginBottom: 4 }}>Your personal macro</div>
          <div className="muted" style={{ fontSize: 11, marginBottom: 14 }}>How Rwanda's economy lands on your money — not the headlines.</div>
          <div className="row" style={{ gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
            {/* Personal inflation */}
            <Card title={
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                <span className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Your inflation</span>
                <Pill kind={m.personalized ? 'Modeled' : 'Reference'} asOf={m.cpiAsOf} />
              </div>
            }>
              <div className="num" style={{ fontSize: 24, fontWeight: 700, color: m.personalCpi > m.headlineCpi ? 'var(--down)' : 'var(--ink)' }}>{m.personalCpi.toFixed(1)}%</div>
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                Headline CPI {m.headlineCpi}% · {m.personalized ? 'weighted by your spending mix' : 'add expenses to personalize'}
              </div>
              {m.personalized && m.personalCpi > m.headlineCpi && (
                <div style={{ fontSize: 11, marginTop: 8, color: 'var(--ink-2)' }}>Your basket inflates faster than the national average.</div>
              )}
            </Card>
            {/* Real net-worth growth */}
            <Card title={
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                <span className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Real growth (1y)</span>
                <Pill kind="Reference" asOf={m.cpiAsOf} />
              </div>
            }>
              {realYoY != null ? (
                <>
                  <div className="num" style={{ fontSize: 24, fontWeight: 700, color: realYoY >= 0 ? 'var(--up)' : 'var(--down)' }}>{realYoY >= 0 ? '+' : ''}{realYoY.toFixed(1)}%</div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Nominal {m.nominalYoY >= 0 ? '+' : ''}{m.nominalYoY.toFixed(1)}% − CPI {m.headlineCpi}% = real purchasing power</div>
                </>
              ) : (
                <div className="muted" style={{ fontSize: 12 }}>Needs ~a year of history to compare real vs nominal.</div>
              )}
            </Card>
            {/* RSE vs benchmark */}
            {m.rseGain != null && (
              <Card title={
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                  <span className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>RSE vs All-Share</span>
                  <Pill kind="Reference" asOf={m.rseAsOf} />
                </div>
              }>
                <BenchmarkBar label="You vs RSESI" portfolioReturn={m.rseGain} benchmarkReturn={m.rseChange} />
              </Card>
            )}
          </div>
        </div>
      );
    })(),

    category: stats.groups.length > 0 ? (
      <div className="card dash-section-card" style={{ padding: '22px 24px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div className="font-serif" style={{ fontSize: 19 }}>Category performance</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>Unrealised gain / loss by asset class</div>
          </div>
          <button onClick={() => dispatch({ type: 'nav', to: 'assets' })} style={{
            border: 0, background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--brand)', fontFamily: 'inherit', padding: 0,
          }}>View assets →</button>
        </div>
        <CategoryBars groups={[...stats.groups].sort((a, b) => b.gainPct - a.gainPct)} totalValue={stats.totalValue} />
      </div>
    ) : null,

    movers: (gainers.length > 0 || losers.length > 0) ? (
      <div className="dash-grid-2">
        <div className="card" style={{ padding: '20px 22px' }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14, alignItems: 'center' }}>
            <div>
              <div className="font-serif" style={{ fontSize: 17 }}>Top appreciating</div>
              <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>Highest unrealised gains since purchase</div>
            </div>
            <span style={{ padding: '3px 9px', borderRadius: 'var(--r-pill)', background: 'var(--up-soft)', color: 'var(--up)', fontSize: 10, fontWeight: 700 }}>▲ {gainers.length}</span>
          </div>
          {gainers.length === 0 ? (
            <div className="muted" style={{ fontSize: 12 }}>No assets in profit yet</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
              {gainers.map((a, i) => <MoverCard key={a.id} asset={a} delay={i * 45} onClick={() => dispatch({ type: 'nav', to: 'assets' })} />)}
            </div>
          )}
        </div>
        <div className="card" style={{ padding: '20px 22px' }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14, alignItems: 'center' }}>
            <div>
              <div className="font-serif" style={{ fontSize: 17 }}>Highest depreciation</div>
              <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>Assets with unrealised losses</div>
            </div>
            <span style={{ padding: '3px 9px', borderRadius: 'var(--r-pill)', background: 'var(--down-soft)', color: 'var(--down)', fontSize: 10, fontWeight: 700 }}>▼ {losers.length}</span>
          </div>
          {losers.length === 0 ? (
            <div className="muted" style={{ fontSize: 12 }}>No assets in the red — great!</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
              {losers.map((a, i) => <MoverCard key={a.id} asset={a} delay={i * 45} onClick={() => dispatch({ type: 'nav', to: 'assets' })} />)}
            </div>
          )}
        </div>
      </div>
    ) : null,

    // Alerts: render only the columns that have items. If all three are empty,
    // surface a compact "everything healthy" banner instead of three filler cards.
    alerts: (() => {
      const cards = [
        { title: 'Asset concentration', accent: 'var(--gold)', items: concentrationAlerts, label: 'Rebalance →' },
        { title: 'High-risk signals',   accent: 'var(--down)', items: riskAlerts,          label: 'Review assets →' },
        { title: 'Maintenance assets',  accent: 'var(--clay)', items: maintenanceAssets,   label: 'View assets →' },
      ].filter(c => c.items.length > 0);
      if (cards.length === 0) {
        return (
          <div className="card" style={{
            padding: '14px 18px',
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'color-mix(in oklab, var(--up) 6%, var(--paper))',
            border: '0.5px solid color-mix(in oklab, var(--up) 22%, transparent)',
          }}>
            <span style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: 'var(--up-soft)', color: 'var(--up)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700,
            }} aria-hidden="true">✓</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Portfolio is healthy</div>
              <div className="muted" style={{ fontSize: 11, marginTop: 1 }}>No concentration, risk, or maintenance flags right now.</div>
            </div>
          </div>
        );
      }
      const cols = Math.min(cards.length, 3);
      return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 14 }}>
          {cards.map(c => (
            <AlertCard key={c.title} title={c.title} accentColor={c.accent} items={c.items}
              onNav={() => dispatch({ type: 'nav', to: 'assets' })} navLabel={c.label} />
          ))}
        </div>
      );
    })(),

    benchmarks: (
      <div className={activeGoals.length > 0 ? 'dash-grid-2' : ''} style={activeGoals.length > 0 ? undefined : { display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
        <div className="card" style={{ padding: '20px 22px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <div className="font-serif" style={{ fontSize: 17 }}>vs. Benchmarks</div>
            <span
              className="pill pill-soft"
              title={`Portfolio bar = your net-worth change over the last ${chartRange}. Benchmarks scaled to the same window where possible.`}
              style={{ fontSize: 10, cursor: 'help' }}
            >
              {chartRange} window
            </span>
          </div>
          <div className="muted" style={{ fontSize: 11, marginBottom: 16 }}>
            Your <strong style={{ color: portfolioReturn >= 0 ? 'var(--up)' : 'var(--down)' }}>
              {portfolioReturn >= 0 ? '+' : ''}{portfolioReturn.toFixed(1)}%
            </strong> over the last {chartRange} compared to:
          </div>
          {benchmarks.map(b => (
            <BenchmarkBar key={b.label} label={b.label} portfolioReturn={portfolioReturn} benchmarkReturn={b.ret} />
          ))}
          <div className="muted" style={{ fontSize: 9.5, marginTop: 12, lineHeight: 1.5 }}>
            All bars compare the same <strong>{chartRange}</strong> window. Benchmark figures
            (USD/RWF, CPI, RSE ASI, T-bond) are illustrative and scaled to the selected range.
          </div>
        </div>
        {activeGoals.length > 0 && (
          <div className="card" style={{ padding: '20px 22px' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
              <div className="font-serif" style={{ fontSize: 17 }}>Goals progress</div>
              <button onClick={() => dispatch({ type: 'nav', to: 'goals' })} style={{
                border: 0, background: 'transparent', cursor: 'pointer', fontSize: 11, color: 'var(--brand)', fontFamily: 'inherit',
              }}>See all →</button>
            </div>
            <div className="col" style={{ gap: 16 }}>
              {activeGoals.map(g => {
                const cat = GOAL_CATEGORIES.find(c => c.id === g.category) || GOAL_CATEGORIES[0];
                const targetRWF = toBase(g.targetAmount || 0, g.currency || 'RWF');
                const pct = targetRWF > 0 ? Math.min((trueNetWorth / targetRWF) * 100, 100) : 0;
                const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline) - today) / 86400000) : null;
                return (
                  <div key={g.id}>
                    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                      <div className="row" style={{ gap: 6 }}>
                        <span>{cat.icon}</span>
                        <span style={{ fontSize: 12, fontWeight: 500 }}>{g.title}</span>
                      </div>
                      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                        <span className="num" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{pct.toFixed(0)}%</span>
                        {daysLeft !== null && (
                          <span className="muted" style={{ fontSize: 10, color: daysLeft < 90 ? 'var(--gold)' : 'var(--ink-4)' }}>{daysLeft}d</span>
                        )}
                      </div>
                    </div>
                    <div style={{ height: 5, background: 'var(--bg-2)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: pct + '%', background: 'var(--brand)', borderRadius: 3, transition: 'width 0.8s cubic-bezier(0.23,1,0.32,1)' }} />
                    </div>
                    <div className="muted" style={{ fontSize: 10, marginTop: 4 }}>
                      {fmtBase(trueNetWorth, profile.displayCurrency, { compact: true })} of {fmtBase(targetRWF, profile.displayCurrency, { compact: true })} target
                    </div>
                  </div>
                );
              })}
            </div>
            {goals.length > 3 && (
              <div className="muted" style={{ fontSize: 11, marginTop: 12, textAlign: 'center' }}>+{goals.length - 3} more goal{goals.length - 3 === 1 ? '' : 's'}</div>
            )}
          </div>
        )}
        {liabilities.length > 0 && activeGoals.length === 0 && (
          <div className="card" style={{ padding: '20px 22px' }}>
            <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>True net worth</div>
            <div className="font-serif" style={{ fontSize: 36, marginBottom: 8 }}>{fmtBase(trueNetWorth, profile.displayCurrency, { compact: true })}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {fmtBase(stats.totalValue, profile.displayCurrency, { compact: true })} assets − {fmtBase(totalDebt, profile.displayCurrency, { compact: true })} debt
            </div>
            <button onClick={() => dispatch({ type: 'nav', to: 'liabilities' })} style={{
              marginTop: 16, border: 0, background: 'transparent', cursor: 'pointer', fontSize: 11, color: 'var(--brand)', fontFamily: 'inherit', padding: 0,
            }}>Manage liabilities →</button>
          </div>
        )}
      </div>
    ),

    markets: (
      <div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="font-serif" style={{ fontSize: 19, letterSpacing: '-0.01em' }}>Markets you watch</div>
          <button onClick={() => dispatch({ type: 'nav', to: 'trends' })} style={{
            border: 0, background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--brand)', fontFamily: 'inherit', padding: 0,
          }}>See all trends →</button>
        </div>
        <div className="dash-grid-4">
          {watchlist.map(d => <TrendCard key={d.id} d={d} override={marketOverrides[d.id]} />)}
        </div>
      </div>
    ),
  };

  return (
    <div className="dash-page">

      {/* Keyframes */}
      <style>{`
        @keyframes imari-slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes imari-shimmer {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        .dash-btn-range { transition: background 0.14s ease-out, color 0.14s ease-out; }
        .dash-btn-range:active { transform: scale(0.97); }
        .dash-arrange-btn { transition: background 0.14s ease-out, color 0.14s ease-out, box-shadow 0.14s ease-out, border-color 0.14s ease-out; }
        .dash-arrange-btn:active { transform: scale(0.97); }
      `}</style>

      {/* ── Pinned Cost-of-Absence (§1) — exactly one highest-severity item ── */}
      {pinnedCost ? (
        <CostOfAbsence
          severity={pinnedCost.costOfAbsence.severity}
          headline={pinnedCost.headline}
          costStatement={pinnedCost.costOfAbsence.costStatement}
          action={pinnedCost.costOfAbsence.action}
          asOf={pinnedCost.dataAsOf}
          now={today}
          onAction={(to) => dispatch({ type: 'nav', to })}
          onDismiss={() => dismissCost(pinnedCost.id)}
        />
      ) : assets.length > 0 ? (
        <div role="status" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', marginBottom: 16, borderRadius: 'var(--r-lg)',
          background: 'color-mix(in oklab, var(--up) 7%, var(--paper))',
          border: '0.5px solid color-mix(in oklab, var(--up) 28%, transparent)',
        }}>
          <span aria-hidden="true" style={{ color: 'var(--up)', fontSize: 15 }}>✓</span>
          <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
            Nothing urgent today — no accruing costs or deadlines in your data right now.
          </span>
        </div>
      ) : null}

      {/* ── Arrange button ─────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: editMode ? 10 : 8 }}>
        <button
          className="dash-arrange-btn"
          onClick={() => setEditMode(e => !e)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '6px 14px', borderRadius: 8,
            border: '1px solid',
            fontFamily: 'inherit', fontSize: 11, fontWeight: 500, cursor: 'pointer',
            background:   editMode ? 'var(--brand)' : 'var(--paper)',
            color:        editMode ? 'var(--brand-ink)' : 'var(--ink-2)',
            borderColor:  editMode ? 'var(--brand)' : 'var(--line)',
            boxShadow:    editMode ? '0 2px 10px color-mix(in oklab, var(--brand) 28%, transparent)' : 'none',
          }}
        >
          {editMode ? (
            <>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2,6 4.5,8.5 9,2.5" />
              </svg>
              Done
            </>
          ) : (
            <>
              <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true">
                {[[3,2],[7,2],[3,7],[7,7],[3,12],[7,12]].map(([cx,cy],i) => (
                  <circle key={i} cx={cx} cy={cy} r={1.5} fill="currentColor" />
                ))}
              </svg>
              Arrange
            </>
          )}
        </button>
      </div>

      {/* ── Edit-mode info bar ─────────────────────────────────── */}
      {editMode && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', marginBottom: 14, borderRadius: 10,
          background: 'color-mix(in oklab, var(--brand) 7%, var(--bg))',
          border: '1px solid color-mix(in oklab, var(--brand) 20%, transparent)',
          animation: 'imari-slideUp 0.18s cubic-bezier(0.23,1,0.32,1) both',
        }}>
          <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true">
            {[[3,2],[7,2],[3,7],[7,7],[3,12],[7,12]].map(([cx,cy],i) => (
              <circle key={i} cx={cx} cy={cy} r={1.5} fill="var(--brand)" />
            ))}
          </svg>
          <span style={{ fontSize: 11.5, color: 'var(--ink-2)', flex: 1 }}>
            <strong>Drag</strong> a section to reorder · <strong>Hide</strong> to collapse from view
          </span>
          <button onClick={resetLayout} style={{
            fontSize: 11, padding: '4px 10px', borderRadius: 6,
            border: '1px solid var(--line)', background: 'var(--paper)',
            cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink-3)',
            transition: 'background 0.12s ease',
          }}>Reset defaults</button>
        </div>
      )}

      {/* ── Sections (order + visibility driven by useDashboardLayout) ── */}
      {order.map(id => {
        const content = sectionContent[id];
        if (!editMode && !content) return null; // data-conditional: skip when no data
        return (
          <SectionShell
            key={id}
            id={id}
            label={SECTION_META[id].label}
            canHide={SECTION_META[id].canHide}
            isHidden={hidden.has(id)}
            hasData={!!content}
            editMode={editMode}
            onReorder={reorder}
            onToggleHide={toggleHide}
          >
            {content}
          </SectionShell>
        );
      })}
    </div>
  );
}
