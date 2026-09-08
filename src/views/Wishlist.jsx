// Wishlist — wishes (family_items kind 'wish') with a live affordability
// verdict against the household's liquid cash minus a 3-month buffer and its
// monthly savings pace. One click turns a wish into a funded Goal.
import { useMemo, useState } from 'react';
import { id as newId } from '../data.js';
import { KPI } from '../components/Field.jsx';
import { useItems } from '../family/useItems.js';
import { KINDS, affordability, itemToForm } from '../family/planning.js';
import { ItemEditor, ErrorBanner, SignInNote, PageHead, Empty, money } from '../family/ui.jsx';

const PRIO = { must: 0, should: 1, nice: 2 };
const PRIO_LABEL = Object.fromEntries(KINDS.wish.fields.find(f => f.key === 'priority').options.map(o => [o.id, o.label]));
const FOR_LABEL = Object.fromEntries(KINDS.wish.fields.find(f => f.key === 'for').options.map(o => [o.id, o.label]));
const VERDICT = {
  now:     { label: 'Affordable now', cls: 'pill-up' },
  soon:    { label: 'Within 6 months', cls: 'pill-gold' },
  stretch: { label: 'A stretch', cls: 'pill-down' },
  unknown: { label: 'Add a cost', cls: 'pill-soft' },
};

export default function Wishlist({ state, dispatch, portfolioId, role, showToast }) {
  const { items, error, canEdit, save, setStatus, remove } = useItems(portfolioId, role);
  const [editing, setEditing] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const now = useMemo(() => new Date(), []);
  const cur = state.profile.displayCurrency || 'RWF';

  const wishes = useMemo(() => (items || []).filter(i => i.kind === 'wish' && i.status !== 'archived')
    .map(w => ({ ...w, a: affordability(w, state, now) }))
    .sort((x, y) => (PRIO[x.data?.priority] ?? 1) - (PRIO[y.data?.priority] ?? 1) || ((x.due_date || '9999') < (y.due_date || '9999') ? -1 : 1)), [items, state, now]);
  const open = wishes.filter(w => w.status === 'open'), done = wishes.filter(w => w.status === 'done');
  const total = open.reduce((s, w) => s + (Number(w.amount) || 0), 0);
  const investable = open[0]?.a.investable ?? affordability({ amount: 1 }, state, now).investable;
  const pace = open[0]?.a.pace ?? 0;

  if (!portfolioId) return <SignInNote what="the wish list" />;

  /** Promote a wish into a Goal funded from liquid cash. */
  async function toGoal(w) {
    if (w.data?.goal_id) { dispatch({ type: 'nav', to: 'goals' }); return; }
    const gid = newId();
    dispatch({ type: 'upsertGoal', goal: {
      id: gid, category: w.data?.for === 'home' ? 'house' : 'other-goal', title: w.title, targetAmount: Number(w.amount) || 0, currency: 'RWF',
      deadline: w.due_date || '', notes: w.data?.notes || '', achieved: false, achievedAt: null, fundingType: 'liquid', linkedAssetIds: [],
    }});
    await save({ ...itemToForm(w), goal_id: gid }).catch(() => {});
    showToast?.('Goal created from this wish', 'success');
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      <ErrorBanner error={error} />
      <div className="dash-kpi-grid">
        <KPI label="Open wishes" value={open.length} sub={`${money(total, cur)} in total`} />
        <KPI label="Affordable now" value={open.filter(w => w.a.status === 'now').length} sub="Without breaking the 3-month buffer" accent="var(--up)" />
        <KPI label="Investable today" value={money(investable, cur)} sub="Liquid cash minus 3 months of spend" />
        <KPI label="Savings pace" value={`${money(pace, cur)}/mo`} sub={pace > 0 ? 'Income minus spending (6-month avg)' : 'Not saving yet — wishes cannot get closer'} accent={pace > 0 ? 'var(--brand)' : 'var(--down)'} />
      </div>

      <div className="card" style={{ padding: 18 }}>
        <PageHead title="Wish list" sub="Ranked by priority. The verdict updates as cash and spending change."
          action={canEdit && <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>+ Wish</button>} />
        {items === null && !error && <Empty>Loading…</Empty>}
        {items && open.length === 0 && <Empty>Nothing wished for yet. Add the vehicle, the trip, the furniture — with a cost — and Imari tells you when it fits.</Empty>}
        <div className="col" style={{ gap: 2, marginTop: 8 }}>
          {(showDone ? wishes : open).map(w => {
            const v = VERDICT[w.a.status];
            return (
              <div key={w.id} className="row" style={{ gap: 12, padding: '9px 0', borderTop: '1px solid var(--line-soft)', alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="checkbox" checked={w.status === 'done'} disabled={!canEdit} onChange={e => setStatus(w.id, e.target.checked ? 'done' : 'open')} style={{ accentColor: 'var(--up)' }} aria-label={`Bought: ${w.title}`} />
                <button className="btn-unstyled" onClick={() => canEdit && setEditing(w)} style={{ flex: 1, minWidth: 180, textAlign: 'left', cursor: canEdit ? 'pointer' : 'default' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, textDecoration: w.status === 'done' ? 'line-through' : 'none' }}>{w.title}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{PRIO_LABEL[w.data?.priority] || 'Should have'} · {FOR_LABEL[w.data?.for] || 'Family'}{w.due_date ? ` · by ${w.due_date}` : ''}</div>
                </button>
                <span className="num" style={{ fontSize: 13, fontWeight: 600 }}>{money(w.amount, cur)}</span>
                {w.status === 'open' && (
                  <span className={`pill ${v.cls}`} style={{ fontSize: 10 }} title={w.a.gap ? `Short by ${money(w.a.gap, cur)}` : ''}>
                    {v.label}{w.a.status !== 'now' && w.a.monthsToAfford ? ` · ~${w.a.monthsToAfford} mo` : ''}
                  </span>
                )}
                {w.data?.link && <a className="btn btn-ghost btn-xs" href={w.data.link} target="_blank" rel="noopener noreferrer nofollow">Link ↗</a>}
                {canEdit && w.status === 'open' && <button className="btn btn-ghost btn-xs" onClick={() => toGoal(w)}>{w.data?.goal_id ? 'View goal →' : 'Make it a goal'}</button>}
              </div>
            );
          })}
        </div>
        {done.length > 0 && <button className="btn btn-ghost btn-xs" style={{ marginTop: 8 }} onClick={() => setShowDone(v => !v)}>{showDone ? 'Hide bought' : `Show ${done.length} bought`}</button>}
      </div>

      {editing && <ItemEditor kind="wish" initial={editing === 'new' ? undefined : editing} onSave={save} onDelete={remove} onClose={() => setEditing(null)} />}
    </div>
  );
}
