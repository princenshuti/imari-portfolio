import { useState, useMemo } from 'react';
import { CURRENCIES, RWANDA_BANKS, MOMO_PROVIDERS, fmt, fmtBase, toBase, id } from '../data.js';
import { Field, Input, inputStyle } from '../components/Field.jsx';

const ACCOUNT_KINDS = new Set(['savings', 'momo-cash']);

function AccountEditor({ account, onSave, onCancel }) {
  const isNew = !account.id;
  const initialType = account.kind === 'momo-cash' ? 'momo' : 'bank';
  const [type, setType] = useState(initialType);
  const initialInstitution = account.bank || account.wallet || '';
  const list = type === 'bank' ? RWANDA_BANKS : MOMO_PROVIDERS;
  const isCustomInitial = initialInstitution && !list.includes(initialInstitution);
  const [institutionPick, setInstitutionPick] = useState(isCustomInitial ? '__custom__' : initialInstitution || list[0]);
  const [customName, setCustomName] = useState(isCustomInitial ? initialInstitution : '');
  const [accountNumber, setAccountNumber] = useState(account.accountNumber || '');
  const [amount, setAmount] = useState(account.currentValue ?? account.purchasePrice ?? '');
  const [currency, setCurrency] = useState(account.currency || 'RWF');
  const [yieldPct, setYieldPct] = useState(account.yieldPct ?? '');

  const institution = institutionPick === '__custom__' ? customName.trim() : institutionPick;
  const canSave = institution && amount !== '' && !isNaN(+amount);

  const handleSave = () => {
    const isBank = type === 'bank';
    const cleaned = {
      id: account.id || id(),
      kind: isBank ? 'savings' : 'momo-cash',
      name: isBank ? `${institution} account` : `${institution} balance`,
      currency,
      purchasePrice: +amount,
      currentValue: +amount,
      purchaseDate: account.purchaseDate || new Date().toISOString().slice(0, 10),
      accountNumber: accountNumber.trim() || undefined,
    };
    if (isBank) {
      cleaned.bank = institution;
      if (yieldPct !== '' && !isNaN(+yieldPct)) cleaned.yieldPct = +yieldPct;
    } else {
      cleaned.wallet = institution;
    }
    Object.keys(cleaned).forEach(k => cleaned[k] === undefined && delete cleaned[k]);
    onSave(cleaned);
  };

  return (
    <div onClick={onCancel} style={{
      position:'fixed', inset: 0, background:'rgba(20,20,16,0.55)', backdropFilter:'blur(4px)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex: 2147483640, padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} className="card" style={{
        width: '100%', maxWidth: 520, maxHeight: '90vh', overflow:'auto',
        padding: 28, background:'var(--paper)', boxShadow:'var(--shadow-pop)',
      }}>
        <div className="row" style={{ justifyContent:'space-between', alignItems:'flex-start', marginBottom: 18 }}>
          <div>
            <div className="muted" style={{ fontSize: 11, letterSpacing:'0.08em', textTransform:'uppercase' }}>{isNew ? 'Add account' : 'Edit account'}</div>
            <div className="font-serif" style={{ fontSize: 26, marginTop: 2 }}>{institution || 'New account'}</div>
          </div>
          <button onClick={onCancel} style={{
            width: 30, height: 30, borderRadius: 8, background:'var(--bg-2)', border: 0, fontSize: 16, cursor:'pointer', color:'var(--ink-3)',
          }}>×</button>
        </div>

        <Field label="Account type" top={4}>
          <div className="row" style={{ gap: 6 }}>
            {[
              { v: 'bank',  label: '⌬ Bank account' },
              { v: 'momo',  label: '○ Mobile money' },
            ].map(o => (
              <div key={o.v} onClick={() => { setType(o.v); const l = o.v === 'bank' ? RWANDA_BANKS : MOMO_PROVIDERS; setInstitutionPick(l[0]); }} style={{
                flex: 1, padding: '11px 12px', borderRadius: 9, cursor:'pointer', textAlign:'center',
                background: type === o.v ? 'var(--brand-soft)' : 'var(--bg-2)',
                color: type === o.v ? 'var(--brand)' : 'var(--ink-2)',
                border: type === o.v ? '1px solid var(--brand)' : '1px solid transparent',
                fontSize: 13, fontWeight: 500,
              }}>{o.label}</div>
            ))}
          </div>
        </Field>

        <Field label={type === 'bank' ? 'Bank' : 'Provider'}>
          <select value={institutionPick} onChange={e => setInstitutionPick(e.target.value)} style={inputStyle}>
            {list.map(b => <option key={b} value={b}>{b}</option>)}
            <option value="__custom__">— Other (custom name)</option>
          </select>
        </Field>

        {institutionPick === '__custom__' && (
          <Field label="Custom name" top={10}>
            <Input value={customName} onChange={setCustomName} placeholder={type === 'bank' ? 'e.g. SACCO Imbaraga' : 'e.g. Wave'} />
          </Field>
        )}

        <Field label="Account number" hint="optional">
          <Input value={accountNumber} onChange={setAccountNumber} placeholder={type === 'bank' ? 'e.g. 00040-12345678-01' : 'e.g. 078XXXXXXX'} />
        </Field>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 14 }}>
          <Field label="Current balance" hint={`in ${currency}`}>
            <Input value={amount} onChange={setAmount} type="number" placeholder="0" />
          </Field>
          <Field label="Currency">
            <select value={currency} onChange={e => setCurrency(e.target.value)} style={inputStyle}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.label}</option>)}
            </select>
          </Field>
        </div>

        {type === 'bank' && (
          <Field label="Interest rate (% / year)" hint="optional · used to project growth">
            <Input value={yieldPct} onChange={setYieldPct} type="number" placeholder="e.g. 5" />
          </Field>
        )}

        <div className="row" style={{ gap: 10, marginTop: 22, justifyContent:'flex-end' }}>
          <button onClick={onCancel} className="btn btn-ghost">Cancel</button>
          <button onClick={handleSave} className="btn btn-primary" disabled={!canSave}>
            {isNew ? 'Add account' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function maskAccountNumber(n) {
  if (!n) return '';
  const s = String(n);
  if (s.length <= 4) return s;
  return `••• ${s.slice(-4)}`;
}

function AccountCard({ acc, displayCurrency, onEdit, onDelete }) {
  const isBank = acc.kind === 'savings';
  const institution = acc.bank || acc.wallet || 'Account';
  const balance = acc.currentValue !== '' && acc.currentValue != null ? acc.currentValue : acc.purchasePrice;
  return (
    <div className="card" style={{ padding: 18, display:'grid', gridTemplateColumns:'auto 1fr auto', gap: 14, alignItems:'center' }}>
      <div style={{
        width: 44, height: 44, borderRadius: 11,
        background: isBank ? 'color-mix(in oklab, var(--sky) 16%, transparent)' : 'color-mix(in oklab, var(--brand) 16%, transparent)',
        color: isBank ? 'var(--sky)' : 'var(--brand)',
        display:'flex', alignItems:'center', justifyContent:'center', fontSize: 22, fontWeight: 600,
      }}>{isBank ? '⌬' : '○'}</div>
      <div className="col" style={{ minWidth: 0, gap: 3 }}>
        <div style={{ fontSize: 14, fontWeight: 600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{institution}</div>
        <div className="muted" style={{ fontSize: 11.5 }}>
          {isBank ? 'Bank account' : 'Mobile money'}
          {acc.accountNumber && ` · ${maskAccountNumber(acc.accountNumber)}`}
          {isBank && acc.yieldPct ? ` · ${acc.yieldPct}% / yr` : ''}
        </div>
      </div>
      <div className="col" style={{ alignItems:'flex-end', gap: 2 }}>
        <div className="num" style={{ fontSize: 18, fontWeight: 600 }}>
          {fmt(balance, acc.currency, { compact: balance > 1e7 })}
        </div>
        <div className="muted num" style={{ fontSize: 11 }}>
          {acc.currency !== displayCurrency && `≈ ${fmtBase(toBase(balance, acc.currency), displayCurrency, { compact: true })}`}
        </div>
        <div className="row" style={{ gap: 4, marginTop: 6 }}>
          <button onClick={() => onEdit(acc)} title="Edit" style={iconBtnStyle}>✎</button>
          <button onClick={() => onDelete(acc)} title="Delete" style={{ ...iconBtnStyle, color:'var(--down)' }}>×</button>
        </div>
      </div>
    </div>
  );
}

const iconBtnStyle = {
  width: 26, height: 26, borderRadius: 6, border: 0, background: 'transparent',
  color: 'var(--ink-3)', cursor: 'pointer', fontSize: 14, padding: 0,
};

export default function AccountsView({ state, dispatch }) {
  const { assets, profile } = state;
  const [editing, setEditing] = useState(null);

  const accounts = useMemo(() => assets.filter(a => ACCOUNT_KINDS.has(a.kind)), [assets]);
  const banks = accounts.filter(a => a.kind === 'savings');
  const momos = accounts.filter(a => a.kind === 'momo-cash');

  const totalsRWF = useMemo(() => {
    let bank = 0, momo = 0;
    accounts.forEach(a => {
      const v = a.currentValue !== '' && a.currentValue != null ? a.currentValue : a.purchasePrice;
      const inRWF = toBase(v, a.currency || 'RWF');
      if (a.kind === 'savings') bank += inRWF; else momo += inRWF;
    });
    return { bank, momo, total: bank + momo };
  }, [accounts]);

  const handleSave = (acc) => {
    dispatch({ type: 'upsertAsset', asset: acc });
    setEditing(null);
  };

  const handleDelete = (acc) => {
    if (confirm(`Delete "${acc.bank || acc.wallet}"? This removes it from your portfolio.`)) {
      dispatch({ type: 'deleteAsset', id: acc.id });
    }
  };

  return (
    <div style={{ padding: 28, background:'var(--bg)', minHeight:'calc(100vh - 70px)' }}>
      {/* Summary card */}
      <div className="card" style={{ padding: 24, marginBottom: 18 }}>
        <div className="row" style={{ justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div className="muted" style={{ fontSize: 11, letterSpacing:'0.06em', textTransform:'uppercase', fontWeight: 600 }}>Liquid balance</div>
            <div className="font-serif" style={{ fontSize: 42, lineHeight: 1, marginTop: 6, letterSpacing:'-0.02em' }}>
              {fmtBase(totalsRWF.total, profile.displayCurrency, { compact: totalsRWF.total > 1e8 })}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              {accounts.length} account{accounts.length === 1 ? '' : 's'} · counted toward your net worth
            </div>
          </div>
          <button onClick={() => setEditing({})} className="btn btn-primary">＋ Add account</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 12, marginTop: 20 }}>
          <div style={{ padding: 14, background:'var(--bg-2)', borderRadius: 10 }}>
            <div className="row" style={{ gap: 8, marginBottom: 4 }}>
              <span style={{ color:'var(--sky)', fontSize: 14 }}>⌬</span>
              <span className="muted" style={{ fontSize: 11, fontWeight: 600, letterSpacing:'0.06em', textTransform:'uppercase' }}>Bank accounts</span>
            </div>
            <div className="num" style={{ fontSize: 20, fontWeight: 600 }}>{fmtBase(totalsRWF.bank, profile.displayCurrency, { compact: true })}</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{banks.length} account{banks.length === 1 ? '' : 's'}</div>
          </div>
          <div style={{ padding: 14, background:'var(--bg-2)', borderRadius: 10 }}>
            <div className="row" style={{ gap: 8, marginBottom: 4 }}>
              <span style={{ color:'var(--brand)', fontSize: 14 }}>○</span>
              <span className="muted" style={{ fontSize: 11, fontWeight: 600, letterSpacing:'0.06em', textTransform:'uppercase' }}>Mobile money</span>
            </div>
            <div className="num" style={{ fontSize: 20, fontWeight: 600 }}>{fmtBase(totalsRWF.momo, profile.displayCurrency, { compact: true })}</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{momos.length} wallet{momos.length === 1 ? '' : 's'}</div>
          </div>
        </div>
      </div>

      {/* Bank list */}
      <div className="row" style={{ justifyContent:'space-between', marginBottom: 10 }}>
        <div className="font-serif" style={{ fontSize: 20 }}>Bank accounts</div>
        <span className="muted" style={{ fontSize: 11 }}>{banks.length} account{banks.length === 1 ? '' : 's'}</span>
      </div>
      {banks.length > 0 ? (
        <div className="col" style={{ gap: 10, marginBottom: 22 }}>
          {banks.map(a => <AccountCard key={a.id} acc={a} displayCurrency={profile.displayCurrency} onEdit={setEditing} onDelete={handleDelete} />)}
        </div>
      ) : (
        <div className="card" style={{ padding: 28, textAlign:'center', marginBottom: 22 }}>
          <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>No bank accounts yet.</div>
          <button onClick={() => setEditing({ kind: 'savings' })} className="btn btn-ghost">＋ Add bank account</button>
        </div>
      )}

      {/* MoMo list */}
      <div className="row" style={{ justifyContent:'space-between', marginBottom: 10 }}>
        <div className="font-serif" style={{ fontSize: 20 }}>Mobile money</div>
        <span className="muted" style={{ fontSize: 11 }}>{momos.length} wallet{momos.length === 1 ? '' : 's'}</span>
      </div>
      {momos.length > 0 ? (
        <div className="col" style={{ gap: 10 }}>
          {momos.map(a => <AccountCard key={a.id} acc={a} displayCurrency={profile.displayCurrency} onEdit={setEditing} onDelete={handleDelete} />)}
        </div>
      ) : (
        <div className="card" style={{ padding: 28, textAlign:'center' }}>
          <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>No mobile money wallets yet.</div>
          <button onClick={() => setEditing({ kind: 'momo-cash' })} className="btn btn-ghost">＋ Add MoMo wallet</button>
        </div>
      )}

      <div className="muted" style={{ fontSize: 11, marginTop: 28, padding: 14, background:'var(--bg-2)', borderRadius: 10, lineHeight: 1.55 }}>
        Account balances flow into your overall net worth on the Dashboard. To track richer details (yield, statement history, etc.), edit the account on the <strong>Assets</strong> page.
      </div>

      {editing && <AccountEditor account={editing} onSave={handleSave} onCancel={() => setEditing(null)} />}
    </div>
  );
}
