import { useState, useMemo } from 'react';
import { GOAL_CATEGORIES, CURRENCIES, toBase, fmtBase, fmt, id, valueRWF, costRWF } from '../data.js';
import { Field, inputStyle } from '../components/Field.jsx';
import Modal from '../components/Modal.jsx';
import { ConfirmDestructive } from '../components/ConfirmDestructive.jsx';

const EMPTY_GOAL = {
  category: 'investment', title: '', targetAmount: '', currency: 'RWF',
  deadline: '', notes: '', achieved: false, achievedAt: null,
  // UX review #41 — what counts as progress toward this goal:
  //   'net-worth' (default, back-compat): whole net worth, even land you can't liquidate
  //   'liquid':    cash + savings + MoMo only
  //   'linked':    sum of explicitly-linked asset IDs
  fundingType: 'net-worth',
  linkedAssetIds: [],
};

// Rwanda-tuned goal templates — pre-fill the editor with sensible defaults
// for the most common targets. Saves user typing on first run.
// (UX review #42.)
const GOAL_TEMPLATES = [
  { id: 'emergency-fund', icon: '🛡', title: 'Emergency fund (3 months)', category: 'emergency',  targetAmount: 1_800_000, fundingType: 'liquid' },
  { id: 'school-fees',    icon: '🎓', title: "Children's school fees",     category: 'education',  targetAmount: 5_000_000, fundingType: 'liquid' },
  { id: 'house-down',     icon: '🏠', title: 'House down-payment (30%)',   category: 'house',      targetAmount: 30_000_000, fundingType: 'net-worth' },
  { id: 'land',           icon: '📐', title: 'Buy land',                   category: 'land',       targetAmount: 15_000_000, fundingType: 'net-worth' },
  { id: 'vehicle',        icon: '🚗', title: 'New vehicle',                category: 'vehicle',    targetAmount: 18_000_000, fundingType: 'net-worth' },
  { id: 'hajj',           icon: '🕋', title: 'Hajj / Pilgrimage',          category: 'travel',     targetAmount: 12_000_000, fundingType: 'liquid' },
  { id: 'dowry',          icon: '💝', title: 'Wedding / Dowry',            category: 'other-goal', targetAmount: 5_000_000, fundingType: 'liquid' },
  { id: 'retirement',     icon: '🌅', title: 'Retirement nest egg',        category: 'retirement', targetAmount: 100_000_000, fundingType: 'net-worth' },
  { id: 'business',       icon: '💼', title: 'Start a business',           category: 'business',   targetAmount: 10_000_000, fundingType: 'liquid' },
];

// Which asset kinds count as "liquid" for fundingType='liquid' goals.
const LIQUID_KINDS = new Set(['savings', 'momo-cash']);

function GoalEditor({ goal, onSave, onCancel, assets = [] }) {
  const isNew = !goal.id;
  const [g, setG] = useState({ ...EMPTY_GOAL, ...goal, id: goal.id || id() });
  const u = (k, v) => setG(s => ({ ...s, [k]: v }));
  const cat = GOAL_CATEGORIES.find(c => c.id === g.category) || GOAL_CATEGORIES[0];
  const applyTemplate = (t) => setG(s => ({
    ...s, title: t.title, category: t.category, targetAmount: t.targetAmount,
    fundingType: t.fundingType, currency: 'RWF',
  }));

  return (
    <Modal open onClose={onCancel} maxWidth={560} title={isNew ? 'New goal' : 'Edit goal'}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 className="font-serif" style={{ fontSize: 22, margin: 0, fontWeight: 400 }}>{isNew ? 'New goal' : 'Edit goal'}</h2>
          <button type="button" onClick={onCancel} aria-label="Close dialog" className="btn-icon-sm">
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {/* Template chips — shown only for new goals to avoid clobbering edits. */}
        {isNew && (
          <div style={{ marginBottom: 18 }}>
            <div className="muted" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
              Start from a template
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {GOAL_TEMPLATES.map(t => (
                <button
                  key={t.id} type="button" onClick={() => applyTemplate(t)}
                  className="pill pill-soft"
                  style={{ fontSize: 11, padding: '5px 10px', border: 0, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <span aria-hidden="true" style={{ marginRight: 4 }}>{t.icon}</span>{t.title}
                </button>
              ))}
            </div>
          </div>
        )}

        <Field label="Category">
          <div role="radiogroup" aria-label="Goal category" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {GOAL_CATEGORIES.map(c => {
              const selected = c.id === g.category;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => u('category', c.id)}
                  style={{
                    padding: '8px 6px', borderRadius: 8, cursor: 'pointer', textAlign: 'center', fontSize: 11,
                    background: selected ? 'var(--brand-soft)' : 'var(--bg-2)',
                    color: selected ? 'var(--brand)' : 'var(--ink-2)',
                    border: selected ? '1px solid var(--brand)' : '1px solid transparent',
                    fontFamily: 'inherit',
                  }}
                >
                  <div aria-hidden="true" style={{ fontSize: 18, marginBottom: 2 }}>{c.icon}</div>
                  <div style={{ lineHeight: 1.2 }}>{c.label}</div>
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Goal title" top={16}>
          <input value={g.title} onChange={e => u('title', e.target.value)}
            placeholder={`e.g. ${cat.label}`} style={inputStyle} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 4 }}>
          <Field label="Target amount">
            <input type="number" value={g.targetAmount} onChange={e => u('targetAmount', e.target.value)}
              placeholder="0" style={inputStyle} />
          </Field>
          <Field label="Currency">
            <select value={g.currency} onChange={e => u('currency', e.target.value)} style={inputStyle}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
            </select>
          </Field>
          <Field label="Target deadline">
            <input type="date" value={g.deadline} onChange={e => u('deadline', e.target.value)} style={inputStyle} />
          </Field>
        </div>

        {/* Funding source — what counts toward this goal. */}
        <Field label="Funded by" top={14}>
          <div role="radiogroup" aria-label="Funding source" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {[
              { id: 'net-worth', label: 'Net worth',       sub: 'All assets minus debts' },
              { id: 'liquid',    label: 'Liquid only',     sub: 'Cash, savings, MoMo' },
              { id: 'linked',    label: 'Specific assets', sub: 'Pick which ones' },
            ].map(opt => {
              const selected = g.fundingType === opt.id;
              return (
                <button
                  key={opt.id} type="button" role="radio" aria-checked={selected}
                  onClick={() => u('fundingType', opt.id)}
                  style={{
                    padding: '8px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    background: selected ? 'var(--brand-soft)' : 'var(--bg-2)',
                    color:      selected ? 'var(--brand)'      : 'var(--ink-2)',
                    border:     selected ? '1px solid var(--brand)' : '1px solid transparent',
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{opt.label}</div>
                  <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>{opt.sub}</div>
                </button>
              );
            })}
          </div>
        </Field>

        {/* Asset multi-select — only meaningful when fundingType==='linked' */}
        {g.fundingType === 'linked' && (
          <Field label="Linked assets" top={12}>
            <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 6, padding: 4 }}>
              {assets.length === 0 ? (
                <div className="muted" style={{ fontSize: 12, padding: 12, textAlign: 'center' }}>No assets yet — add one first.</div>
              ) : assets.map(a => {
                const checked = (g.linkedAssetIds || []).includes(a.id);
                return (
                  <label key={a.id} className="row" style={{ gap: 8, padding: '6px 8px', borderRadius: 5, cursor: 'pointer', fontSize: 12.5 }}>
                    <input
                      type="checkbox" checked={checked}
                      onChange={e => {
                        const next = new Set(g.linkedAssetIds || []);
                        e.target.checked ? next.add(a.id) : next.delete(a.id);
                        u('linkedAssetIds', Array.from(next));
                      }}
                    />
                    <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                    <span className="muted num" style={{ fontSize: 10.5 }}>{fmt(valueRWF(a, new Date()), 'RWF', { compact: true })}</span>
                  </label>
                );
              })}
            </div>
          </Field>
        )}

        <Field label="Notes" top={14}>
          <textarea value={g.notes} onChange={e => u('notes', e.target.value)} placeholder="optional"
            style={{ ...inputStyle, minHeight: 52, fontFamily: 'inherit', resize: 'vertical', paddingTop: 8 }} />
        </Field>

        <div className="row" style={{ gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} className="btn btn-ghost">Cancel</button>
          <button type="button" onClick={() => onSave({ ...g, targetAmount: +g.targetAmount || 0 })}
            className="btn btn-primary" disabled={!g.title || !g.targetAmount}>
            {isNew ? 'Create goal' : 'Save changes'}
          </button>
        </div>
    </Modal>
  );
}

function GoalCard({ goal, currentValue, displayCurrency, onEdit, onDelete }) {
  const cat = GOAL_CATEGORIES.find(c => c.id === goal.category) || GOAL_CATEGORIES[0];
  const targetRWF = toBase(goal.targetAmount || 0, goal.currency || 'RWF');
  // currentValue is derived per-fundingType by the parent — net-worth / liquid / linked-sum
  const pct = targetRWF > 0 ? Math.min((currentValue / targetRWF) * 100, 100) : 0;
  const remaining = Math.max(targetRWF - currentValue, 0);
  const today = new Date();
  const deadline = goal.deadline ? new Date(goal.deadline) : null;
  const daysLeft = deadline ? Math.ceil((deadline - today) / 86400000) : null;
  const monthsLeft = daysLeft !== null ? daysLeft / 30.44 : null;
  const monthlySavingsNeeded = (monthsLeft && monthsLeft > 0 && remaining > 0)
    ? remaining / monthsLeft : null;

  const isAchieved = goal.achieved || pct >= 100;
  const isOverdue  = deadline && deadline < today && !isAchieved;

  // Status pill — green on track / amber slipping / red overdue (UX review #43)
  // "Slipping" = the implied required monthly save is > 2× a reasonable rate
  // we can't actually compute without income data, so fall back to: less than
  // 25% of the way through but past 50% of the timeline.
  let status = 'on-track';
  if (isAchieved)      status = 'done';
  else if (isOverdue)  status = 'overdue';
  else if (deadline && daysLeft !== null) {
    const totalDays = goal.createdAt
      ? Math.max(1, Math.ceil((deadline - new Date(goal.createdAt)) / 86400000))
      : Math.max(1, daysLeft + 30); // fallback
    const timeElapsedPct = ((totalDays - daysLeft) / totalDays) * 100;
    if (timeElapsedPct - pct > 15) status = 'slipping';
  }
  const statusMeta = {
    'on-track': { label: 'On track', color: 'var(--up)',   bg: 'var(--up-soft)'   },
    'slipping': { label: 'Slipping', color: 'var(--gold)', bg: 'var(--gold-soft)' },
    'overdue':  { label: 'Overdue',  color: 'var(--down)', bg: 'var(--down-soft)' },
    'done':     { label: 'Done',     color: 'var(--up)',   bg: 'var(--up-soft)'   },
  }[status];

  const deadlineFmt = deadline ? deadline.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  // Milestone celebration markers — display ticks at 25/50/75% on the progress bar
  const milestones = [25, 50, 75];

  return (
    <div className="card" style={{
      padding: '20px 22px', marginBottom: 14,
      borderLeft: `3px solid ${isAchieved ? 'var(--up)' : isOverdue ? 'var(--down)' : 'var(--brand)'}`,
    }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="row" style={{ gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 28 }}>{cat.icon}</span>
          <div>
            <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{goal.title}</span>
              <span className="pill" style={{ background: statusMeta.bg, color: statusMeta.color, fontSize: 9.5 }}>
                {statusMeta.label}
              </span>
            </div>
            <div className="muted" style={{ fontSize: 11 }}>
              {cat.label}
              {deadlineFmt && (
                <span style={{ marginLeft: 8, color: isOverdue ? 'var(--down)' : daysLeft < 90 ? 'var(--gold)' : 'var(--ink-3)' }}>
                  · {deadlineFmt} {isOverdue
                    ? `(${Math.abs(daysLeft)}d overdue)`
                    : daysLeft !== null ? `(${daysLeft}d left)` : ''}
                </span>
              )}
              {goal.fundingType === 'liquid'  && <span style={{ marginLeft: 8 }}>· liquid only</span>}
              {goal.fundingType === 'linked' && <span style={{ marginLeft: 8 }}>· {(goal.linkedAssetIds || []).length} linked</span>}
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" onClick={onEdit} aria-label={`Edit ${goal.title}`} className="btn btn-ghost btn-xs">Edit</button>
          <button type="button" onClick={onDelete} aria-label={`Delete ${goal.title}`} className="btn btn-xs" style={{
            border: '1px solid var(--down-soft)', background: 'transparent', color: 'var(--down-ink)',
          }}>Delete</button>
        </div>
      </div>

      {/* Progress bar with milestone ticks at 25/50/75% */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span className="num" style={{ fontSize: 13, fontWeight: 700 }}>
            {fmtBase(currentValue, displayCurrency, { compact: true })}
          </span>
          <span className="num" style={{ fontSize: 13, color: 'var(--ink-3)' }}>
            / {fmt(goal.targetAmount, goal.currency, { compact: true })}
          </span>
        </div>
        <div style={{ position: 'relative', height: 8, background: 'var(--bg-2)', borderRadius: 4, overflow: 'visible' }}>
          <div style={{
            height: '100%', width: pct + '%',
            background: isAchieved ? 'var(--up)' : isOverdue ? 'var(--down)' : 'var(--brand)',
            borderRadius: 4,
            transition: 'width 600ms cubic-bezier(0.23, 1, 0.32, 1)',
          }} />
          {milestones.map(m => (
            <span key={m}
              title={`${m}% milestone${pct >= m ? ' — reached!' : ''}`}
              aria-hidden="true"
              style={{
                position: 'absolute', top: -2, left: `${m}%`,
                width: 2, height: 12, background: pct >= m ? 'var(--up)' : 'var(--ink-4)',
                opacity: pct >= m ? 0.9 : 0.4,
                borderRadius: 1, transform: 'translateX(-1px)',
                transition: 'background 200ms ease, opacity 200ms ease',
              }} />
          ))}
        </div>
        <div className="muted" style={{ fontSize: 10, marginTop: 3, display: 'flex', justifyContent: 'space-between' }}>
          <span>{pct.toFixed(1)}% of target</span>
          {remaining > 0 && <span>Still need {fmtBase(remaining, displayCurrency, { compact: true })}</span>}
        </div>
      </div>

      {/* Monthly savings needed */}
      {monthlySavingsNeeded !== null && remaining > 0 && !isAchieved && (
        <div style={{
          padding: '8px 12px', borderRadius: 'var(--r-sm)',
          background: 'var(--brand-soft)', fontSize: 11, color: 'var(--brand)',
        }}>
          Save <strong>{fmtBase(monthlySavingsNeeded, displayCurrency, { compact: true })}/month</strong> to hit this goal on time.
        </div>
      )}
    </div>
  );
}

export default function GoalsView({ state, dispatch }) {
  const [pendingDelete, setPendingDelete] = useState(null);
  const { goals = [], profile } = state;
  const [editing, setEditing] = useState(null);
  const today = new Date();

  const netWorth = useMemo(() => {
    return state.assets.reduce((s, a) => s + valueRWF(a, today), 0) -
      (state.liabilities || []).reduce((s, l) => s + toBase(l.remainingAmount || 0, l.currency || 'RWF'), 0);
  }, [state.assets, state.liabilities]);

  const liquidValue = useMemo(() =>
    state.assets.filter(a => LIQUID_KINDS.has(a.kind))
      .reduce((s, a) => s + valueRWF(a, today), 0),
    [state.assets]);

  // Resolve the right "current value" for a goal based on its fundingType.
  // Memoised so re-rendering goal cards doesn't recompute per-goal sums.
  const currentValueFor = useMemo(() => {
    const assetById = new Map(state.assets.map(a => [a.id, a]));
    return (goal) => {
      if (goal.fundingType === 'liquid') return liquidValue;
      if (goal.fundingType === 'linked') {
        return (goal.linkedAssetIds || []).reduce((s, id) => {
          const a = assetById.get(id);
          return a ? s + valueRWF(a, today) : s;
        }, 0);
      }
      return netWorth; // default 'net-worth'
    };
  }, [state.assets, liquidValue, netWorth]);

  const active   = goals.filter(g => !g.achieved);
  const achieved = goals.filter(g => g.achieved);

  return (
    <div style={{ padding: 28, background: 'var(--bg)', minHeight: 'calc(100vh - 70px)' }}>

      {/* Header */}
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <div className="font-serif" style={{ fontSize: 26 }}>Financial Goals</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
            {active.length} active · {achieved.length} achieved
          </div>
        </div>
        <button onClick={() => setEditing({})} className="btn btn-primary">＋ New goal</button>
      </div>

      {/* Goals overview strip */}
      {goals.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 22 }}>
          {[
            { label: 'Active goals', value: active.length, sub: 'in progress' },
            { label: 'Net worth', value: fmtBase(netWorth, profile.displayCurrency, { compact: true }), sub: 'assets − liabilities', isNum: true },
            {
              label: 'Nearest goal',
              value: (() => {
                const sorted = active.filter(g => g.deadline).sort((a, b) => a.deadline.localeCompare(b.deadline));
                return sorted[0]?.title || '—';
              })(),
              sub: (() => {
                const sorted = active.filter(g => g.deadline).sort((a, b) => a.deadline.localeCompare(b.deadline));
                const d = sorted[0]?.deadline;
                if (!d) return 'no deadline';
                return `${Math.ceil((new Date(d) - today) / 86400000)}d away`;
              })(),
            },
          ].map((c, i) => (
            <div key={i} style={{ padding: '14px 18px', borderRadius: 'var(--r-md)', background: 'var(--paper)', border: '0.5px solid var(--line)' }}>
              <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
              <div className={c.isNum ? 'num' : ''} style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>{c.value}</div>
              <div className="muted" style={{ fontSize: 10 }}>{c.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Active goals */}
      {active.map(g => (
        <GoalCard key={g.id} goal={g} currentValue={currentValueFor(g)} displayCurrency={profile.displayCurrency}
          onEdit={() => setEditing(g)}
          onDelete={() => setPendingDelete(g)}
        />
      ))}

      {/* Achieved goals */}
      {achieved.length > 0 && (
        <>
          <div className="muted" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '24px 0 12px' }}>
            Achieved ({achieved.length})
          </div>
          {achieved.map(g => (
            <GoalCard key={g.id} goal={g} currentValue={currentValueFor(g)} displayCurrency={profile.displayCurrency}
              onEdit={() => setEditing(g)}
              onDelete={() => setPendingDelete(g)}
            />
          ))}
        </>
      )}

      {goals.length === 0 && (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
          <div className="font-serif" style={{ fontSize: 22, marginBottom: 8 }}>Set your first goal</div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 20 }}>
            Define what you're saving toward — a plot, emergency fund, school fees — and Imari tracks your progress.
          </div>
          <button onClick={() => setEditing({})} className="btn btn-primary">＋ Create a goal</button>
        </div>
      )}

      {editing !== null && (
        <GoalEditor
          goal={editing}
          assets={state.assets}
          onSave={g => {
            // Stamp createdAt on first save so the "slipping" timeline math has an anchor.
            const next = g.createdAt ? g : { ...g, createdAt: new Date().toISOString() };
            dispatch({ type: 'upsertGoal', goal: next });
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      <ConfirmDestructive
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          dispatch({ type: 'deleteGoal', id: pendingDelete.id });
          setPendingDelete(null);
        }}
        title="Delete this goal?"
        description={pendingDelete && (
          <span>
            <strong style={{ color: 'var(--ink)' }}>{pendingDelete.title}</strong>
            {pendingDelete.targetAmount ? <> · target <span className="num">{fmt(pendingDelete.targetAmount, pendingDelete.currency || 'RWF')}</span></> : null}
            <br />
            Your progress history for this goal will be lost. You can't undo this.
          </span>
        )}
        confirmLabel="Delete goal"
      />
    </div>
  );
}
