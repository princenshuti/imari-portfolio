// family/ui.jsx — small shared pieces for the Sprint 2 screens: the generic
// item editor (driven by KINDS field specs), page chrome, and row helpers.
import { useState } from 'react';
import Modal from '../components/Modal.jsx';
import { Field, inputStyle } from '../components/Field.jsx';
import { ConfirmDestructive } from '../components/ConfirmDestructive.jsx';
import { fmtBase } from '../data.js';
import { KINDS, blankItem, itemToForm } from './planning.js';

const textareaStyle = { ...inputStyle, minHeight: 72, resize: 'vertical', lineHeight: 1.5 };

export function ErrorBanner({ error }) {
  return error ? <div className="card" role="alert" style={{ padding: '10px 14px', color: 'var(--down-ink)', background: 'var(--down-soft)' }}>{error}</div> : null;
}

export function SignInNote({ what }) {
  return <div className="card muted" style={{ padding: 20 }}>Sign in to use {what} — it is shared with the members of your portfolio.</div>;
}

export function PageHead({ title, sub, action }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
      <div>
        <div className="font-serif" style={{ fontSize: 18 }}>{title}</div>
        {sub && <div className="muted" style={{ fontSize: 12 }}>{sub}</div>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ children }) {
  return <div className="muted" style={{ fontSize: 13, padding: '10px 0' }}>{children}</div>;
}

export function Due({ days }) {
  if (days == null) return null;
  const late = days < 0, soon = days <= 30;
  const label = days === 0 ? 'today' : late ? `${-days}d overdue` : `in ${days}d`;
  return <span className={`pill ${late ? 'pill-down' : soon ? 'pill-gold' : 'pill-soft'} num`} style={{ fontSize: 10 }}>{label}</span>;
}

export const money = (n, cur = 'RWF') => (n == null || n === '' ? '—' : fmtBase(Number(n), cur));

/**
 * ItemEditor — modal form for one item of any kind. `initial` is a DB row
 * (edit) or undefined (create). onSave receives flat form values; the caller
 * (useItems.save) validates via normalizeItem and surfaces its message here.
 */
export function ItemEditor({ kind, initial, preset, assets = [], onSave, onDelete, onClose }) {
  const spec = KINDS[kind];
  const [form, setForm] = useState(() => (initial ? itemToForm(initial) : { ...blankItem(kind), ...(preset || {}) }));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const u = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await onSave(form); onClose(); }
    catch (ex) { setErr(ex.message || 'Could not save'); }
    finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={`${initial ? 'Edit' : 'New'} ${spec.label.toLowerCase()}`} maxWidth={560}>
      <form onSubmit={submit} style={{ padding: 20 }}>
        <div className="font-serif" style={{ fontSize: 20, marginBottom: 4 }}>{initial ? 'Edit' : 'New'} {spec.label.toLowerCase()}</div>
        {spec.fields.filter(f => !f.hidden).map(f => (
          <Field key={f.key} label={f.label} hint={f.hint} top={12}>
            {f.type === 'textarea' ? (
              <textarea value={form[f.key] ?? ''} onChange={e => u(f.key, e.target.value)} maxLength={f.max} style={textareaStyle} />
            ) : f.type === 'select' ? (
              <select value={form[f.key] ?? f.def} onChange={e => u(f.key, e.target.value)} style={inputStyle}>
                {f.options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            ) : f.type === 'asset' ? (
              <select value={form[f.key] ?? ''} onChange={e => u(f.key, e.target.value)} style={inputStyle}>
                <option value="">— none —</option>
                {assets.filter(a => a.kind === 'vehicle' || String(a.kind).startsWith('realestate')).map(a => <option key={a.id} value={a.id}>{a.name || a.kind}</option>)}
              </select>
            ) : (
              <input type={f.type === 'number' ? 'text' : f.type === 'url' ? 'url' : f.type} inputMode={f.type === 'number' ? 'decimal' : undefined}
                     value={form[f.key] ?? ''} onChange={e => u(f.key, e.target.value)} maxLength={f.max} required={f.required} style={inputStyle} />
            )}
          </Field>
        ))}
        {err && <div role="alert" style={{ fontSize: 12, color: 'var(--down)', marginTop: 10 }}>{err}</div>}
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 18, gap: 8 }}>
          <div>
            {initial && onDelete && !confirmDel && <button type="button" className="btn btn-ghost btn-xs" onClick={() => setConfirmDel(true)}>Delete</button>}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </form>
      <ConfirmDestructive
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={async () => { await onDelete(initial); onClose(); }}
        title={`Delete this ${spec.label.toLowerCase()}?`}
        description="This cannot be undone."
        confirmLabel="Delete"
      />
    </Modal>
  );
}
