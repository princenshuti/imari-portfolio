import { useState, useMemo, useRef, useEffect } from 'react';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, CURRENCIES, toBase, fmtBase, fmt, id } from '../data.js';
import { Field, inputStyle } from '../components/Field.jsx';
import Modal, { ImageLightbox } from '../components/Modal.jsx';
import { parseFile, detectColumns, rowsToDrafts, aiCategorize } from '../services/bankImport.js';
import { hasEnvKey } from '../ai.js';
import { ConfirmDestructive } from '../components/ConfirmDestructive.jsx';
import { Donut } from '../components/charts.jsx';

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
const STEP_LABELS = { upload: 'Upload statement', map: 'Map columns', ai: 'AI categorising', review: 'Review & import' };
const STEP_ORDER  = ['upload', 'map', 'ai', 'review'];

function ImportModal({ accounts, currency, onImport, onCancel }) {
  const [step, setStep] = useState('upload');
  const [parsed, setParsed] = useState(null);            // { headers, rows }
  const [colMap, setColMap] = useState({});
  const [drafts, setDrafts] = useState([]);
  const [acctId, setAcctId] = useState(accounts[0]?.id || '');
  const [curr, setCurr] = useState(currency || 'RWF');
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiProgress, setAiProgress] = useState({ done: 0, total: 0 });
  const [reviewedFlag, setReviewedFlag] = useState(false); // explicit confirmation for low-conf rows
  const [fileName, setFileName] = useState('');
  const fileRef = useRef(null);

  const stepIdx = STEP_ORDER.indexOf(step);
  const lowCount = drafts.filter(d => d._confidence === 'low').length;
  const aiAvailable = hasEnvKey;

  // ── File upload ────────────────────────────────────────────────────────────
  const handleFile = async (file) => {
    if (!file) return;
    if (!acctId) { setErr('Pick the account this statement belongs to first.'); return; }
    setErr(null); setLoading(true); setFileName(file.name);
    try {
      const result = await parseFile(file);
      if (!result.headers.length) throw new Error('No headers found. Open the file in Excel and make sure row 1 has column titles.');
      const detected = detectColumns(result.headers);
      setParsed(result);
      setColMap(detected);
      setStep('map');
    } catch (e) {
      setErr(e.message || 'Could not read this file.');
      setFileName('');
    } finally { setLoading(false); }
  };

  // ── Generate drafts + (optionally) run AI ──────────────────────────────────
  const goToReview = async () => {
    setErr(null);
    try {
      const d = rowsToDrafts(parsed.rows, colMap, curr);
      if (!d.length) throw new Error('No transactions matched. Check your column mapping — debit+credit OR amount+type must be filled.');
      setDrafts(d);

      const lowDrafts = d.filter(x => x._confidence === 'low');
      if (aiAvailable && lowDrafts.length > 0) {
        setStep('ai');
        setAiProgress({ done: 0, total: d.length });
        const refined = await aiCategorize(d, {
          onProgress: (done, total) => setAiProgress({ done, total }),
        });
        // Sort low-confidence to top so user sees what needs attention first
        const sorted = [...refined].sort((a, b) => {
          if (a._confidence === b._confidence) return 0;
          return a._confidence === 'low' ? -1 : 1;
        });
        setDrafts(sorted);
      }
      setStep('review');
    } catch (e) { setErr(e.message); setStep('map'); }
  };

  const updateDraft = (key, field, val) =>
    setDrafts(ds => ds.map(d => d._key === key
      ? { ...d, [field]: val, ...(field === 'category' ? { _confidence: 'high', _userTouched: true } : {}) }
      : d));

  const removeDraft = (key) => setDrafts(ds => ds.filter(d => d._key !== key));

  const stillFlagged = drafts.filter(d => d._confidence === 'low' && !d._userTouched).length;
  const canImport = drafts.length > 0 && (stillFlagged === 0 || reviewedFlag);

  const doImport = () => {
    const entries = drafts.map(d => ({
      id: id(), type: d.type, category: d.category,
      amount: d.amount, currency: d.currency || curr,
      date: d.date, recurring: 'once', notes: d.notes,
      accountId: acctId, attachment: null,
    }));
    onImport(entries);
  };

  // ── Column mapping helpers ─────────────────────────────────────────────────
  const colOpts = ['', ...(parsed?.headers || [])];
  const colField = (label, key, hint) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <label style={{ fontSize: 12, color: 'var(--ink-2)', width: 120, flexShrink: 0 }}>
        {label}
        {hint && <span className="muted" style={{ display: 'block', fontSize: 10, marginTop: 1 }}>{hint}</span>}
      </label>
      <select value={colMap[key] || ''} onChange={e => setColMap(m => ({ ...m, [key]: e.target.value || null }))} style={{ ...inputStyle, flex: 1, fontSize: 12 }}>
        {colOpts.map(o => <option key={o} value={o}>{o || '— skip —'}</option>)}
      </select>
    </div>
  );

  const incCats = INCOME_CATEGORIES;
  const expCats = EXPENSE_CATEGORIES;
  const maxW = step === 'review' ? 980 : step === 'ai' ? 460 : 580;
  const acctLabel = (a) => a ? `${a.bank || a.wallet || a.name} (${a.currency})` : '';
  const pickedAcct = accounts.find(a => a.id === acctId);

  return (
    <Modal open onClose={onCancel} maxWidth={maxW} title="Import bank statement">
      {/* Header — step indicator */}
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 18, alignItems: 'flex-start' }}>
        <div>
          <div className="muted" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
            Step {stepIdx + 1} of {STEP_ORDER.length}
          </div>
          <h2 className="font-serif" style={{ fontSize: 22, marginTop: 2, margin: 0, fontWeight: 400 }}>
            {STEP_LABELS[step]}
          </h2>
        </div>
        <button type="button" onClick={onCancel} aria-label="Close dialog" className="btn-icon-sm">
          <span aria-hidden="true">×</span>
        </button>
      </div>

      {/* Progress dots — quiet, just orient the user */}
      <div className="row" style={{ gap: 6, marginBottom: 22 }}>
        {STEP_ORDER.map((s, i) => (
          <div key={s} style={{
            height: 3, flex: 1, borderRadius: 999,
            background: i <= stepIdx ? 'var(--brand)' : 'var(--line)',
            transition: 'background 200ms var(--ease-out)',
          }} />
        ))}
      </div>

      {err && (
        <div role="alert" style={{
          padding: '10px 14px', background: 'var(--down-soft)', color: 'var(--down-ink)',
          borderRadius: 8, fontSize: 12.5, marginBottom: 14, lineHeight: 1.5,
        }}>
          {err}
        </div>
      )}

      {/* ── Step 1: Upload ────────────────────────────────────────────────── */}
      {step === 'upload' && (
        <>
          <div className="muted" style={{ fontSize: 13, marginBottom: 18, lineHeight: 1.6 }}>
            Export a statement from your bank, MTN MoMo or Airtel Money app, pick the matching
            account here, and Imari will categorise every transaction for you.
          </div>

          {/* Account selector — required, first thing */}
          <Field label="Account this statement belongs to *">
            {accounts.length > 0 ? (
              <select value={acctId} onChange={e => setAcctId(e.target.value)} style={inputStyle} required>
                <option value="">— Choose account —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{acctLabel(a)}</option>)}
              </select>
            ) : (
              <div className="muted" style={{ fontSize: 12, padding: '12px 14px', background: 'var(--bg-2)', borderRadius: 8, lineHeight: 1.5 }}>
                You don't have any accounts yet. Add a bank or Mobile Money account in <strong>Accounts</strong> first,
                then come back here to import statements.
              </div>
            )}
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginTop: 14 }}>
            <Field label="Statement currency">
              <select value={curr} onChange={e => setCurr(e.target.value)} style={inputStyle}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
              </select>
            </Field>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls"
            style={{ display: 'none' }}
            onChange={ev => handleFile(ev.target.files?.[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={!acctId || loading || accounts.length === 0}
            className="cf-import-drop"
            style={{
              marginTop: 18, width: '100%', cursor: !acctId ? 'not-allowed' : 'pointer',
              textAlign: 'center', color: 'var(--ink-2)', background: 'var(--bg-2)',
              border: '1.5px dashed var(--line-strong)', borderRadius: 'var(--r-md)',
              padding: '32px 20px', fontSize: 13, lineHeight: 1.5, fontFamily: 'inherit',
              transition: 'background 180ms var(--ease-out), border-color 180ms var(--ease-out), transform 120ms var(--ease-out)',
              opacity: (!acctId || accounts.length === 0) ? 0.55 : 1,
            }}
          >
            {loading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Spinner /> Reading {fileName || 'file'}…
              </span>
            ) : (
              <>
                <div style={{ fontSize: 22, marginBottom: 6 }}>↓</div>
                <div style={{ fontWeight: 600, color: 'var(--ink)' }}>Choose a CSV or Excel file</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                  .csv · .tsv · .xlsx · .xls — up to 10 MB
                </div>
              </>
            )}
          </button>

          <details style={{ marginTop: 16, padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 8 }}>
            <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>
              Which banks and formats are supported?
            </summary>
            <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.65, marginTop: 8 }}>
              <strong style={{ color: 'var(--ink-2)' }}>Tested:</strong> Bank of Kigali, Equity, I&amp;M, Cogebanque, KCB, BPR,
              MTN MoMo (mini-statement Excel export), Airtel Money.
              <br />
              <strong style={{ color: 'var(--ink-2)' }}>Auto-detected columns:</strong> Date, Description / Narration / Details,
              Debit / Credit / Money In / Money Out, Amount, Type, Charge / Fee.
              <br />
              <strong style={{ color: 'var(--ink-2)' }}>Not supported:</strong> PDF, OFX, MT940 — save as Excel or CSV first.
            </div>
          </details>
        </>
      )}

      {/* ── Step 2: Map columns ──────────────────────────────────────────── */}
      {step === 'map' && parsed && (
        <>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 18, lineHeight: 1.6 }}>
            Found <strong>{parsed.headers.length}</strong> columns, <strong>{parsed.rows.length}</strong> rows in{' '}
            <strong style={{ color: 'var(--ink-2)' }}>{fileName}</strong>.
            Fill <em>Debit + Credit</em> <strong>or</strong> <em>Amount + Type</em>.
          </div>
          <div className="col" style={{ gap: 12 }}>
            {colField('Date', 'date')}
            {colField('Description', 'desc')}
            {colField('Money out', 'debit', 'Debit / Withdrawal / Sent')}
            {colField('Money in', 'credit', 'Credit / Deposit / Received')}
            {colField('Amount', 'amount', 'Single-amount column')}
            {colField('Type', 'type', 'Dr/Cr column')}
            {colField('Fee / Charge', 'fee', 'Booked as separate utilities expense')}
          </div>

          {/* Preview the first 3 rows */}
          <div style={{ marginTop: 18, overflowX: 'auto', borderRadius: 8, border: '1px solid var(--line)' }}>
            <table style={{ fontSize: 11, borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>{parsed.headers.map(h => (
                  <th key={h} style={{ padding: '7px 10px', background: 'var(--bg-2)', borderBottom: '1px solid var(--line)', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--ink-2)' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 3).map((r, i) => (
                  <tr key={i}>{parsed.headers.map(h => (
                    <td key={h} style={{ padding: '6px 10px', borderTop: '1px solid var(--line-soft)', whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--ink-3)' }}>{r[h]}</td>
                  ))}</tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="row" style={{ gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
            <button onClick={() => { setStep('upload'); setErr(null); }} className="btn btn-ghost">← Back</button>
            <button onClick={goToReview} className="btn btn-primary">
              {aiAvailable ? 'Categorise & review →' : 'Generate preview →'}
            </button>
          </div>
        </>
      )}

      {/* ── Step 3: AI categorising interstitial ─────────────────────────── */}
      {step === 'ai' && (
        <div style={{ padding: '36px 20px 28px', textAlign: 'center' }}>
          <Spinner size={36} />
          <div className="font-serif" style={{ fontSize: 18, marginTop: 18, marginBottom: 6, fontWeight: 400 }}>
            Categorising your transactions
          </div>
          <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.6, maxWidth: 360, margin: '0 auto' }}>
            Imari is reading each description and picking the best category.
            Anything unclear will be flagged for you to confirm.
          </div>
          {aiProgress.total > 0 && (
            <div style={{ marginTop: 22, maxWidth: 280, marginLeft: 'auto', marginRight: 'auto' }}>
              <div style={{ height: 4, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${(aiProgress.done / aiProgress.total) * 100}%`,
                  background: 'var(--brand)',
                  transition: 'width 240ms var(--ease-out)',
                }} />
              </div>
              <div className="muted" style={{ fontSize: 10.5, marginTop: 6 }}>
                {aiProgress.done} of {aiProgress.total} transactions
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step 4: Review & import ──────────────────────────────────────── */}
      {step === 'review' && (
        <>
          {/* Summary strip */}
          <div className="row" style={{ gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <Stat label="To import" value={drafts.length} accent="var(--brand)" />
            <Stat label="Income"   value={drafts.filter(d => d.type === 'income').length} accent="var(--up)" />
            <Stat label="Expenses" value={drafts.filter(d => d.type === 'expense').length} accent="var(--down)" />
            <Stat label="Needs review" value={lowCount} accent={lowCount ? 'var(--gold-ink)' : 'var(--ink-3)'} />
            <div style={{ flex: 1, minWidth: 140, padding: '8px 12px', background: 'var(--brand-softer)', borderRadius: 8, fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.4 }}>
              Will post to{' '}
              <strong style={{ color: 'var(--brand)' }}>{acctLabel(pickedAcct) || 'selected account'}</strong>
            </div>
          </div>

          {lowCount > 0 && (
            <div role="status" style={{
              padding: '10px 14px', borderRadius: 8, background: 'var(--gold-softer)',
              fontSize: 12, color: 'var(--ink-2)', marginBottom: 14, lineHeight: 1.55,
              border: '1px solid var(--gold-soft)',
            }}>
              <strong style={{ color: 'var(--gold-ink)' }}>{lowCount}</strong>{' '}
              {lowCount === 1 ? 'transaction needs' : 'transactions need'} your eye.
              They're at the top of the list — pick the right category from the dropdown,
              or tick the box below the table to import them as-is.
            </div>
          )}

          <div className="cf-import-table-wrap" style={{ overflowX: 'auto', marginBottom: 16, borderRadius: 8, border: '1px solid var(--line)' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-2)' }}>
                  {['', 'Date', 'Description', 'Type', 'Amount', 'Category', ''].map((h, i) => (
                    <th key={i} style={{
                      padding: '9px 10px', textAlign: i === 4 ? 'right' : 'left',
                      fontWeight: 600, fontSize: 10.5, color: 'var(--ink-2)',
                      borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drafts.map((d, idx) => {
                  const flagged = d._confidence === 'low' && !d._userTouched;
                  return (
                    <tr
                      key={d._key}
                      className="cf-draft-row"
                      style={{
                        borderBottom: '1px solid var(--line-soft)',
                        background: flagged ? 'var(--gold-softer)' : 'transparent',
                        animationDelay: `${Math.min(idx * 18, 360)}ms`,
                      }}
                    >
                      <td style={{ padding: '8px 10px', width: 32 }}>
                        {flagged ? (
                          <span title="Needs your review" style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 18, height: 18, borderRadius: 999, background: 'var(--gold)',
                            color: '#1A170E', fontSize: 11, fontWeight: 700,
                          }}>!</span>
                        ) : d._aiCategorized ? (
                          <span title="Suggested by AI" style={{ fontSize: 11, color: 'var(--brand)' }}>✦</span>
                        ) : null}
                      </td>
                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: 'var(--ink-3)', fontSize: 11 }}>{d.date}</td>
                      <td style={{ padding: '8px 10px', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink-2)' }} title={d._desc}>
                        {d._desc || '—'}
                        {d._isFee && <span style={{ marginLeft: 6, fontSize: 9, padding: '1px 6px', borderRadius: 999, background: 'var(--bg-2)', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>fee</span>}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <select
                          value={d.type}
                          onChange={ev => updateDraft(d._key, 'type', ev.target.value)}
                          aria-label="Transaction type"
                          style={{
                            fontSize: 11, padding: '4px 7px', borderRadius: 6, border: '1px solid var(--line)',
                            background: d.type === 'income' ? 'var(--up-soft)' : 'var(--down-soft)',
                            color: d.type === 'income' ? 'var(--up-ink)' : 'var(--down-ink)',
                            fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          <option value="income">▲ Income</option>
                          <option value="expense">▼ Expense</option>
                        </select>
                      </td>
                      <td className="num" style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', color: d.type === 'income' ? 'var(--up)' : 'var(--down)' }}>
                        {d.type === 'income' ? '+' : '−'}{d.amount.toLocaleString()}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <select
                          value={d.category}
                          onChange={ev => updateDraft(d._key, 'category', ev.target.value)}
                          aria-label="Category"
                          style={{
                            fontSize: 11, padding: '4px 7px', borderRadius: 6,
                            border: flagged ? '1px solid var(--gold)' : '1px solid var(--line)',
                            background: 'var(--paper)', cursor: 'pointer', fontWeight: flagged ? 600 : 500,
                            minWidth: 150,
                          }}
                        >
                          <optgroup label="Income">
                            {incCats.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                          </optgroup>
                          <optgroup label="Expense">
                            {expCats.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                          </optgroup>
                        </select>
                      </td>
                      <td style={{ padding: '8px 10px', width: 32 }}>
                        <button
                          type="button"
                          onClick={() => removeDraft(d._key)}
                          aria-label="Remove this row"
                          className="cf-row-x"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--ink-4)', fontSize: 16, lineHeight: 1, padding: 4,
                            borderRadius: 6, transition: 'color 140ms var(--ease-out), background 140ms var(--ease-out)',
                          }}
                        >×</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Confirm-low-confidence checkbox */}
          {stillFlagged > 0 && (
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
              background: 'var(--bg-2)', borderRadius: 8, fontSize: 12, color: 'var(--ink-2)',
              cursor: 'pointer', lineHeight: 1.5, marginBottom: 14,
            }}>
              <input
                type="checkbox"
                checked={reviewedFlag}
                onChange={e => setReviewedFlag(e.target.checked)}
                style={{ marginTop: 2, accentColor: 'var(--brand)' }}
              />
              <span>
                I've reviewed the <strong>{stillFlagged}</strong> flagged{' '}
                {stillFlagged === 1 ? 'transaction' : 'transactions'} and want to import them as-is.
                You can still re-categorise them later from the Cash Flow list.
              </span>
            </label>
          )}

          <div className="row" style={{ gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" onClick={() => { setStep('map'); setReviewedFlag(false); }} className="btn btn-ghost">← Back</button>
            <button
              type="button"
              onClick={doImport}
              className="btn btn-primary"
              disabled={!canImport}
              title={!canImport ? `Resolve ${stillFlagged} flagged row${stillFlagged === 1 ? '' : 's'} first` : undefined}
            >
              Import {drafts.length} {drafts.length === 1 ? 'entry' : 'entries'} →
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ─── Small UI atoms used by ImportModal ─────────────────────────────────────
function Stat({ label, value, accent }) {
  return (
    <div style={{
      padding: '8px 14px', borderRadius: 8, background: 'var(--paper)',
      border: '1px solid var(--line)', minWidth: 92,
    }}>
      <div className="muted" style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{label}</div>
      <div className="num" style={{ fontSize: 17, fontWeight: 700, color: accent, letterSpacing: '-0.01em' }}>{value}</div>
    </div>
  );
}

function Spinner({ size = 16 }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block', width: size, height: size,
        border: `2px solid var(--line)`, borderTopColor: 'var(--brand)',
        borderRadius: '50%', animation: 'cf-spin 720ms linear infinite',
      }}
    />
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
          <button type="button" onClick={() => onEdit(cf)} aria-label={`Edit cashflow ${cf.description || cf.category || ''}`.trim()} style={{ padding: '4px 8px', fontSize: 11, borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', cursor: 'pointer' }}>Edit</button>
          <button type="button" onClick={() => onDelete(cf.id)} aria-label={`Delete cashflow ${cf.description || cf.category || ''}`.trim()} style={{ padding: '4px 8px', fontSize: 11, borderRadius: 6, border: '1px solid var(--down-soft)', background: 'transparent', color: 'var(--down)', cursor: 'pointer' }}><span aria-hidden="true">×</span></button>
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

  // Selectable chart window: 6M (compact) or 12M (year view). State persists
  // across mounts via session so user choice isn't reset on navigation.
  const [chartMonths, setChartMonths] = useState(() => {
    try { return Number(sessionStorage.getItem('imari:cf:chartMonths')) || 6; }
    catch { return 6; }
  });
  const setChartWindow = (n) => {
    setChartMonths(n);
    try { sessionStorage.setItem('imari:cf:chartMonths', String(n)); } catch {}
  };

  const barData = useMemo(() => Array.from({ length: chartMonths }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (chartMonths - 1 - i));
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
    return { label: d.toLocaleDateString('en-GB', { month: 'short' }), inc, exp, y, m };
  }), [cashflows, chartMonths]);

  const barMax = Math.max(...barData.map(b => Math.max(b.inc, b.exp)), 1);
  // Data-quality signal — months with any activity. < 3 → caveat shown above
  // the chart so users don't take aggregates (savings rate, averages) as gospel.
  const monthsWithData = barData.filter(b => b.inc > 0 || b.exp > 0).length;

  // Current-month expense breakdown by category — small pie next to the bar
  // chart. Pulls from the bottom-card month (filtered cashflows) so it reflects
  // whatever month the user is viewing.
  const expenseByCategory = useMemo(() => {
    const map = {};
    expenses.forEach(cf => {
      const c = ALL_CATS.find(x => x.id === cf.category) || ALL_CATS[ALL_CATS.length - 1];
      const inDisplay = toBase(monthlyAmount(cf), cf.currency || 'RWF');
      map[c.id] = map[c.id] || { id: c.id, label: c.label, color: c.color, value: 0 };
      map[c.id].value += inDisplay;
    });
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [expenses]);

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

  const [pendingDelete, setPendingDelete] = useState(null);
  const handleDelete = (cfId) => {
    const entry = (state.cashflows || []).find(c => c.id === cfId);
    setPendingDelete(entry || null);
  };

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

      {/* Trend chart + category breakdown ─────────────────────────────────── */}
      {cashflows.length > 0 && (
        <div className="card" style={{ padding: '18px 22px', marginBottom: 20, display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 22 }}>
          {/* Bar chart with axis labels + per-bar tooltips */}
          <div style={{ minWidth: 0 }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {chartMonths === 12 ? '12-Month' : '6-Month'} Cash Flow
              </div>
              <div className="row" style={{ gap: 4 }}>
                {[6, 12].map(n => (
                  <button
                    key={n}
                    onClick={() => setChartWindow(n)}
                    style={{
                      padding: '3px 9px', borderRadius: 6, border: 0,
                      background: chartMonths === n ? 'var(--brand)' : 'var(--bg-2)',
                      color:      chartMonths === n ? 'var(--brand-ink)' : 'var(--ink-2)',
                      fontSize: 10.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                    }}
                  >{n}M</button>
                ))}
              </div>
            </div>

            {/* Thin-data caveat — UX review #38 */}
            {monthsWithData > 0 && monthsWithData < 3 && (
              <div style={{
                padding: '8px 10px', marginBottom: 12, borderRadius: 6, fontSize: 11,
                background: 'var(--gold-soft)', color: 'var(--ink-2)',
              }}>
                Only <strong>{monthsWithData} month{monthsWithData === 1 ? '' : 's'}</strong> of data — averages
                and savings rate may not be reliable yet.
              </div>
            )}

            {/* Chart proper — Y-axis + bars side by side */}
            <div style={{ display: 'flex', gap: 8, height: 120 }}>
              {/* Y-axis ticks: max / 50% / 0 */}
              <div className="num" style={{
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                fontSize: 9, color: 'var(--ink-4)', textAlign: 'right', minWidth: 38,
                paddingBottom: 18,
              }}>
                <span>{fmtBase(barMax, profile.displayCurrency, { compact: true })}</span>
                <span>{fmtBase(barMax / 2, profile.displayCurrency, { compact: true })}</span>
                <span>0</span>
              </div>
              {/* Bars */}
              <div style={{ flex: 1, position: 'relative', display: 'flex', gap: 6, alignItems: 'flex-end', paddingBottom: 18 }}>
                {/* Horizontal gridlines */}
                {[0, 0.5, 1].map(p => (
                  <div key={p} style={{
                    position: 'absolute', left: 0, right: 0, bottom: 18 + p * 84,
                    height: 0.5, background: 'var(--line)', pointerEvents: 'none',
                  }} />
                ))}
                {barData.map((b, i) => {
                  const net = b.inc - b.exp;
                  const tip = `${b.label} ${b.y} · Income ${fmtBase(b.inc, profile.displayCurrency, { compact: true })} · Expense ${fmtBase(b.exp, profile.displayCurrency, { compact: true })} · Net ${net >= 0 ? '+' : ''}${fmtBase(net, profile.displayCurrency, { compact: true })}`;
                  return (
                    <div
                      key={i}
                      title={tip}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative', minWidth: 0 }}
                    >
                      <div style={{ width: '100%', display: 'flex', gap: 3, alignItems: 'flex-end', height: 84 }}>
                        <div style={{ flex: 1, background: 'var(--up)',   borderRadius: '3px 3px 0 0', height: `${(b.inc / barMax) * 100}%`, minHeight: b.inc > 0 ? 2 : 0, opacity: 0.78, transition: 'height 240ms cubic-bezier(0.23,1,0.32,1)' }} />
                        <div style={{ flex: 1, background: 'var(--down)', borderRadius: '3px 3px 0 0', height: `${(b.exp / barMax) * 100}%`, minHeight: b.exp > 0 ? 2 : 0, opacity: 0.78, transition: 'height 240ms cubic-bezier(0.23,1,0.32,1)' }} />
                      </div>
                      <div style={{ position: 'absolute', bottom: 0, fontSize: 9, color: 'var(--ink-4)' }}>{b.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="row" style={{ gap: 16, marginTop: 10 }}>
              {[{ color: 'var(--up)', label: 'Income' }, { color: 'var(--down)', label: 'Expense' }].map(l => (
                <div key={l.label} className="row" style={{ gap: 5 }}>
                  <div style={{ width: 10, height: 10, background: l.color, borderRadius: 2, opacity: 0.78 }} />
                  <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{l.label}</span>
                </div>
              ))}
              <span className="muted" style={{ fontSize: 9, marginLeft: 'auto' }}>Hover a bar for exact values</span>
            </div>
          </div>

          {/* Category breakdown pie for currently-viewed month — UX review #37 */}
          <div className="col" style={{ gap: 8, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Expenses by category</div>
            <div className="muted" style={{ fontSize: 10.5, marginTop: -4 }}>{monthLabel}</div>
            {expenseByCategory.length === 0 ? (
              <div className="muted" style={{ fontSize: 11, padding: 16, textAlign: 'center', background: 'var(--bg-2)', borderRadius: 8 }}>
                No expense data this month
              </div>
            ) : (
              <div className="row" style={{ gap: 12, alignItems: 'center' }}>
                <Donut size={84} thickness={11}
                  slices={expenseByCategory.map(c => ({ value: c.value, color: c.color }))} />
                <div className="col" style={{ gap: 4, fontSize: 11, flex: 1, minWidth: 0 }}>
                  {expenseByCategory.slice(0, 5).map(c => {
                    const total = expenseByCategory.reduce((s, x) => s + x.value, 0);
                    const pct = total > 0 ? (c.value / total) * 100 : 0;
                    return (
                      <div key={c.id} className="row" style={{ justifyContent: 'space-between', gap: 6, minWidth: 0 }}>
                        <span className="row" style={{ gap: 6, minWidth: 0 }}>
                          <span style={{ width: 7, height: 7, borderRadius: 1.5, background: c.color, flexShrink: 0 }} />
                          <span style={{ color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>
                        </span>
                        <span className="num" style={{ color: 'var(--ink-3)', fontSize: 10, flexShrink: 0 }}>{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                  {expenseByCategory.length > 5 && (
                    <span className="muted" style={{ fontSize: 9 }}>+{expenseByCategory.length - 5} more</span>
                  )}
                </div>
              </div>
            )}
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

      <ConfirmDestructive
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          dispatch({ type: 'deleteCashflow', id: pendingDelete.id });
          setPendingDelete(null);
        }}
        title="Delete this cash flow entry?"
        description={pendingDelete && (
          <span>
            <strong style={{ color: 'var(--ink)' }}>{pendingDelete.description || pendingDelete.category || pendingDelete.type}</strong>
            {' · '}
            <span className="num">{fmt(pendingDelete.amount, pendingDelete.currency || 'RWF')}</span>
            <br />
            {pendingDelete.accountId && 'Any linked account balance will recompute. '}
            You can't undo this.
          </span>
        )}
        confirmLabel="Delete entry"
      />
    </div>
  );
}
