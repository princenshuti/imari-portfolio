import { useState, useMemo } from 'react';
import { GOAL_CATEGORIES, CURRENCIES, toBase, fmtBase, fmt, id, valueRWF, costRWF } from '../data.js';
import { Field, inputStyle } from '../components/Field.jsx';
import Modal from '../components/Modal.jsx';

const EMPTY_GOAL = {
  category: 'investment', title: '', targetAmount: '', currency: 'RWF',
  deadline: '', notes: '', achieved: false, achievedAt: null,
};

function GoalEditor({ goal, onSave, onCancel }) {
  const isNew = !goal.id;
  const [g, setG] = useState({ ...EMPTY_GOAL, ...goal, id: goal.id || id() });
  const u = (k, v) => setG(s => ({ ...s, [k]: v }));
  const cat = GOAL_CATEGORIES.find(c => c.id === g.category) || GOAL_CATEGORIES[0];

  return (
    <Modal open onClose={onCancel} maxWidth={560} title={isNew ? 'New goal' : 'Edit goal'}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 className="font-serif" style={{ fontSize: 22, margin: 0, fontWeight: 400 }}>{isNew ? 'New goal' : 'Edit goal'}</h2>
          <button type="button" onClick={onCancel} aria-label="Close dialog" className="btn-icon-sm">
            <span aria-hidden="true">×</span>
          </button>
        </div>

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

function GoalCard({ goal, netWorth, displayCurrency, onEdit, onDelete }) {
  const cat = GOAL_CATEGORIES.find(c => c.id === goal.category) || GOAL_CATEGORIES[0];
  const targetRWF = toBase(goal.targetAmount || 0, goal.currency || 'RWF');
  // Use net worth as proxy for current savings toward the goal
  const pct = targetRWF > 0 ? Math.min((netWorth / targetRWF) * 100, 100) : 0;
  const remaining = Math.max(targetRWF - netWorth, 0);
  const today = new Date();
  const deadline = goal.deadline ? new Date(goal.deadline) : null;
  const daysLeft = deadline ? Math.ceil((deadline - today) / 86400000) : null;
  const yearsLeft = daysLeft !== null ? daysLeft / 365.25 : null;

  // Monthly savings needed to reach gap
  const monthsLeft = daysLeft !== null ? daysLeft / 30.44 : null;
  const monthlySavingsNeeded = (monthsLeft && monthsLeft > 0 && remaining > 0)
    ? remaining / monthsLeft : null;

  const isAchieved = goal.achieved || pct >= 100;
  const isOverdue  = deadline && deadline < today && !isAchieved;

  return (
    <div className="card" style={{
      padding: '20px 22px', marginBottom: 14,
      borderLeft: `3px solid ${isAchieved ? 'var(--up)' : isOverdue ? 'var(--down)' : 'var(--brand)'}`,
    }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="row" style={{ gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 28 }}>{cat.icon}</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{goal.title}</div>
            <div className="muted" style={{ fontSize: 11 }}>
              {cat.label}
              {daysLeft !== null && (
                <span style={{ marginLeft: 8, color: isOverdue ? 'var(--down)' : daysLeft < 90 ? 'var(--gold)' : 'var(--ink-3)' }}>
                  · {isOverdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                </span>
              )}
              {isAchieved && <span style={{ marginLeft: 8, color: 'var(--up)', fontWeight: 600 }}>· Achieved!</span>}
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

      {/* Progress bar */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span className="num" style={{ fontSize: 13, fontWeight: 700 }}>
            {fmtBase(netWorth, displayCurrency, { compact: true })}
          </span>
          <span className="num" style={{ fontSize: 13, color: 'var(--ink-3)' }}>
            / {fmt(goal.targetAmount, goal.currency, { compact: true })}
          </span>
        </div>
        <div style={{ height: 8, background: 'var(--bg-2)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: pct + '%',
            background: isAchieved ? 'var(--up)' : isOverdue ? 'var(--down)' : 'var(--brand)',
            borderRadius: 4,
            transition: 'width 0.5s ease',
          }} />
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
  const { goals = [], profile } = state;
  const [editing, setEditing] = useState(null);
  const today = new Date();

  const netWorth = useMemo(() => {
    return state.assets.reduce((s, a) => s + valueRWF(a, today), 0) -
      (state.liabilities || []).reduce((s, l) => s + toBase(l.remainingAmount || 0, l.currency || 'RWF'), 0);
  }, [state.assets, state.liabilities]);

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
        <GoalCard key={g.id} goal={g} netWorth={netWorth} displayCurrency={profile.displayCurrency}
          onEdit={() => setEditing(g)}
          onDelete={() => { if (confirm(`Delete "${g.title}"?`)) dispatch({ type: 'deleteGoal', id: g.id }); }}
        />
      ))}

      {/* Achieved goals */}
      {achieved.length > 0 && (
        <>
          <div className="muted" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '24px 0 12px' }}>
            Achieved ({achieved.length})
          </div>
          {achieved.map(g => (
            <GoalCard key={g.id} goal={g} netWorth={netWorth} displayCurrency={profile.displayCurrency}
              onEdit={() => setEditing(g)}
              onDelete={() => { if (confirm(`Delete "${g.title}"?`)) dispatch({ type: 'deleteGoal', id: g.id }); }}
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
          onSave={g => { dispatch({ type: 'upsertGoal', goal: g }); setEditing(null); }}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}
