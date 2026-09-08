// Household — the running of the home: shared tasks (family_items kind
// 'task', with owner and repeat) and the recurring bills already recorded
// in Cash Flow (utilities, rent, school fees, house help…), with next due.
import { useMemo, useState } from 'react';
import { EXPENSE_CATEGORIES } from '../data.js';
import { nextOccurrence, monthlyEquivalentRWF } from '../engine/recurrence.js';
import { useItems } from '../family/useItems.js';
import { KINDS, daysUntil } from '../family/planning.js';
import { addDays, toLocalISO } from '../family/habits.js';
import { ItemEditor, ErrorBanner, SignInNote, PageHead, Empty, Due, money } from '../family/ui.jsx';

const WHO = Object.fromEntries(KINDS.task.fields.find(f => f.key === 'assignee').options.map(o => [o.id, o.label]));
const catLabel = id => EXPENSE_CATEGORIES.find(c => c.id === id)?.label || id || 'Expense';

export default function Household({ state, dispatch, portfolioId, role }) {
  const { items, error, canEdit, save, setStatus, remove } = useItems(portfolioId, role);
  const [editing, setEditing] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const now = useMemo(() => new Date(), []);
  const cur = state.profile.displayCurrency || 'RWF';

  const tasks = useMemo(() => (items || []).filter(i => i.kind === 'task' && i.status !== 'archived')
    .sort((a, b) => (a.status === b.status ? (a.due_date || '9999') < (b.due_date || '9999') ? -1 : 1 : a.status === 'open' ? -1 : 1)), [items]);
  const open = tasks.filter(t => t.status === 'open'), done = tasks.filter(t => t.status === 'done');

  const bills = useMemo(() => (state.cashflows || [])
    .filter(cf => cf.type === 'expense' && cf.recurring && cf.recurring !== 'once')
    .map(cf => ({ ...cf, next: nextOccurrence(cf, now), monthly: monthlyEquivalentRWF(cf) }))
    .sort((a, b) => (a.next?.getTime() || 0) - (b.next?.getTime() || 0)), [state.cashflows, now]);
  const monthlyTotal = bills.reduce((s, b) => s + b.monthly, 0);

  if (!portfolioId) return <SignInNote what="the household board" />;

  /** Done on a repeating task also schedules the next one. */
  async function complete(t, checked) {
    await setStatus(t.id, checked ? 'done' : 'open');
    const rep = t.data?.repeat;
    if (checked && rep && rep !== 'none' && t.due_date) {
      const base = t.due_date < toLocalISO(now) ? toLocalISO(now) : t.due_date;
      const nextDue = rep === 'weekly' ? addDays(base, 7) : (() => { const d = new Date(base); d.setMonth(d.getMonth() + 1); return toLocalISO(d); })();
      await save({ kind: 'task', status: 'open', title: t.title, due_date: nextDue, ...t.data }).catch(() => {});
    }
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      <ErrorBanner error={error} />
      <div className="dash-grid-2">
        <div className="card" style={{ padding: 18 }}>
          <PageHead title="Tasks" sub={`${open.length} open · ${done.length} done`}
            action={canEdit && <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>+ Task</button>} />
          {items === null && !error && <Empty>Loading…</Empty>}
          {items && open.length === 0 && <Empty>No open tasks. Chores, repairs, school runs, house-help pay day — anything the home needs.</Empty>}
          <div className="col" style={{ gap: 2, marginTop: 8 }}>
            {(showDone ? tasks : open).map(t => (
              <div key={t.id} className="row" style={{ gap: 10, padding: '7px 0', borderTop: '1px solid var(--line-soft)', alignItems: 'flex-start' }}>
                <input type="checkbox" checked={t.status === 'done'} disabled={!canEdit} onChange={e => complete(t, e.target.checked)} style={{ marginTop: 3, accentColor: 'var(--up)' }} aria-label={`Done: ${t.title}`} />
                <button className="btn-unstyled" onClick={() => canEdit && setEditing(t)} style={{ flex: 1, textAlign: 'left', cursor: canEdit ? 'pointer' : 'default' }}>
                  <div style={{ fontSize: 13, textDecoration: t.status === 'done' ? 'line-through' : 'none', color: t.status === 'done' ? 'var(--ink-3)' : 'var(--ink)' }}>{t.title}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{WHO[t.data?.assignee] || 'Me'}{t.data?.repeat && t.data.repeat !== 'none' ? ` · ${t.data.repeat}` : ''}{t.due_date ? ` · ${t.due_date}` : ''}</div>
                </button>
                {t.status === 'open' && <Due days={daysUntil(t.due_date, now)} />}
              </div>
            ))}
          </div>
          {done.length > 0 && <button className="btn btn-ghost btn-xs" style={{ marginTop: 8 }} onClick={() => setShowDone(v => !v)}>{showDone ? 'Hide done' : `Show ${done.length} done`}</button>}
        </div>

        <div className="card" style={{ padding: 18 }}>
          <PageHead title="Recurring bills" sub={`${money(monthlyTotal, cur)} / month across ${bills.length} bill${bills.length === 1 ? '' : 's'}`}
            action={<button className="btn btn-ghost btn-xs" onClick={() => dispatch({ type: 'nav', to: 'cashflow' })}>Add in Cash Flow →</button>} />
          {bills.length === 0 && <Empty>No recurring expenses yet. Record cash power, water, internet, rent, school fees and house-help pay as recurring entries in Cash Flow and they appear here with their next due date.</Empty>}
          <div className="col" style={{ gap: 2, marginTop: 8 }}>
            {bills.map(b => (
              <div key={b.id} className="row" style={{ gap: 10, padding: '7px 0', borderTop: '1px solid var(--line-soft)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>{b.notes || catLabel(b.category)}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{catLabel(b.category)} · {b.recurring}</div>
                </div>
                <span className="num" style={{ fontSize: 13, fontWeight: 600 }}>{money(b.monthly, cur)}<span className="muted" style={{ fontSize: 10 }}>/mo</span></span>
                {b.next && <Due days={daysUntil(toLocalISO(b.next), now)} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {editing && <ItemEditor kind="task" initial={editing === 'new' ? undefined : editing} onSave={save} onDelete={remove} onClose={() => setEditing(null)} />}
    </div>
  );
}
