/**
 * AdvisorView — the Advice Center, Imari's AI showcase.
 *
 * No inline chatbot here anymore: this page is the polished face of the AI —
 * the engine's quantified recommendations, today's market pulse with
 * provenance, portfolio-aware questions, and the user's saved insights.
 * Conversation happens in the floating advisor (the ✦ button, available on
 * every page including this one); every "Discuss" and question chip fires
 * `imari:advisor:ask`, which opens it pre-asked.
 */
import { useMemo, useState } from 'react';
import { FX, fmtNum, suggestValue } from '../data.js';
import { Stagger, StaggerItem, Reveal } from '../components/motion.jsx';
import { useInsights } from '../contexts/InsightsContext.jsx';
import { useMarket } from '../contexts/MarketContext.jsx';
import { REFERENCE } from '../engine/insights/refs.js';
import { severityColor, SEVERITY_LABEL } from '../severity.js';
import { glossaryFor } from '../glossary.js';
import Explain from '../components/Explain.jsx';
import { renderMD } from '../markdown.js';

const askAdvisor = (question) =>
  window.dispatchEvent(new CustomEvent('imari:advisor:ask', { detail: question }));

/** Portfolio-aware question chips — the same personalization the old template
 *  sidebar had, now firing the floating advisor. */
function buildQuestions(assets, profile) {
  const today = new Date();
  const enriched = assets.map(a => {
    const cur = a.currentValue !== '' && a.currentValue != null ? a.currentValue : suggestValue(a, today);
    const pct = a.purchasePrice ? (cur - a.purchasePrice) / a.purchasePrice * 100 : 0;
    return { ...a, _pct: pct, _value: cur };
  });
  const topMover = [...enriched].sort((a, b) => b._pct - a._pct)[0];
  const biggest = [...enriched].sort((a, b) => (b._value * (FX[b.currency] || 1)) - (a._value * (FX[a.currency] || 1)))[0];
  const cur = profile.displayCurrency || 'RWF';

  return [
    `Give me a one-paragraph summary of my financial health.`,
    biggest && `Why is ${biggest.name} my biggest holding — should I be worried?`,
    topMover && topMover._pct > 0 && `${topMover.name} has gained the most — is it likely to keep going?`,
    `Am I too concentrated in any single asset or class?`,
    `What's my approximate annual RRA tax exposure?`,
    `Build a 12-month plan to grow my net worth 25%.`,
    `If I save 200,000 ${cur}/month, when do I hit 50M ${cur}?`,
    `What should my next investment be, given today's rates?`,
  ].filter(Boolean);
}

export default function AdvisorView({ state, dispatch }) {
  const { profile, assets = [] } = state;
  const { recommendations } = useInsights();
  const { market, overrides, fetchedAt } = useMarket();
  const [showAll, setShowAll] = useState(false);

  const questions = useMemo(() => buildQuestions(assets, profile), [assets, profile]);
  const savedInsights = profile.savedInsights || [];
  const removeSaved = (content) =>
    dispatch({ type: 'setProfile', patch: { savedInsights: savedInsights.filter(s => s.content !== content) } });

  // Market pulse — same provenance-tagged values the AI itself is grounded in.
  const bnrUSD = market?.bnrRates?.USD;
  const pulse = [
    bnrUSD && { label: 'USD/RWF (BNR)', value: `${fmtNum(bnrUSD.buy, 0)} / ${fmtNum(bnrUSD.sell, 0)}`, sub: `buy / sell · ${bnrUSD.date}`, live: true },
    { label: 'Inflation (CPI)', value: `${REFERENCE.cpiYoYPct}%`, sub: 'NISR · reference', live: false },
    { label: 'T-bill yield', value: `${REFERENCE.tBillYieldPct}%`, sub: 'BNR auction · reference', live: false },
    overrides?.['bnr-repo'] && { label: 'BNR repo rate', value: `${overrides['bnr-repo'].value ?? ''}%`, sub: 'MPC · reference', live: false },
  ].filter(Boolean);

  const shown = showAll ? recommendations : recommendations.slice(0, 5);

  return (
    <div style={{ padding: 28, background: 'var(--bg)', minHeight: '100vh' }}>
      {/* ── Hero ── */}
      <div className="row" style={{ gap: 14, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
        <div aria-hidden="true" style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'linear-gradient(135deg, var(--brand), var(--brand-2))',
          color: 'var(--brand-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Instrument Serif, serif', fontSize: 28, boxShadow: 'var(--shadow-brand)',
        }}>✦</div>
        <div>
          <h2 className="font-serif" style={{ fontSize: 28, margin: 0, lineHeight: 1.1 }}>
            Your AI Advisor
          </h2>
          <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>
            {recommendations.length > 0
              ? `${recommendations.length} recommendation${recommendations.length > 1 ? 's' : ''} from your numbers and today's market — every figure computed, never guessed.`
              : 'Watching your portfolio against today\'s market — every figure computed, never guessed.'}
          </div>
        </div>
        <button type="button" className="btn btn-primary" style={{ marginLeft: 'auto' }}
          onClick={() => askAdvisor('Give me a one-paragraph summary of my financial health, grounded in my numbers and today\'s market.')}>
          ✦ Ask anything
        </button>
      </div>
      <div className="muted" style={{ fontSize: 11, marginBottom: 18 }}>
        Conversations happen in the floating ✦ assistant — it sees everything on this page. Not professional advice.
      </div>

      {/* ── Market pulse the advice is grounded in ── */}
      <Stagger style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 18 }}>
        {pulse.map(p => (
          <StaggerItem key={p.label} className="card" style={{ padding: '12px 16px' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{p.label}</span>
              <span className="pill pill-soft" style={{ fontSize: 10, color: p.live ? 'var(--up)' : 'var(--gold-ink)' }}>{p.live ? 'live' : 'ref'}</span>
            </div>
            <div className="num" style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{p.value}</div>
            <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>{p.sub}</div>
          </StaggerItem>
        ))}
      </Stagger>

      {/* ── Recommendations — the product ── */}
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div className="font-serif" style={{ fontSize: 20 }}>Today's recommendations</div>
        {recommendations.length > 5 && (
          <button type="button" className="btn-link" style={{ fontSize: 12 }} onClick={() => setShowAll(v => !v)}>
            {showAll ? 'Show top 5' : `Show all ${recommendations.length}`}
          </button>
        )}
      </div>

      {recommendations.length === 0 ? (
        <div className="card" style={{ padding: '28px 24px', marginBottom: 22, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span aria-hidden="true" style={{ color: 'var(--up)', fontSize: 22 }}>✓</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Nothing urgent in your data right now</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2, lineHeight: 1.5 }}>
              The engine re-checks every change you make — add expenses, debts, and goals and the advice sharpens.
            </div>
          </div>
        </div>
      ) : (
        <Stagger className="col" style={{ gap: 12, marginBottom: 26 }}>
          {shown.map(r => {
            const color = severityColor(r.costOfAbsence.severity);
            const terms = glossaryFor(r.id);
            return (
              <StaggerItem key={r.id} className="card" style={{ padding: '16px 20px', borderLeft: `3px solid ${color}` }}>
                <div className="row" style={{ gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span className="pill pill-soft" style={{ fontSize: 10, fontWeight: 700, color }}>
                    {SEVERITY_LABEL[r.costOfAbsence.severity] || r.costOfAbsence.severity}
                  </span>
                  <div className="font-serif" style={{ fontSize: 17 }}>{r.headline}</div>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-2)', marginTop: 6 }}>{r.body}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 8, color: 'var(--ink)' }}>{r.costOfAbsence.costStatement}</div>
                <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button type="button" className="btn btn-primary" style={{ fontSize: 12, padding: '7px 13px' }}
                    onClick={() => askAdvisor(`Imari flagged this for me: "${r.headline}". ${r.costOfAbsence.costStatement} Walk me through what's behind it and exactly how I should act on it, step by step.`)}>
                    ✦ Discuss this
                  </button>
                  {r.costOfAbsence.action && (
                    <button type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: '7px 13px' }}
                      onClick={() => dispatch({ type: 'nav', to: r.costOfAbsence.action.to })}>
                      {r.costOfAbsence.action.label} →
                    </button>
                  )}
                </div>
                {terms.length > 0 && <Explain entries={terms} style={{ marginTop: 12 }} />}
              </StaggerItem>
            );
          })}
        </Stagger>
      )}

      {/* ── Ask about your portfolio ── */}
      <div className="font-serif" style={{ fontSize: 20, marginBottom: 10 }}>Ask about your portfolio</div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 26 }}>
        {questions.map(q => (
          <button key={q} type="button" onClick={() => askAdvisor(q)}
            style={{
              padding: '9px 14px', borderRadius: 'var(--r-pill)', cursor: 'pointer',
              background: 'var(--paper)', border: '1px solid var(--line)',
              fontSize: 12.5, color: 'var(--ink-2)', fontFamily: 'inherit',
              transition: 'all .12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.color = 'var(--brand)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--ink-2)'; }}
          >✦ {q}</button>
        ))}
      </div>

      {/* ── Saved insights ── */}
      {savedInsights.length > 0 && (
        <>
          <div className="font-serif" style={{ fontSize: 20, marginBottom: 10 }}>Saved insights</div>
          <div className="col" style={{ gap: 10, maxWidth: 820 }}>
            {[...savedInsights].reverse().map((sv, i) => (
              <div key={i} className="card" style={{ padding: '14px 18px' }}>
                <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                  <div className="muted" style={{ fontSize: 10.5 }}>
                    {sv.question ? `“${sv.question}” · ` : ''}{new Date(sv.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                  <button type="button" className="btn-icon-sm" aria-label="Remove saved insight" onClick={() => removeSaved(sv.content)}>
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.6, marginTop: 6 }}
                  dangerouslySetInnerHTML={{ __html: renderMD(sv.content, assets.map(a => a.name)) }} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
