// Family — the household's Sunday screen: money cockpit (from the portfolio),
// this week's scorecard, annual milestones and the shared planning notes.
// Money numbers are read from engine helpers so they can never disagree with
// the Dashboard; family data comes from useFamily (migration 006 tables).
import { useMemo } from 'react';
import { fmtBase } from '../data.js';
import { netWorthRWF, totalDebtRWF, liquidValueRWF, monthlyFlowsRWF } from '../engine/insights/_shared.js';
import { goalProgressPct } from '../engine/goals.js';
import { KPI, inputStyle } from '../components/Field.jsx';
import { BarFill } from '../components/motion.jsx';
import { useFamily, useDebouncedNote } from '../family/useFamily.js';
import { useItems } from '../family/useItems.js';
import { deriveEvents } from '../family/planning.js';
import { Due } from '../family/ui.jsx';
import { MILESTONES, PLAN_FIELDS, NOTE_KEY, MAX_SCORE, weekStart, weekScore, rating, toLocalISO } from '../family/habits.js';

const textareaStyle = { ...inputStyle, minHeight: 88, resize: 'vertical', lineHeight: 1.5 };

export default function Family({ state, dispatch, portfolioId, role }) {
  const { logs, notes, error, canEdit, saveNote } = useFamily(portfolioId, role);
  const { items } = useItems(portfolioId, role);
  const cur = state.profile.displayCurrency || 'RWF';
  const now = useMemo(() => new Date(), []);
  const week = weekStart(now);

  const money = useMemo(() => {
    const { monthlyExpense } = monthlyFlowsRWF(state.cashflows || [], now);
    const liquid = liquidValueRWF(state.assets || [], now);
    const debts = (state.liabilities || []).slice().sort((a, b) => (b.remainingAmount || 0) - (a.remainingAmount || 0));
    return {
      netWorth: netWorthRWF(state, now),
      runway: monthlyExpense > 0 ? liquid / monthlyExpense : null,
      debt: totalDebtRWF(state.liabilities || []),
      topDebt: debts[0] || null,
    };
  }, [state, now]);

  const goals = useMemo(() => (state.goals || [])
    .filter(g => !g.achieved)
    .map(g => ({ ...g, pct: goalProgressPct(g, state, now) }))
    .sort((a, b) => (a.deadline || '9999') < (b.deadline || '9999') ? -1 : 1)
    .slice(0, 5), [state, now]);

  const upcoming = useMemo(() => deriveEvents(state, items || [], { now, days: 14 }).filter(e => e.in >= -7).slice(0, 8), [state, items, now]);
  const score = logs ? weekScore(logs, week) : null;
  const r = rating(score || 0);
  const msDone = MILESTONES.filter(m => notes[NOTE_KEY.milestone(m.id)]).length;
  const go = to => dispatch({ type: 'nav', to });

  if (!portfolioId) {
    return <div className="card muted" style={{ padding: 20 }}>Sign in to use the Family module — it is shared with the members of your portfolio.</div>;
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      {error && <div className="card" role="alert" style={{ padding: '10px 14px', color: 'var(--down-ink)', background: 'var(--down-soft)' }}>{error}</div>}

      <div className="dash-kpi-grid">
        <KPI label="Net worth" value={fmtBase(money.netWorth, cur)} sub="Assets − liabilities" />
        <KPI label="Runway" value={money.runway == null ? '—' : `${money.runway.toFixed(1)} mo`}
             sub={money.runway == null ? 'Add expenses in Cash Flow' : 'Liquid ÷ monthly spend'}
             accent={money.runway != null && money.runway < 3 ? 'var(--down)' : 'var(--brand)'} />
        <KPI label="Debt remaining" value={fmtBase(money.debt, cur)}
             sub={money.topDebt ? `${money.topDebt.name || money.topDebt.lender || 'Largest loan'}${money.topDebt.endDate ? ` · ends ${money.topDebt.endDate}` : ''}` : 'No liabilities tracked'}
             accent={money.debt > 0 ? 'var(--gold-ink)' : 'var(--brand)'} />
        <KPI label="This week" value={score == null ? '…' : `${score}/${MAX_SCORE}`} sub={score == null ? 'Loading' : `${r.label} · week of ${week}`} accent={r.color} />
      </div>

      <div className="dash-grid-2">
        <div className="card" style={{ padding: 18 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div className="font-serif" style={{ fontSize: 18 }}>Goals on the table</div>
            <button className="btn btn-ghost btn-xs" onClick={() => go('goals')}>All goals →</button>
          </div>
          {goals.length === 0 && <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>No active goals yet. Add the emergency fund, plot and vehicle targets in Goals.</div>}
          <div className="col" style={{ gap: 12, marginTop: 12 }}>
            {goals.map(g => (
              <div key={g.id}>
                <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{g.title || 'Untitled goal'}</span>
                  <span className="muted num">{Math.round(g.pct)}%{g.deadline ? ` · ${g.deadline}` : ''}</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-2)', borderRadius: 3, marginTop: 5, overflow: 'hidden' }}>
                  <BarFill pct={g.pct} color={g.pct >= 100 ? 'var(--up)' : 'var(--brand)'} radius={3} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div className="font-serif" style={{ fontSize: 18 }}>Annual milestones</div>
            <span className="pill pill-brand num">{msDone}/{MILESTONES.length}</span>
          </div>
          <div className="col" style={{ gap: 2, marginTop: 10, maxHeight: 320, overflowY: 'auto' }}>
            {MILESTONES.map(m => {
              const doneAt = notes[NOTE_KEY.milestone(m.id)];
              return (
                <label key={m.id} className="row" style={{ gap: 10, padding: '6px 4px', fontSize: 13, cursor: canEdit ? 'pointer' : 'default', alignItems: 'flex-start' }}>
                  <input type="checkbox" checked={!!doneAt} disabled={!canEdit}
                         onChange={e => saveNote(NOTE_KEY.milestone(m.id), e.target.checked ? toLocalISO(now) : '')}
                         style={{ marginTop: 3, accentColor: 'var(--up)' }} />
                  <span style={{ flex: 1, textDecoration: doneAt ? 'line-through' : 'none', color: doneAt ? 'var(--ink-3)' : 'var(--ink)' }}>
                    {m.label} <span className="muted" style={{ fontSize: 11 }}>· {doneAt || m.tag}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div className="font-serif" style={{ fontSize: 18 }}>Next two weeks</div>
          <button className="btn btn-ghost btn-xs" onClick={() => go('calendar')}>Full calendar →</button>
        </div>
        {upcoming.length === 0 && <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>Nothing due in the next two weeks.</div>}
        <div className="col" style={{ gap: 2, marginTop: 8 }}>
          {upcoming.map(e => (
            <button key={`${e.source}-${e.id}-${e.date}`} className="btn-unstyled row" onClick={() => go(e.to)} style={{ width: '100%', gap: 10, padding: '6px 0', borderTop: '1px solid var(--line-soft)', textAlign: 'left', cursor: 'pointer', fontSize: 13 }}>
              <span className="muted num" style={{ minWidth: 84, fontSize: 12 }}>{e.date.slice(5)}</span><span style={{ flex: 1 }}>{e.title}</span><Due days={e.in} />
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div className="font-serif" style={{ fontSize: 18 }}>Shared planning</div>
            <div className="muted" style={{ fontSize: 12 }}>Both members edit these; changes save automatically and appear live for each other.</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => go('scorecard')}>Open weekly scorecard →</button>
        </div>
        <div className="dash-grid-2" style={{ marginTop: 6 }}>
          {PLAN_FIELDS.map(f => (
            <PlanField key={f.key} field={f} value={notes[NOTE_KEY.plan(f.key)] || ''} canEdit={canEdit}
                       onSave={body => saveNote(NOTE_KEY.plan(f.key), body)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PlanField({ field, value, canEdit, onSave }) {
  const [draft, update, flush] = useDebouncedNote(value, onSave);
  return (
    <div style={{ marginTop: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <label htmlFor={`plan-${field.key}`} style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)' }}>{field.label}</label>
        <span className="muted" style={{ fontSize: 10 }}>{field.hint}</span>
      </div>
      <textarea id={`plan-${field.key}`} value={draft} onChange={e => update(e.target.value)} onBlur={flush}
                readOnly={!canEdit} maxLength={4000} style={textareaStyle} />
    </div>
  );
}
