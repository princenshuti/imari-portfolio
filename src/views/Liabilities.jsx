import { useState, useMemo } from 'react';
import { LIABILITY_TYPES, CURRENCIES, toBase, fmt, fmtBase, valueRWF, id } from '../data.js';
import { Field, inputStyle } from '../components/Field.jsx';
import Modal from '../components/Modal.jsx';
import { ConfirmDestructive } from '../components/ConfirmDestructive.jsx';

const EMPTY_LIABILITY = {
  kind: 'personal-loan', name: '', currency: 'RWF',
  originalAmount: '', remainingAmount: '', interestRate: '',
  startDate: new Date().toISOString().slice(0, 10), endDate: '',
  lender: '', notes: '',
};

function LiabilityEditor({ liability, onSave, onCancel }) {
  const isNew = !liability.id;
  const [l, setL] = useState({ ...EMPTY_LIABILITY, ...liability, id: liability.id || id() });
  const u = (k, v) => setL(s => ({ ...s, [k]: v }));
  const ltype = LIABILITY_TYPES.find(t => t.kind === l.kind) || LIABILITY_TYPES[0];

  const handleSave = () => {
    onSave({
      ...l,
      originalAmount:  +l.originalAmount  || 0,
      remainingAmount: +l.remainingAmount  || 0,
      interestRate:    +l.interestRate     || 0,
    });
  };

  return (
    <Modal open onClose={onCancel} maxWidth={640} title={isNew ? 'Add liability' : 'Edit liability'}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {isNew ? 'Add liability' : 'Edit liability'}
            </div>
            <h2 className="font-serif" style={{ fontSize: 24, marginTop: 2, margin: 0, fontWeight: 400 }}>{l.name || 'Untitled debt'}</h2>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close dialog" className="btn-icon-sm">
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {/* Liability type selector */}
        <Field label="Type">
          <div role="radiogroup" aria-label="Liability type" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {LIABILITY_TYPES.map(t => {
              const selected = t.kind === l.kind;
              return (
                <button
                  key={t.kind}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => u('kind', t.kind)}
                  style={{
                    padding: '9px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 500,
                    background: selected ? 'var(--down-soft)' : 'var(--bg-2)',
                    color: selected ? 'var(--down-ink)' : 'var(--ink-2)',
                    border: selected ? '1px solid var(--down-soft)' : '1px solid transparent',
                    fontFamily: 'inherit', textAlign: 'left',
                  }}
                >{t.label}</button>
              );
            })}
          </div>
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 4 }}>
          <Field label="Name">
            <input value={l.name} onChange={e => u('name', e.target.value)} placeholder="e.g. BK Home Loan" style={inputStyle} />
          </Field>
          <Field label="Lender / Institution">
            <input value={l.lender} onChange={e => u('lender', e.target.value)} placeholder="e.g. Bank of Kigali" style={inputStyle} />
          </Field>
          <Field label="Currency">
            <select value={l.currency} onChange={e => u('currency', e.target.value)} style={inputStyle}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
            </select>
          </Field>
          <Field label="Interest rate (%/yr)">
            <input type="number" value={l.interestRate} onChange={e => u('interestRate', e.target.value)} placeholder="e.g. 17.5" style={inputStyle} />
          </Field>
          <Field label="Original loan amount">
            <input type="number" value={l.originalAmount} onChange={e => u('originalAmount', e.target.value)} placeholder="0" style={inputStyle} />
          </Field>
          <Field label="Remaining balance">
            <input type="number" value={l.remainingAmount} onChange={e => u('remainingAmount', e.target.value)} placeholder="0" style={inputStyle} />
          </Field>
          <Field label="Start date">
            <input type="date" value={l.startDate} onChange={e => u('startDate', e.target.value)} style={inputStyle} />
          </Field>
          <Field label="End date (maturity)">
            <input type="date" value={l.endDate} onChange={e => u('endDate', e.target.value)} style={inputStyle} />
          </Field>
        </div>

        <Field label="Notes" top={14}>
          <textarea value={l.notes} onChange={e => u('notes', e.target.value)} placeholder="optional"
            style={{ ...inputStyle, minHeight: 52, fontFamily: 'inherit', resize: 'vertical', paddingTop: 8 }} />
        </Field>

        <div className="row" style={{ gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} className="btn btn-ghost">Cancel</button>
          <button type="button" onClick={handleSave} className="btn btn-danger" disabled={!l.name}>
            {isNew ? 'Add liability' : 'Save changes'}
          </button>
        </div>
    </Modal>
  );
}

export default function LiabilitiesView({ state, dispatch }) {
  const { liabilities = [], assets, profile } = state;
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const today = new Date();

  const totalDebt = useMemo(() =>
    liabilities.reduce((s, l) => s + toBase(l.remainingAmount || 0, l.currency || 'RWF'), 0),
    [liabilities]);

  const totalAssets = useMemo(() =>
    assets.reduce((s, a) => s + valueRWF(a, today), 0),
    [assets]);

  const trueNetWorth = totalAssets - totalDebt;

  const grouped = useMemo(() => {
    const out = {};
    liabilities.forEach(l => {
      const t = LIABILITY_TYPES.find(t => t.kind === l.kind) || LIABILITY_TYPES[LIABILITY_TYPES.length - 1];
      if (!out[t.group]) out[t.group] = { group: t.group, items: [], total: 0 };
      out[t.group].items.push(l);
      out[t.group].total += toBase(l.remainingAmount || 0, l.currency || 'RWF');
    });
    return Object.values(out);
  }, [liabilities]);

  const daysUntil = (dateStr) => {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr) - today) / 86400000);
  };

  return (
    <div style={{ padding: 28, background: 'var(--bg)', minHeight: 'calc(100vh - 70px)' }}>

      {/* ── Summary strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 22 }}>
        {[
          { label: 'Total liabilities', value: fmtBase(totalDebt, profile.displayCurrency, { compact: true }), sub: `${liabilities.length} debt${liabilities.length === 1 ? '' : 's'}`, color: 'var(--down)', bg: 'var(--down-soft)' },
          { label: 'Total assets', value: fmtBase(totalAssets, profile.displayCurrency, { compact: true }), sub: 'gross', color: 'var(--brand)', bg: 'var(--paper)' },
          { label: 'True net worth', value: fmtBase(trueNetWorth, profile.displayCurrency, { compact: true }), sub: 'assets minus debts', color: trueNetWorth >= 0 ? 'var(--up)' : 'var(--down)', bg: trueNetWorth >= 0 ? 'var(--up-soft)' : 'var(--down-soft)' },
        ].map((c, i) => (
          <div key={i} style={{ padding: '16px 20px', borderRadius: 'var(--r-md)', background: c.bg, border: '0.5px solid var(--line)' }}>
            <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700, color: c.color, letterSpacing: '-0.02em' }}>{c.value}</div>
            <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Actions ── */}
      <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 16 }}>
        <button type="button" onClick={() => setEditing({})} className="btn btn-danger">＋ Add liability</button>
      </div>

      {/* ── Liability groups ── */}
      {grouped.map(g => (
        <div key={g.group} className="card" style={{ marginBottom: 14, padding: 0 }}>
          <div className="row" style={{ padding: '14px 20px', justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--down)', flexShrink: 0 }} />
              <div className="font-serif" style={{ fontSize: 16 }}>{g.group}</div>
              <span className="pill pill-soft">{g.items.length}</span>
            </div>
            <div className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--down)' }}>
              − {fmtBase(g.total, profile.displayCurrency, { compact: true })}
            </div>
          </div>
          <div className="hr" />
          {g.items.map((l, i) => {
            const lt = LIABILITY_TYPES.find(t => t.kind === l.kind);
            const remaining = toBase(l.remainingAmount || 0, l.currency || 'RWF');
            const original  = toBase(l.originalAmount  || 0, l.currency || 'RWF');
            const paid      = original - remaining;
            const paidPct   = original > 0 ? (paid / original) * 100 : 0;
            const daysLeft  = daysUntil(l.endDate);

            return (
              <div key={l.id}>
                {i > 0 && <div className="hr" style={{ margin: '0 20px' }} />}
                <div style={{ padding: '14px 20px' }}>
                  <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                    <div className="col" style={{ gap: 3 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{l.name}</div>
                      <div className="muted" style={{ fontSize: 11 }}>
                        {lt?.label} · {l.lender || '—'} · {l.interestRate || 0}% p.a.
                        {daysLeft !== null && (
                          <span style={{ color: daysLeft < 30 ? 'var(--down)' : 'var(--ink-3)', marginLeft: 8 }}>
                            · {daysLeft < 0 ? 'Matured' : `${daysLeft}d left`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                      <div className="col" style={{ alignItems: 'flex-end', gap: 2 }}>
                        <div className="num" style={{ fontSize: 15, fontWeight: 700, color: 'var(--down)' }}>
                          {fmt(l.remainingAmount || 0, l.currency, { compact: true })}
                        </div>
                        <div className="muted" style={{ fontSize: 10 }}>
                          of {fmt(l.originalAmount || 0, l.currency, { compact: true })} original
                        </div>
                      </div>
                      <div className="row" style={{ gap: 6 }}>
                        <button type="button" onClick={() => setEditing(l)} aria-label={`Edit ${l.name}`} className="btn btn-ghost btn-xs">Edit</button>
                        <button type="button" onClick={() => setPendingDelete(l)}
                          aria-label={`Delete ${l.name}`} className="btn btn-xs" style={{
                          border: '1px solid var(--down-soft)', background: 'transparent', color: 'var(--down-ink)',
                        }}>Delete</button>
                      </div>
                    </div>
                  </div>
                  {/* Payoff progress bar */}
                  {original > 0 && (
                    <div>
                      <div style={{ height: 5, background: 'var(--down-soft)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: paidPct + '%', background: 'var(--up)', borderRadius: 3, transition: 'width 0.4s ease' }} />
                      </div>
                      <div className="muted" style={{ fontSize: 10, marginTop: 3 }}>
                        {paidPct.toFixed(0)}% paid off ({fmt(paid / (original > 0 ? toBase(l.originalAmount, l.currency) : 1), l.currency, { compact: true })} paid)
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {liabilities.length === 0 && (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <div className="font-serif" style={{ fontSize: 22, marginBottom: 8 }}>No liabilities recorded</div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 20 }}>
            Track your loans, mortgages, and debt to see your true net worth (assets minus liabilities).
          </div>
          <button onClick={() => setEditing({})} className="btn" style={{
            background: 'var(--down)', color: '#fff', border: 0, padding: '10px 20px',
            borderRadius: 'var(--r-md)', cursor: 'pointer', fontWeight: 600,
          }}>＋ Add your first liability</button>
        </div>
      )}

      {editing !== null && (
        <LiabilityEditor
          liability={editing}
          onSave={l => { dispatch({ type: 'upsertLiability', liability: l }); setEditing(null); }}
          onCancel={() => setEditing(null)}
        />
      )}

      <ConfirmDestructive
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          dispatch({ type: 'deleteLiability', id: pendingDelete.id });
          setPendingDelete(null);
        }}
        title="Delete this liability?"
        description={pendingDelete && (
          <span>
            <strong style={{ color: 'var(--ink)' }}>{pendingDelete.name}</strong>
            {pendingDelete.remainingAmount ? <> · <span className="num">{fmt(pendingDelete.remainingAmount, pendingDelete.currency || 'RWF')}</span> remaining</> : null}
            <br />
            This removes the debt from your portfolio permanently. You can't undo this.
          </span>
        )}
        confirmLabel="Delete liability"
      />
    </div>
  );
}
