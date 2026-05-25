import { useState, useMemo, useRef } from 'react';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, CURRENCIES, toBase, fmtBase, fmt, id } from '../data.js';
import { Field, inputStyle } from '../components/Field.jsx';
import Modal, { ImageLightbox } from '../components/Modal.jsx';
import { parseCSV, detectColumns, rowsToDrafts } from '../services/bankImport.js';

const ALL_CATS = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];
const ACCOUNT_KINDS = new Set(['savings', 'momo-cash']);

const EMPTY_CF = {
  type: 'income', category: 'salary', amount: '', currency: 'RWF',
  date: new Date().toISOString().slice(0, 10),
  recurring: 'monthly', notes: '', accountId: null, attachment: null,
};
const RECURRING = ['once', 'monthly', 'quarterly', 'annually'];

// ─── Compress image to JPEG base64 ───────────────────────────────────────────
async function compressImage(file, maxDim = 1200) {
  if (!file.type.startsWith('image/')) throw new Error('Only image files supported (JPG, PNG, WebP)');
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const tc = document.createElement('canvas');
      const ts = Math.min(1, 72 / Math.max(w, h));
      tc.width = Math.round(w * ts); tc.height = Math.round(h * ts);
      tc.getContext('2d').drawImage(canvas, 0, 0, tc.width, tc.height);
      URL.revokeObjectURL(url);
      resolve({ name: file.name, data: canvas.toDataURL('image/jpeg', 0.82), thumb: tc.toDataURL('image/jpeg', 0.7) });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
    img.src = url;
  });
}

// ─── CF Editor modal ─────────────────────────────────────────────────────────
function CFEditor({ entry, accounts, onSave, onCancel }) {
  const isNew = !entry.id;
  const [e, setE] = useState({ ...EMPTY_CF, ...entry, id: entry.id || id() });
  const u = (k, v) => setE(s => ({ ...s, [k]: v }));
  const cats = e.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const fileRef = useRef(null);
  const [attachLoading, setAttachLoading] = useState(false);
  const [attachErr, setAttachErr] = useState(null);
  const [showFull, setShowFull] = useState(false);

  const handleAttach = async (file) => {
    if (!file) return;
    setAttachLoading(true); setAttachErr(null);
    try {
      const compressed = await compressImage(file);
      u('attachment', compressed);
    } catch (err) {
      setAttachErr(err.message);
    } finally {
      setAttachLoading(false);
    }
  };

  return (
    <Modal open onClose={onCancel} maxWidth={540} title={isNew ? 'Add entry' : 'Edit entry'}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 className="font-serif" style={{ fontSize: 22, margin: 0, fontWeight: 400 }}>{isNew ? 'Add entry' : 'Edit entry'}</h2>
          <button type="button" onClick={onCancel} aria-label="Close dialog" className="btn-icon-sm">
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {/* Income / Expense toggle */}
        <div className="row" style={{ gap: 8, marginBottom: 18 }}>
          {['income', 'expense'].map(t => (
            <button key={t} onClick={() => { u('type', t); u('category', t === 'income' ? 'salary' : 'loan-repay'); }}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 'var(--r-md)', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                background: e.type === t ? (t === 'income' ? 'var(--up-soft)' : 'var(--down-soft)') : 'var(--bg-2)',
                color: e.type === t ? (t === 'income' ? 'var(--up)' : 'var(--down)') : 'var(--ink-3)',
                border: e.type === t ? `1.5px solid ${t === 'income' ? 'var(--up)' : 'var(--down)'}` : '1.5px solid transparent',
              }}>
              {t === 'income' ? '▲ Income' : '▼ Expense'}
            </button>
          ))}
        </div>

        {/* Category */}
        <Field label="Category">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {cats.map(c => (
              <div key={c.id} onClick={() => u('category', c.id)} style={{
                padding: '7px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 500,
                background: c.id === e.category ? 'var(--brand-soft)' : 'var(--bg-2)',
                color: c.id === e.category ? 'var(--brand)' : 'var(--ink-2)',
                border: c.id === e.category ? '1px solid var(--brand)' : '1px solid transparent',
              }}>{c.label}</div>
            ))}
          </div>
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
          <Field label="Amount">
            <input type="number" value={e.amount} onChange={ev => u('amount', ev.target.value)} placeholder="0" style={inputStyle} />
          </Field>
          <Field label="Currency">
            <select value={e.currency} onChange={ev => u('currency', ev.target.value)} style={inputStyle}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
            </select>
          </Field>
          <Field label="Date">
            <input type="date" value={e.date} onChange={ev => u('date', ev.target.value)} style={inputStyle} />
          </Field>
          <Field label="Frequency">
            <select value={e.recurring} onChange={ev => u('recurring', ev.target.value)} style={inputStyle}>
              {RECURRING.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </Field>
        </div>

        {/* Account selector — always visible */}
        <Field label="Account (optional)" top={14}>
          {accounts.length > 0 ? (
            <>
              <select value={e.accountId || ''} onChange={ev => u('accountId', ev.target.value || null)} style={inputStyle}>
                <option value="">— No account linked</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.bank || a.wallet || a.name} ({a.currency})
                  </option>
                ))}
              </select>
              {e.accountId && e.recurring !== 'once' && (
                <div className="muted" style={{ fontSize: 11, marginTop: 5, padding: '6px 10px', background: 'color-mix(in oklab, var(--gold) 12%, transparent)', borderRadius: 6 }}>
                  ⚠ Only <strong>Once</strong> entries update the linked account balance.
                  Change Frequency to "Once" if this transaction should move the balance.
                </div>
              )}
            </>
          ) : (
            <div className="muted" style={{ fontSize: 12, padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 8, lineHeight: 1.5 }}>
              No bank or mobile money accounts yet.{' '}
              Go to <strong>Accounts</strong> and add one — then you can link transactions here to keep your balance up to date automatically.
            </div>
          )}
        </Field>

        <Field label="Notes" top={14}>
          <input value={e.notes} onChange={ev => u('notes', ev.target.value)} placeholder="optional" style={inputStyle} />
        </Field>

        {/* Attachment */}
        <Field label="Attachment (receipt / invoice)" top={14}>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
            onChange={ev => handleAttach(ev.target.files?.[0])} />
          {e.attachment ? (
            <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <img
                src={e.attachment.thumb}
                alt="attachment"
                onClick={() => setShowFull(true)}
                style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--line)' }}
                title="Click to view full size"
              />
              <div className="col" style={{ gap: 4 }}>
                <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{e.attachment.name}</div>
                <div className="row" style={{ gap: 8 }}>
                  <button onClick={() => fileRef.current.click()} className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}>Replace</button>
                  <button onClick={() => u('attachment', null)} className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px', color: 'var(--down)' }}>Remove</button>
                </div>
              </div>
            </div>
          ) : (
            <button onClick={() => fileRef.current.click()} disabled={attachLoading}
              style={{ ...inputStyle, cursor: 'pointer', textAlign: 'left', color: 'var(--ink-3)', background: 'var(--bg-2)', border: '1.5px dashed var(--line)' }}>
              {attachLoading ? 'Compressing…' : '📎 Click to attach image'}
            </button>
          )}
          {attachErr && <div style={{ fontSize: 11, color: 'var(--down)', marginTop: 4 }}>{attachErr}</div>}
        </Field>

        <div className="row" style={{ gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} className="btn btn-ghost">Cancel</button>
          <button type="button" onClick={() => onSave({ ...e, amount: +e.amount || 0 })} className="btn btn-primary" disabled={!e.amount}>
            {isNew ? 'Add entry' : 'Save'}
          </button>
        </div>

        {/* Full-size attachment viewer */}
        <ImageLightbox open={showFull && !!e.attachment} onClose={() => setShowFull(false)} src={e.attachment?.data} alt={`Attachment: ${e.attachment?.name || 'receipt'}`} />
    </Modal>
  );
}

// ─── Bank Statement Import Modal ─────────────────────────────────────────────
function ImportModal({ accounts, currency, onImport, onCancel }) {
  const [step, setStep] = useState('upload');   // upload | map | preview
  const [parsed, setParsed] = useState(null);   // { headers, rows }
  const [colMap, setColMap] = useState({});
  const [drafts, setDrafts] = useState([]);
  const [acctId, setAcctId] = useState('');
  const [curr, setCurr] = useState(currency || 'RWF');
  const [err, setErr] = useState(null);
  const fileRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    setErr(null);
    const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_CSV_BYTES) {
      setErr('File too large (max 5 MB). Export a shorter date range from your bank app.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const result = parseCSV(ev.target.result);
        if (!result.headers.length) throw new Error('Could not read headers from this file. Make sure it\'s a CSV.');
        const detected = detectColumns(result.headers);
        setParsed(result);
        setColMap(detected);
        setStep('map');
      } catch (e) { setErr(e.message); }
    };
    reader.readAsText(file);
  };

  const generateDrafts = () => {
    try {
      const d = rowsToDrafts(parsed.rows, colMap, curr);
      if (!d.length) throw new Error('No transactions found with current column mapping. Try adjusting the columns.');
      setDrafts(d.map((x, i) => ({ ...x, _key: i })));
      setStep('preview');
    } catch (e) { setErr(e.message); }
  };

  const updateDraft = (key, field, val) =>
    setDrafts(ds => ds.map(d => d._key === key ? { ...d, [field]: val } : d));

  const removeDraft = (key) => setDrafts(ds => ds.filter(d => d._key !== key));

  const doImport = () => {
    const entries = drafts.map(d => ({
      id: id(), type: d.type, category: d.category,
      amount: d.amount, currency: d.currency || curr,
      date: d.date, recurring: 'once', notes: d.notes,
      accountId: acctId || null, attachment: null,
    }));
    onImport(entries);
  };

  const colOpts = ['', ...(parsed?.headers || [])];
  const colField = (label, key) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label style={{ fontSize: 12, color: 'var(--ink-2)', width: 90, flexShrink: 0 }}>{label}</label>
      <select value={colMap[key] || ''} onChange={e => setColMap(m => ({ ...m, [key]: e.target.value || null }))} style={{ ...inputStyle, flex: 1, fontSize: 12 }}>
        {colOpts.map(o => <option key={o} value={o}>{o || '— skip —'}</option>)}
      </select>
    </div>
  );

  const incCats = INCOME_CATEGORIES;
  const expCats = EXPENSE_CATEGORIES;

  return (
    <Modal open onClose={onCancel} maxWidth={step === 'preview' ? 900 : 560} title="Import bank statement">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          <div>
            <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Step {step === 'upload' ? 1 : step === 'map' ? 2 : 3} of 3
            </div>
            <h2 className="font-serif" style={{ fontSize: 22, marginTop: 2, margin: 0, fontWeight: 400 }}>
              {step === 'upload' ? 'Upload bank statement' : step === 'map' ? 'Map columns' : `Review ${drafts.length} transactions`}
            </h2>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close dialog" className="btn-icon-sm">
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {err && (
          <div style={{ padding: '10px 14px', background: 'var(--down-soft)', color: 'var(--down)', borderRadius: 8, fontSize: 12.5, marginBottom: 14 }}>
            {err}
          </div>
        )}

        {/* ── Step 1: Upload ── */}
        {step === 'upload' && (
          <>
            <div className="muted" style={{ fontSize: 13, marginTop: 8, marginBottom: 20, lineHeight: 1.6 }}>
              Export a CSV from your bank's internet banking (BK, Equity, I&M, Cogebanque, MTN MoMo, etc.) and upload it here.
              We'll detect columns automatically.
            </div>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" style={{ display: 'none' }}
              onChange={ev => handleFile(ev.target.files?.[0])} />
            <button onClick={() => fileRef.current.click()} style={{
              ...inputStyle, cursor: 'pointer', textAlign: 'center', color: 'var(--ink-3)',
              background: 'var(--bg-2)', border: '2px dashed var(--line)', padding: 40, fontSize: 14,
            }}>
              📁 Click to choose CSV file
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 18 }}>
              <Field label="Account (optional)">
                <select value={acctId} onChange={e => setAcctId(e.target.value)} style={inputStyle}>
                  <option value="">— None —</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.bank || a.wallet || a.name}</option>)}
                </select>
              </Field>
              <Field label="Statement currency">
                <select value={curr} onChange={e => setCurr(e.target.value)} style={inputStyle}>
                  {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                </select>
              </Field>
            </div>
          </>
        )}

        {/* ── Step 2: Map columns ── */}
        {step === 'map' && parsed && (
          <>
            <div className="muted" style={{ fontSize: 12, marginTop: 8, marginBottom: 18, lineHeight: 1.6 }}>
              We detected <strong>{parsed.headers.length}</strong> columns and{' '}
              <strong>{parsed.rows.length}</strong> rows. Map them to the fields below.
              Either <em>Debit + Credit</em> or <em>Amount + Type</em> must be filled.
            </div>
            <div className="col" style={{ gap: 10 }}>
              {colField('Date', 'date')}
              {colField('Description', 'desc')}
              {colField('Debit (out)', 'debit')}
              {colField('Credit (in)', 'credit')}
              {colField('Amount', 'amount')}
              {colField('Type (Dr/Cr)', 'type')}
            </div>
            {/* Preview of first 3 rows */}
            <div style={{ marginTop: 16, overflowX: 'auto' }}>
              <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>First 3 rows preview:</div>
              <table style={{ fontSize: 11, borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>{parsed.headers.map(h => <th key={h} style={{ padding: '4px 8px', background: 'var(--bg-2)', borderBottom: '1px solid var(--line)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 3).map((r, i) => (
                    <tr key={i}>{parsed.headers.map(h => <td key={h} style={{ padding: '3px 8px', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r[h]}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row" style={{ gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setStep('upload')} className="btn btn-ghost">← Back</button>
              <button onClick={generateDrafts} className="btn btn-primary">Generate preview →</button>
            </div>
          </>
        )}

        {/* ── Step 3: Preview & edit ── */}
        {step === 'preview' && (
          <>
            <div className="muted" style={{ fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>
              Review categories below. Click any row's category to change it. Remove rows you don't want to import.
            </div>
            <div style={{ overflowX: 'auto', marginBottom: 16 }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-2)' }}>
                    {['Date', 'Description', 'Type', 'Amount', 'Category', ''].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {drafts.map(d => (
                    <tr key={d._key} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', color: 'var(--ink-3)', fontSize: 11 }}>{d.date}</td>
                      <td style={{ padding: '7px 10px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d._desc}>{d._desc || '—'}</td>
                      <td style={{ padding: '7px 10px' }}>
                        <select value={d.type} onChange={ev => updateDraft(d._key, 'type', ev.target.value)}
                          style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--line)', background: d.type === 'income' ? 'var(--up-soft)' : 'var(--down-soft)', color: d.type === 'income' ? 'var(--up)' : 'var(--down)', cursor: 'pointer' }}>
                          <option value="income">▲ Income</option>
                          <option value="expense">▼ Expense</option>
                        </select>
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', color: d.type === 'income' ? 'var(--up)' : 'var(--down)' }}>
                        {d.type === 'income' ? '+' : '−'}{d.amount.toLocaleString()}
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        <select value={d.category} onChange={ev => updateDraft(d._key, 'category', ev.target.value)}
                          style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--paper)', cursor: 'pointer' }}>
                          <optgroup label="Income">
                            {incCats.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                          </optgroup>
                          <optgroup label="Expense">
                            {expCats.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                          </optgroup>
                        </select>
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        <button onClick={() => removeDraft(d._key)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--down)', fontSize: 16, lineHeight: 1 }}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row" style={{ gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="muted" style={{ fontSize: 12 }}>
                {drafts.filter(d => d.type === 'income').length} income · {drafts.filter(d => d.type === 'expense').length} expenses
              </div>
              <div className="row" style={{ gap: 10 }}>
                <button type="button" onClick={() => setStep('map')} className="btn btn-ghost">← Back</button>
                <button type="button" onClick={doImport} className="btn btn-primary" disabled={!drafts.length}>
                  Import {drafts.length} entries →
                </button>
              </div>
            </div>
          </>
        )}
    </Modal>
  );
}

// ─── Cashflow row ─────────────────────────────────────────────────────────────
function CFRow({ cf, accounts, onEdit, onDelete }) {
  const [showImg, setShowImg] = useState(false);
  const cat = ALL_CATS.find(c => c.id === cf.category);
  const acct = accounts.find(a => a.id === cf.accountId);
  const isIncome = cf.type === 'income';

  return (
    <div>
      <div className="row" style={{ padding: '12px 20px', justifyContent: 'space-between' }}>
        <div className="col" style={{ gap: 3, minWidth: 0, flex: 1 }}>
          <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{cat?.label || cf.category}</div>
            {acct && (
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'var(--brand-soft)', color: 'var(--brand)', fontWeight: 500 }}>
                {acct.bank || acct.wallet || acct.name}
              </span>
            )}
            {cf.attachment && (
              <button onClick={() => setShowImg(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} title="View attachment">
                <img src={cf.attachment.thumb} alt="receipt" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover', border: '1px solid var(--line)' }} />
              </button>
            )}
          </div>
          <div className="muted" style={{ fontSize: 11 }}>
            {cf.notes || cf.recurring} · {cf.date}
          </div>
        </div>
        <div className="row" style={{ gap: 10, alignItems: 'center', flexShrink: 0 }}>
          <div className="num" style={{ fontSize: 14, fontWeight: 700, color: isIncome ? 'var(--up)' : 'var(--down)' }}>
            {isIncome ? '+' : '−'}{fmt(cf.amount, cf.currency, { compact: true })}
          </div>
          <button onClick={() => onEdit(cf)} style={{ padding: '4px 8px', fontSize: 11, borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', cursor: 'pointer' }}>Edit</button>
          <button onClick={() => onDelete(cf.id)} style={{ padding: '4px 8px', fontSize: 11, borderRadius: 6, border: '1px solid var(--down-soft)', background: 'transparent', color: 'var(--down)', cursor: 'pointer' }}>×</button>
        </div>
      </div>
      <ImageLightbox open={showImg && !!cf.attachment} onClose={() => setShowImg(false)} src={cf.attachment?.data} alt="Cashflow receipt" />
    </div>
  );
}

/** Expand recurring entries into monthly amounts for a given month. */
function monthlyAmount(entry) {
  const a = toBase(entry.amount, entry.currency || 'RWF');
  switch (entry.recurring) {
    case 'monthly':   return a;
    case 'quarterly': return a / 3;
    case 'annually':  return a / 12;
    default:          return a;
  }
}

// ─── Main view ────────────────────────────────────────────────────────────────
export default function CashFlowView({ state, dispatch }) {
  const { cashflows = [], assets = [], profile } = state;
  const accounts = useMemo(() => assets.filter(a => ACCOUNT_KINDS.has(a.kind)), [assets]);

  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);

  const refDate = new Date();
  refDate.setMonth(refDate.getMonth() + monthOffset);
  const refYear = refDate.getFullYear(), refMonth = refDate.getMonth();
  const monthLabel = refDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const { incomes, expenses, totInc, totExp } = useMemo(() => {
    const incomes = [], expenses = [];
    let totInc = 0, totExp = 0;
    cashflows.forEach(cf => {
      const entryDate = new Date(cf.date);
      const inMonth = cf.recurring !== 'once'
        ? entryDate <= new Date(refYear, refMonth + 1, 0)
        : entryDate.getFullYear() === refYear && entryDate.getMonth() === refMonth;
      if (!inMonth) return;
      const ma = monthlyAmount(cf);
      if (cf.type === 'income') { incomes.push({ ...cf, _monthly: ma }); totInc += ma; }
      else { expenses.push({ ...cf, _monthly: ma }); totExp += ma; }
    });
    return { incomes, expenses, totInc, totExp };
  }, [cashflows, refYear, refMonth]);

  const netFlow = totInc - totExp;
  const savingsRate = totInc > 0 ? (netFlow / totInc) * 100 : 0;

  const barData = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
    const y = d.getFullYear(), m = d.getMonth();
    let inc = 0, exp = 0;
    cashflows.forEach(cf => {
      const ed = new Date(cf.date);
      const applies = cf.recurring !== 'once'
        ? ed <= new Date(y, m + 1, 0)
        : ed.getFullYear() === y && ed.getMonth() === m;
      if (!applies) return;
      const ma = monthlyAmount(cf);
      if (cf.type === 'income') inc += ma; else exp += ma;
    });
    return { label: d.toLocaleDateString('en-GB', { month: 'short' }), inc, exp };
  }), [cashflows]);

  const barMax = Math.max(...barData.map(b => Math.max(b.inc, b.exp)), 1);

  const cfGroup = (items) => {
    const out = {};
    items.forEach(cf => {
      const cat = ALL_CATS.find(c => c.id === cf.category) || ALL_CATS[ALL_CATS.length - 1];
      if (!out[cat.label]) out[cat.label] = { label: cat.label, items: [], total: 0 };
      out[cat.label].items.push(cf);
      out[cat.label].total += cf._monthly;
    });
    return Object.values(out).sort((a, b) => b.total - a.total);
  };

  const handleSave = (entry) => {
    dispatch({ type: 'upsertCashflow', entry });
    setEditing(null);
  };

  const handleImport = (entries) => {
    entries.forEach(entry => dispatch({ type: 'upsertCashflow', entry }));
    setImporting(false);
  };

  const handleDelete = (cfId) => dispatch({ type: 'deleteCashflow', id: cfId });

  return (
    <div style={{ padding: 28, background: 'var(--bg)', minHeight: 'calc(100vh - 70px)' }}>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 22 }}>
        {[
          { label: 'Monthly income',   value: fmtBase(totInc, profile.displayCurrency, { compact: true }), color: 'var(--up)',   bg: 'var(--up-soft)' },
          { label: 'Monthly expenses', value: fmtBase(totExp, profile.displayCurrency, { compact: true }), color: 'var(--down)', bg: 'var(--down-soft)' },
          { label: 'Net cash flow',    value: `${netFlow >= 0 ? '+' : ''}${fmtBase(netFlow, profile.displayCurrency, { compact: true })}`, color: netFlow >= 0 ? 'var(--up)' : 'var(--down)', bg: netFlow >= 0 ? 'var(--up-soft)' : 'var(--down-soft)' },
          { label: 'Savings rate',     value: `${savingsRate.toFixed(1)}%`, color: savingsRate >= 20 ? 'var(--up)' : savingsRate > 0 ? 'var(--gold)' : 'var(--down)', bg: 'var(--paper)' },
        ].map((c, i) => (
          <div key={i} style={{ padding: '14px 18px', borderRadius: 'var(--r-md)', background: c.bg, border: '0.5px solid var(--line)' }}>
            <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
            <div className="num" style={{ fontSize: 22, fontWeight: 700, color: c.color, letterSpacing: '-0.02em' }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* 6-month bar chart */}
      {cashflows.length > 0 && (
        <div className="card" style={{ padding: '18px 22px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>6-Month Cash Flow</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 80 }}>
            {barData.map((b, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', display: 'flex', gap: 3, alignItems: 'flex-end', height: 60 }}>
                  <div style={{ flex: 1, background: 'var(--up)', borderRadius: '3px 3px 0 0', height: `${(b.inc / barMax) * 100}%`, minHeight: 2, opacity: 0.7 }} />
                  <div style={{ flex: 1, background: 'var(--down)', borderRadius: '3px 3px 0 0', height: `${(b.exp / barMax) * 100}%`, minHeight: 2, opacity: 0.7 }} />
                </div>
                <div style={{ fontSize: 9, color: 'var(--ink-4)' }}>{b.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            {[{ color: 'var(--up)', label: 'Income' }, { color: 'var(--down)', label: 'Expense' }].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, background: l.color, borderRadius: 2, opacity: 0.7 }} />
                <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Month navigator + actions */}
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div className="row" style={{ gap: 8 }}>
          <button onClick={() => setMonthOffset(m => m - 1)} className="btn btn-ghost" style={{ padding: '7px 14px' }}>‹ Prev</button>
          <div style={{ padding: '7px 14px', borderRadius: 'var(--r-md)', background: 'var(--paper)', border: '1px solid var(--line)', fontSize: 13, fontWeight: 600 }}>{monthLabel}</div>
          <button onClick={() => setMonthOffset(m => m + 1)} disabled={monthOffset >= 0} className="btn btn-ghost" style={{ padding: '7px 14px' }}>Next ›</button>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button onClick={() => setImporting(true)} className="btn btn-ghost" style={{ fontSize: 13 }}>⬆ Import statement</button>
          <button onClick={() => setEditing({})} className="btn btn-primary">＋ Add entry</button>
        </div>
      </div>

      {/* Income section */}
      {incomes.length > 0 && (
        <div className="card" style={{ padding: 0, marginBottom: 14 }}>
          <div className="row" style={{ padding: '14px 20px', justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--up)', flexShrink: 0 }} />
              <div className="font-serif" style={{ fontSize: 16 }}>Income</div>
              <span className="pill pill-soft">{incomes.length}</span>
            </div>
            <div className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--up)' }}>
              + {fmtBase(totInc, profile.displayCurrency, { compact: true })}
            </div>
          </div>
          <div className="hr" />
          {cfGroup(incomes).map((g, gi) => (
            <div key={g.label}>
              {gi > 0 && <div className="hr" style={{ margin: '0 20px' }} />}
              {g.items.map((cf, i) => (
                <div key={cf.id}>
                  {i > 0 && <div className="hr" style={{ margin: '0 20px' }} />}
                  <CFRow cf={cf} accounts={accounts} onEdit={setEditing} onDelete={handleDelete} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Expense section */}
      {expenses.length > 0 && (
        <div className="card" style={{ padding: 0, marginBottom: 14 }}>
          <div className="row" style={{ padding: '14px 20px', justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--down)', flexShrink: 0 }} />
              <div className="font-serif" style={{ fontSize: 16 }}>Expenses</div>
              <span className="pill pill-soft">{expenses.length}</span>
            </div>
            <div className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--down)' }}>
              − {fmtBase(totExp, profile.displayCurrency, { compact: true })}
            </div>
          </div>
          <div className="hr" />
          {cfGroup(expenses).map((g, gi) => (
            <div key={g.label}>
              {gi > 0 && <div className="hr" style={{ margin: '0 20px' }} />}
              {g.items.map((cf, i) => (
                <div key={cf.id}>
                  {i > 0 && <div className="hr" style={{ margin: '0 20px' }} />}
                  <CFRow cf={cf} accounts={accounts} onEdit={setEditing} onDelete={handleDelete} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {cashflows.length === 0 && (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <div className="font-serif" style={{ fontSize: 22, marginBottom: 8 }}>Track your cash flow</div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 20 }}>
            Add individual entries or import a bank statement CSV to get started.
          </div>
          <div className="row" style={{ gap: 10, justifyContent: 'center' }}>
            <button onClick={() => setImporting(true)} className="btn btn-ghost">⬆ Import statement</button>
            <button onClick={() => setEditing({})} className="btn btn-primary">＋ Add first entry</button>
          </div>
        </div>
      )}

      {editing !== null && (
        <CFEditor entry={editing} accounts={accounts} onSave={handleSave} onCancel={() => setEditing(null)} />
      )}
      {importing && (
        <ImportModal accounts={accounts} currency={profile.displayCurrency} onImport={handleImport} onCancel={() => setImporting(false)} />
      )}
    </div>
  );
}
