// Documents — the family vault: metadata in family_items (kind 'document'),
// the file itself in the private family-docs bucket, opened through 60-second
// signed URLs. Expiry dates feed the calendar. Full ID numbers are never
// stored — only a 4-character reference hint.
import { useMemo, useRef, useState } from 'react';
import { KPI } from '../components/Field.jsx';
import { useItems } from '../family/useItems.js';
import { KINDS, daysUntil, itemToForm } from '../family/planning.js';
import { uploadDocFile, docFileUrl, removeDocFile, DOC_MAX_BYTES } from '../family/items.js';
import { ItemEditor, ErrorBanner, SignInNote, PageHead, Empty, Due } from '../family/ui.jsx';

const TYPE = Object.fromEntries(KINDS.document.fields.find(f => f.key === 'type').options.map(o => [o.id, o.label]));
const kb = n => (n > 1024 * 1024 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function Documents({ portfolioId, role, showToast }) {
  const { items, error, canEdit, save, remove } = useItems(portfolioId, role);
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const fileRef = useRef(null);
  const targetRef = useRef(null);
  const now = useMemo(() => new Date(), []);

  const docs = useMemo(() => (items || []).filter(i => i.kind === 'document' && i.status !== 'archived')
    .sort((a, b) => (a.due_date || '9999') < (b.due_date || '9999') ? -1 : 1), [items]);
  const expiring = docs.filter(d => { const n = daysUntil(d.due_date, now); return n != null && n <= 90; });
  const withFile = docs.filter(d => d.data?.file?.path).length;

  if (!portfolioId) return <SignInNote what="the documents vault" />;

  function pickFile(doc) { targetRef.current = doc; fileRef.current?.click(); }

  async function onFile(e) {
    const file = e.target.files?.[0]; e.target.value = '';
    const doc = targetRef.current; targetRef.current = null;
    if (!file || !doc) return;
    setBusyId(doc.id);
    try {
      const desc = await uploadDocFile(portfolioId, doc.id, file);
      const old = doc.data?.file?.path;
      await save({ ...itemToForm(doc), file: desc });
      if (old && old !== desc.path) await removeDocFile(old).catch(() => {});
      showToast?.('File stored in the vault', 'success');
    } catch (err) { showToast?.(err.message || 'Upload failed', 'error'); }
    finally { setBusyId(null); }
  }

  async function openFile(doc) {
    try { const url = await docFileUrl(doc.data.file.path); window.open(url, '_blank', 'noopener,noreferrer'); }
    catch (err) { showToast?.(err.message || 'Could not open file', 'error'); }
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      <ErrorBanner error={error} />
      <div className="dash-kpi-grid">
        <KPI label="Documents" value={docs.length} sub={`${withFile} with a stored file`} />
        <KPI label="Expiring ≤ 90 days" value={expiring.length} sub={expiring.length ? expiring.map(d => d.title).slice(0, 3).join(', ') : 'Nothing expiring soon'} accent={expiring.length ? 'var(--gold-ink)' : 'var(--brand)'} />
        <KPI label="Storage" value="Private" sub="Files open via 60-second links only" />
        <KPI label="Max file" value={`${DOC_MAX_BYTES / 1048576} MB`} sub="PDF, JPG, PNG, WebP" />
      </div>

      <div className="card" style={{ padding: 18 }}>
        <PageHead title="Vault" sub="IDs, passports, land titles, contracts, school and medical records — metadata here, the scan attached."
          action={canEdit && <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>+ Document</button>} />
        {items === null && !error && <Empty>Loading…</Empty>}
        {items && docs.length === 0 && <Empty>Nothing here yet. Add each family member's ID and passport first, with the expiry date, so renewals reach the calendar.</Empty>}
        <div className="col" style={{ gap: 2, marginTop: 8 }}>
          {docs.map(d => (
            <div key={d.id} className="row" style={{ gap: 12, padding: '9px 0', borderTop: '1px solid var(--line-soft)', alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn-unstyled" onClick={() => canEdit && setEditing(d)} style={{ flex: 1, minWidth: 200, textAlign: 'left', cursor: canEdit ? 'pointer' : 'default' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{d.title}</div>
                <div className="muted" style={{ fontSize: 11 }}>
                  {TYPE[d.data?.type] || 'Other'}{d.data?.holder ? ` · ${d.data.holder}` : ''}{d.data?.ref_hint ? ` · ···${d.data.ref_hint}` : ''}{d.due_date ? ` · expires ${d.due_date}` : ''}
                </div>
              </button>
              <Due days={daysUntil(d.due_date, now)} />
              {d.data?.file?.path ? (
                <>
                  <button className="btn btn-sm" onClick={() => openFile(d)} title={d.data.file.name}>Open · {kb(d.data.file.size || 0)}</button>
                  {canEdit && <button className="btn btn-ghost btn-xs" disabled={busyId === d.id} onClick={() => pickFile(d)}>{busyId === d.id ? 'Uploading…' : 'Replace'}</button>}
                </>
              ) : canEdit && (
                <button className="btn btn-ghost btn-sm" disabled={busyId === d.id} onClick={() => pickFile(d)}>{busyId === d.id ? 'Uploading…' : 'Attach file'}</button>
              )}
            </div>
          ))}
        </div>
        <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={onFile} style={{ display: 'none' }} />
      </div>

      {editing && <ItemEditor kind="document" initial={editing === 'new' ? undefined : editing} onSave={save} onDelete={remove} onClose={() => setEditing(null)} />}
    </div>
  );
}
