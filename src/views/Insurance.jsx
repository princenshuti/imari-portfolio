// Insurance — policies (family_items kind 'policy'): premium, cover,
// renewal, linked asset. Surfaces uninsured vehicles/houses (cost-of-absence
// style) and can push the premium into Cash Flow as a recurring expense.
import { useMemo, useState } from 'react';
import { id as newId } from '../data.js';
import { KPI } from '../components/Field.jsx';
import { useItems } from '../family/useItems.js';
import { KINDS, insuranceGaps, daysUntil, itemToForm } from '../family/planning.js';
import { toLocalISO } from '../family/habits.js';
import { ItemEditor, ErrorBanner, SignInNote, PageHead, Empty, Due, money } from '../family/ui.jsx';

const TYPE = Object.fromEntries(KINDS.policy.fields.find(f => f.key === 'type').options.map(o => [o.id, o.label]));
const perYear = { monthly: 12, quarterly: 4, annually: 1 };

export default function Insurance({ state, dispatch, portfolioId, role, showToast }) {
  const { items, error, canEdit, save, remove } = useItems(portfolioId, role);
  const [editing, setEditing] = useState(null); // null | { initial } | { preset }
  const now = useMemo(() => new Date(), []);
  const cur = state.profile.displayCurrency || 'RWF';
  const assets = state.assets || [];
  const assetName = id => assets.find(a => a.id === id)?.name;

  const policies = useMemo(() => (items || []).filter(i => i.kind === 'policy' && i.status !== 'archived')
    .sort((a, b) => (a.due_date || '9999') < (b.due_date || '9999') ? -1 : 1), [items]);
  const gaps = useMemo(() => insuranceGaps(assets, items || []), [assets, items]);
  const annual = policies.reduce((s, p) => s + (Number(p.amount) || 0) * (perYear[p.data?.frequency] || 1), 0);
  const cover = policies.reduce((s, p) => s + (Number(p.data?.cover) || 0), 0);
  const renewing = policies.filter(p => { const d = daysUntil(p.due_date, now); return d != null && d <= 60; }).length;

  if (!portfolioId) return <SignInNote what="insurance" />;

  /** Record the premium as a recurring Cash Flow expense, once per policy. */
  async function pushPremium(p) {
    if (!p.amount || p.data?.cashflow_id) return;
    const cfId = newId();
    dispatch({ type: 'upsertCashflow', entry: {
      id: cfId, type: 'expense', category: 'insurance', amount: Number(p.amount), currency: 'RWF',
      date: toLocalISO(now), recurring: p.data?.frequency || 'annually', notes: `Premium · ${p.title}`, accountId: null, attachment: null,
    }});
    await save({ ...itemToForm(p), cashflow_id: cfId }).catch(() => {});
    showToast?.('Premium added to Cash Flow as a recurring expense', 'success');
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      <ErrorBanner error={error} />
      <div className="dash-kpi-grid">
        <KPI label="Policies" value={policies.length} sub={`${renewing} renewing within 60 days`} accent={renewing ? 'var(--gold-ink)' : 'var(--brand)'} />
        <KPI label="Premiums / year" value={money(annual, cur)} sub="All policies, annualised" />
        <KPI label="Total cover" value={money(cover, cur)} sub="Sum of cover amounts" />
        <KPI label="Uninsured assets" value={gaps.length} sub={gaps.length ? gaps.map(a => a.name || a.kind).join(', ') : 'Every vehicle and house is linked to a policy'} accent={gaps.length ? 'var(--down)' : 'var(--up)'} />
      </div>

      {gaps.length > 0 && (
        <div className="card" style={{ padding: 14, borderLeft: '3px solid var(--down)' }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Cost of absence</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>A single accident or fire on an uninsured asset is a total loss out of family cash. Link or add a policy:</div>
          <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {gaps.map(a => <button key={a.id} className="btn btn-sm" disabled={!canEdit} onClick={() => setEditing({ preset: { title: `${a.kind === 'vehicle' ? 'Motor' : 'Home'} · ${a.name || ''}`.trim(), type: a.kind === 'vehicle' ? 'motor' : 'home', asset_id: a.id } })}>+ Policy for {a.name || a.kind}</button>)}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 18 }}>
        <PageHead title="Policies" sub="Renewal dates feed the family calendar."
          action={canEdit && <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}>+ Policy</button>} />
        {items === null && !error && <Empty>Loading…</Empty>}
        {items && policies.length === 0 && <Empty>No policies yet. Start with health (RSSB / mutuelle or private), then motor, home and life.</Empty>}
        <div className="col" style={{ gap: 2, marginTop: 8 }}>
          {policies.map(p => (
            <div key={p.id} className="row" style={{ gap: 12, padding: '9px 0', borderTop: '1px solid var(--line-soft)', alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn-unstyled" onClick={() => canEdit && setEditing({ initial: p })} style={{ flex: 1, minWidth: 200, textAlign: 'left', cursor: canEdit ? 'pointer' : 'default' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.title}</div>
                <div className="muted" style={{ fontSize: 11 }}>
                  {TYPE[p.data?.type] || 'Other'}{p.data?.insurer ? ` · ${p.data.insurer}` : ''}{p.data?.asset_id && assetName(p.data.asset_id) ? ` · covers ${assetName(p.data.asset_id)}` : ''}
                  {p.data?.cover ? ` · cover ${money(p.data.cover, cur)}` : ''}
                </div>
              </button>
              <span className="num" style={{ fontSize: 13 }}>{p.amount ? `${money(p.amount, cur)}/${(p.data?.frequency || 'annually').replace('ly', '')}` : '—'}</span>
              <span className="muted num" style={{ fontSize: 12, minWidth: 90 }}>renews {p.due_date}</span>
              <Due days={daysUntil(p.due_date, now)} />
              {canEdit && p.amount && !p.data?.cashflow_id && <button className="btn btn-ghost btn-xs" onClick={() => pushPremium(p)} title="Record the premium as a recurring expense in Cash Flow">→ Cash Flow</button>}
              {p.data?.cashflow_id && <span className="pill pill-soft" style={{ fontSize: 10 }}>in Cash Flow</span>}
            </div>
          ))}
        </div>
      </div>

      {editing && <ItemEditor kind="policy" initial={editing.initial} preset={editing.preset} assets={assets} onSave={save} onDelete={remove} onClose={() => setEditing(null)} />}
    </div>
  );
}
