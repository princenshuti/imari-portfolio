import { useState, useMemo } from 'react';
import { CLASSES, CURRENCIES, suggestValue, fmt, id } from '../data.js';
import { Field, Input, inputStyle } from './Field.jsx';
import AssetIcon from './AssetIcon.jsx';

export default function AssetEditor({ asset, onSave, onCancel }) {
  const isNew = !asset.id;
  const [a, setA] = useState({
    id: asset.id || id(),
    kind: asset.kind || 'realestate-land',
    name: asset.name || '',
    currency: asset.currency || 'RWF',
    purchasePrice: asset.purchasePrice ?? '',
    purchaseDate: asset.purchaseDate || new Date().toISOString().slice(0, 10),
    currentValue: asset.currentValue ?? '',
    notes: asset.notes || '',
    neighbourhood: asset.neighbourhood || '',
    upi: asset.upi || '',
    model: asset.model || '',
    chassis: asset.chassis || '',
    count: asset.count ?? '',
    ticker: asset.ticker || '',
    shares: asset.shares ?? '',
    units: asset.units ?? '',
    lastPrice: asset.lastPrice ?? '',
    yieldPct: asset.yieldPct ?? '',
    maturity: asset.maturity || '',
    bank: asset.bank || '',
    wallet: asset.wallet || '',
    grams: asset.grams ?? '',
    stakePct: asset.stakePct ?? '',
    debtor: asset.debtor || '',
    dueDate: asset.dueDate || '',
  });
  const cls = CLASSES.find(c => c.kind === a.kind);

  const suggested = useMemo(() => {
    if (!a.purchasePrice || !a.purchaseDate) return null;
    return suggestValue({ ...a, purchasePrice: +a.purchasePrice });
  }, [a.kind, a.purchasePrice, a.purchaseDate, a.shares, a.units, a.lastPrice, a.yieldPct]);

  const update = (k, v) => setA(s => ({ ...s, [k]: v }));
  const handleSave = () => {
    const cleaned = { ...a, purchasePrice: +a.purchasePrice || 0 };
    ['count','shares','units','lastPrice','yieldPct','grams','stakePct'].forEach(k => {
      if (cleaned[k] === '' || cleaned[k] == null) delete cleaned[k];
      else cleaned[k] = +cleaned[k];
    });
    if (cleaned.currentValue === '' || cleaned.currentValue == null) cleaned.currentValue = '';
    else cleaned.currentValue = +cleaned.currentValue;
    onSave(cleaned);
  };

  return (
    <div onClick={onCancel} style={{
      position:'fixed', inset: 0, background:'rgba(20,20,16,0.55)', backdropFilter:'blur(4px)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex: 2147483640, padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} className="card" style={{
        width: '100%', maxWidth: 720, maxHeight: '90vh', overflow:'auto',
        padding: 28, background:'var(--paper)', boxShadow:'var(--shadow-pop)',
      }}>
        <div className="row" style={{ justifyContent:'space-between', alignItems:'flex-start', marginBottom: 18 }}>
          <div>
            <div className="muted" style={{ fontSize: 11, letterSpacing:'0.08em', textTransform:'uppercase' }}>{isNew ? 'Add asset' : 'Edit asset'}</div>
            <div className="font-serif" style={{ fontSize: 26, marginTop: 2 }}>{a.name || 'Untitled asset'}</div>
          </div>
          <button onClick={onCancel} style={{
            width: 30, height: 30, borderRadius: 8, background:'var(--bg-2)', border: 0, fontSize: 16, cursor:'pointer', color:'var(--ink-3)',
          }}>×</button>
        </div>

        <Field label="Asset class">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 6 }}>
            {CLASSES.map(c => (
              <div key={c.kind} onClick={() => update('kind', c.kind)} style={{
                padding: '10px 12px', borderRadius: 9, cursor:'pointer',
                background: c.kind === a.kind ? 'var(--brand-soft)' : 'var(--bg-2)',
                color: c.kind === a.kind ? 'var(--brand)' : 'var(--ink-2)',
                border: c.kind === a.kind ? '1px solid var(--brand)' : '1px solid transparent',
                fontSize: 12, fontWeight: 500, display:'flex', alignItems:'center', gap: 8,
              }}>
                <AssetIcon kind={c.kind} color={c.kind === a.kind ? 'var(--brand)' : c.color} size={22} />
                <span>{c.label}</span>
              </div>
            ))}
          </div>
        </Field>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 14 }}>
          <Field label="Name">
            <Input value={a.name} onChange={v => update('name', v)} placeholder="e.g. Plot in Kabuga" />
          </Field>
          <Field label="Currency">
            <select value={a.currency} onChange={e => update('currency', e.target.value)} style={inputStyle}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.label}</option>)}
            </select>
          </Field>

          <Field label="Purchase price" hint={`in ${a.currency}`}>
            <Input value={a.purchasePrice} onChange={v => update('purchasePrice', v)} type="number" placeholder="0" />
          </Field>
          <Field label="Purchase date">
            <Input value={a.purchaseDate} onChange={v => update('purchaseDate', v)} type="date" />
          </Field>

          {cls.fields.includes('neighbourhood') && <Field label="Neighbourhood"><Input value={a.neighbourhood} onChange={v=>update('neighbourhood',v)} placeholder="e.g. Kabuga" /></Field>}
          {cls.fields.includes('upi')           && <Field label="UPI" hint="Unique Parcel Identifier — from your title deed"><Input value={a.upi} onChange={v=>update('upi',v)} placeholder="e.g. 1/01/01/01/0001" /></Field>}
          {cls.fields.includes('model')         && <Field label="Model"><Input value={a.model} onChange={v=>update('model',v)} placeholder="e.g. Toyota Rav4 2018" /></Field>}
          {cls.fields.includes('chassis')       && <Field label="Chassis / VIN" hint="From the vehicle logbook"><Input value={a.chassis} onChange={v=>update('chassis',v)} placeholder="e.g. JTMBD33V585012345" /></Field>}
          {cls.fields.includes('count')         && <Field label="Count (head)"><Input value={a.count} onChange={v=>update('count',v)} type="number" /></Field>}
          {cls.fields.includes('ticker')        && <Field label="Ticker"><Input value={a.ticker} onChange={v=>update('ticker',v)} placeholder="e.g. BOK" /></Field>}
          {cls.fields.includes('shares')        && <Field label="Shares / units"><Input value={a.shares} onChange={v=>update('shares',v)} type="number" /></Field>}
          {cls.fields.includes('units')         && <Field label="Units"><Input value={a.units} onChange={v=>update('units',v)} type="number" /></Field>}
          {cls.fields.includes('lastPrice')     && <Field label="Last price / unit" hint={`in ${a.currency}`}><Input value={a.lastPrice} onChange={v=>update('lastPrice',v)} type="number" /></Field>}
          {cls.fields.includes('yieldPct')      && <Field label="Yield (%/yr)"><Input value={a.yieldPct} onChange={v=>update('yieldPct',v)} type="number" placeholder="e.g. 12.5" /></Field>}
          {cls.fields.includes('maturity')      && <Field label="Maturity date"><Input value={a.maturity} onChange={v=>update('maturity',v)} type="date" /></Field>}
          {cls.fields.includes('bank')          && <Field label="Bank"><Input value={a.bank} onChange={v=>update('bank',v)} /></Field>}
          {cls.fields.includes('wallet')        && <Field label="Wallet"><Input value={a.wallet} onChange={v=>update('wallet',v)} placeholder="MTN MoMo / Airtel / Cash" /></Field>}
          {cls.fields.includes('grams')         && <Field label="Weight (grams)"><Input value={a.grams} onChange={v=>update('grams',v)} type="number" /></Field>}
          {cls.fields.includes('stakePct')      && <Field label="Your stake (%)"><Input value={a.stakePct} onChange={v=>update('stakePct',v)} type="number" /></Field>}
          {cls.fields.includes('debtor')        && <Field label="Debtor"><Input value={a.debtor} onChange={v=>update('debtor',v)} /></Field>}
          {cls.fields.includes('dueDate')       && <Field label="Due date"><Input value={a.dueDate} onChange={v=>update('dueDate',v)} type="date" /></Field>}
        </div>

        {suggested != null && (
          <div style={{
            margin: '20px 0 0', padding: 16, borderRadius: 12,
            background:'var(--brand-soft)', border: '1px solid var(--brand)',
          }}>
            <div className="row" style={{ justifyContent:'space-between', alignItems:'flex-start', gap: 12 }}>
              <div className="col" style={{ gap: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color:'var(--brand)', letterSpacing:'0.06em', textTransform:'uppercase' }}>
                  ✦ Imari suggests
                </div>
                <div className="font-serif" style={{ fontSize: 24, color:'var(--brand)' }}>
                  {fmt(suggested, a.currency)}
                </div>
                <div className="muted" style={{ fontSize: 11, lineHeight: 1.4, maxWidth: 360 }}>{cls.note}</div>
              </div>
              <button type="button" onClick={() => update('currentValue', String(suggested))} style={{
                padding: '8px 14px', borderRadius: 8, background:'var(--brand)', color:'var(--brand-ink)',
                border: 0, fontSize: 12, fontWeight: 500, cursor:'pointer', whiteSpace:'nowrap',
              }}>Use suggestion</button>
            </div>
          </div>
        )}

        <Field label="Today's value (your number)" hint={`in ${a.currency} · leave blank to use suggestion`} top={16}>
          <Input value={a.currentValue} onChange={v => update('currentValue', v)} type="number" placeholder="Leave blank for suggestion" />
        </Field>

        <Field label="Notes" top={4}>
          <textarea value={a.notes} onChange={e => update('notes', e.target.value)} placeholder="optional"
            style={{ ...inputStyle, minHeight: 60, paddingTop: 8, fontFamily:'inherit', resize:'vertical' }} />
        </Field>

        <div className="row" style={{ gap: 10, marginTop: 22, justifyContent:'flex-end' }}>
          <button onClick={onCancel} className="btn btn-ghost">Cancel</button>
          <button onClick={handleSave} className="btn btn-primary" disabled={!a.name || !a.purchasePrice}>
            {isNew ? 'Add asset' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
