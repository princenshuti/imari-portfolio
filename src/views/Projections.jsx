import { useState, useMemo } from 'react';
import { fmtBase } from '../data.js';
import { projectNetWorth, DEFAULT_ASSUMPTIONS } from '../engine/projection/index.js';
import { netWorthRWF, monthlyFlowsRWF } from '../engine/insights/_shared.js';
import { getApiKey, completeText } from '../ai.js';

// B12a/b — Fast Forward: deterministic projection + scenario controls, with an
// optional AI narration grounded ONLY in the engine output. Modeled, never a guarantee.
export default function ProjectionsView({ state }) {
  const { profile } = state;
  const ccy = profile.displayCurrency || 'RWF';
  const today = new Date();

  const nw = useMemo(() => netWorthRWF(state, today), [state]);
  const baseMonthly = useMemo(() => {
    const { monthlyIncome, monthlyExpense } = monthlyFlowsRWF(state.cashflows || [], today);
    return Math.max(0, Math.round(monthlyIncome - monthlyExpense));
  }, [state]);

  const [extraMonthly, setExtraMonthly] = useState(0);
  const [lumpSum, setLumpSum] = useState(0);
  const [growth, setGrowth] = useState(DEFAULT_ASSUMPTIONS.expectedAnnualGrowthPct);
  const [aiText, setAiText] = useState('');
  const [aiPending, setAiPending] = useState(false);
  const [aiErr, setAiErr] = useState('');

  const monthlySavings = baseMonthly + (+extraMonthly || 0);
  const assumptions = { expectedAnnualGrowthPct: +growth || 0 };

  const proj = useMemo(() => projectNetWorth({ currentNetWorth: nw, monthlySavings, lumpSum: +lumpSum || 0, assumptions }),
    [nw, monthlySavings, lumpSum, growth]);
  const base = useMemo(() => projectNetWorth({ currentNetWorth: nw, monthlySavings: baseMonthly, lumpSum: 0, assumptions }),
    [nw, baseMonthly, growth]);
  const scenarioChanged = (+extraMonthly || 0) > 0 || (+lumpSum || 0) > 0;

  const narrate = async () => {
    if (aiPending) return;
    const key = getApiKey();
    if (!key) { setAiErr('Add your AI key in Settings to narrate this scenario.'); return; }
    setAiPending(true); setAiErr('');
    const lines = proj.horizons.map(h => `${h.label}: expected ${Math.round(h.expected)} RWF (range ${Math.round(h.low)}–${Math.round(h.high)})`).join('\n');
    const prompt = `You are Imari Advisor for ${profile.name || 'the user'} in Rwanda. Below is a DETERMINISTIC net-worth projection (figures are fixed — do not change or invent any). Current net worth ${Math.round(nw)} RWF, saving ${monthlySavings} RWF/month, assumed ${assumptions.expectedAnnualGrowthPct}%/yr growth.

${lines}

Write 2 short paragraphs in plain English explaining what this trajectory means and one lever to improve it. Use the given figures only. No headings. End with a one-line reminder that this is a modeled estimate, not professional advice.`;
    try {
      setAiText((await completeText(key, prompt)).trim());
    } catch (e) { setAiErr(e.message || 'Could not reach the AI service.'); }
    finally { setAiPending(false); }
  };

  const numInput = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 13, width: '100%' };

  return (
    <div style={{ padding: 28, background: 'var(--bg)', minHeight: 'calc(100vh - 70px)' }}>
      <div style={{ marginBottom: 18 }}>
        <div className="font-serif" style={{ fontSize: 26 }}>Fast Forward</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>Where today's habits take your net worth — a modeled projection, not a guarantee.</div>
      </div>

      {/* Scenario controls */}
      <div className="card" style={{ padding: '18px 20px', marginBottom: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <label className="col" style={{ gap: 5 }}>
            <span className="muted" style={{ fontSize: 11 }}>Add monthly saving ({ccy})</span>
            <input type="number" min="0" value={extraMonthly} onChange={e => setExtraMonthly(e.target.value)} style={numInput} />
            <span className="muted" style={{ fontSize: 10 }}>Base from cash flow: {fmtBase(baseMonthly, ccy, { compact: true })}/mo</span>
          </label>
          <label className="col" style={{ gap: 5 }}>
            <span className="muted" style={{ fontSize: 11 }}>One-time lump sum ({ccy})</span>
            <input type="number" min="0" value={lumpSum} onChange={e => setLumpSum(e.target.value)} style={numInput} />
          </label>
          <label className="col" style={{ gap: 5 }}>
            <span className="muted" style={{ fontSize: 11 }}>Expected growth %/yr</span>
            <input type="number" min="0" max="40" value={growth} onChange={e => setGrowth(e.target.value)} style={numInput} />
            <span className="muted" style={{ fontSize: 10 }}>Modeled · ±{DEFAULT_ASSUMPTIONS.bandSpreadPct}% band</span>
          </label>
        </div>
      </div>

      {/* Horizon cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
        {proj.horizons.map(h => {
          const delta = scenarioChanged ? h.expected - base.horizons.find(b => b.key === h.key).expected : 0;
          return (
            <div key={h.key} className="card" style={{ padding: '16px 18px' }}>
              <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h.label}</div>
              <div className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', marginTop: 4 }}>{fmtBase(h.expected, ccy, { compact: true })}</div>
              <div className="muted" style={{ fontSize: 10.5, marginTop: 3 }}>{fmtBase(h.low, ccy, { compact: true })} – {fmtBase(h.high, ccy, { compact: true })}</div>
              <div className="muted" style={{ fontSize: 10, marginTop: 3 }}>≈ {fmtBase(h.realExpected, ccy, { compact: true })} in today's money</div>
              {scenarioChanged && delta > 0 && (
                <div style={{ fontSize: 11, marginTop: 6, color: 'var(--up)', fontWeight: 600 }}>+{fmtBase(delta, ccy, { compact: true })} vs current pace</div>
              )}
            </div>
          );
        })}
      </div>

      {/* AI advisory narration */}
      <div className="card" style={{ padding: '18px 20px' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: aiText || aiErr ? 12 : 0 }}>
          <div className="font-serif" style={{ fontSize: 16 }}>What this means</div>
          <button onClick={narrate} disabled={aiPending} className="btn btn-primary btn-sm">{aiPending ? 'Thinking…' : '✦ Explain scenario'}</button>
        </div>
        {aiErr && <div role="alert" style={{ fontSize: 12.5, color: 'var(--down-ink)' }}>{aiErr}</div>}
        {aiText && <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{aiText}</div>}
        <div className="muted" style={{ fontSize: 10.5, marginTop: 12, lineHeight: 1.5 }}>
          Projections are modeled estimates based on your assumptions — actual returns vary and this is not professional financial advice.
        </div>
      </div>
    </div>
  );
}
