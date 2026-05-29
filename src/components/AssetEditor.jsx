import { useState, useMemo, useRef } from 'react';
import {
  CLASSES, CURRENCIES, COUNTRIES,
  RWANDA_PROVINCES, RWANDA_DISTRICTS,
  VEHICLE_CATEGORIES, PROPERTY_CATEGORIES,
  suggestValue, fmt, id,
} from '../data.js';
import { Field, Input, inputStyle } from './Field.jsx';
import AssetIcon from './AssetIcon.jsx';
import Modal from './Modal.jsx';

// ─── Image compression ──────────────────────────────────────
async function compressImage(file, maxPx = 800, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = e => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve({ name: file.name, dataUrl: canvas.toDataURL('image/jpeg', quality) });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ─── Document reader ────────────────────────────────────────
function readDoc(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = e => resolve({
      name: file.name, type: file.type,
      size: file.size, dataUrl: e.target.result,
    });
    reader.readAsDataURL(file);
  });
}

// ─── Collapsible accordion ──────────────────────────────────
function Accordion({ icon, label, badge, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginTop: 16, borderRadius: 12, border: '0.5px solid var(--line)', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: 'var(--bg-2)', border: 0, cursor: 'pointer',
          color: 'var(--ink)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ color: 'var(--brand)', fontSize: 15, lineHeight: 1 }}>{icon}</span>
          {label}
          {badge && (
            <span style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 20,
              background: 'var(--brand-soft)', color: 'var(--brand)', fontWeight: 700,
            }}>{badge}</span>
          )}
        </span>
        <span style={{
          fontSize: 10, color: 'var(--ink-4)',
          display: 'inline-block',
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s cubic-bezier(0.23,1,0.32,1)',
        }}>▼</span>
      </button>
      <div style={{
        maxHeight: open ? 1600 : 0, overflow: 'hidden',
        transition: 'max-height 0.28s cubic-bezier(0.23,1,0.32,1)',
      }}>
        <div style={{ padding: '16px 16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Toggle switch ──────────────────────────────────────────
// Native <button role="switch"> — keyboard works for free, focus ring inherits.
function Toggle({ value, onChange, label }) {
  return (
    <label className="row" style={{ gap: 12, alignItems: 'center', cursor: 'pointer' }}>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 24, borderRadius: 12, flexShrink: 0, cursor: 'pointer',
          background: value ? 'var(--brand)' : 'var(--bg-2)',
          border: '1px solid ' + (value ? 'var(--brand)' : 'var(--line-strong)'),
          position: 'relative', transition: 'background 0.18s, border-color 0.18s',
          padding: 0,
        }}
      >
        <span aria-hidden="true" style={{
          position: 'absolute', top: 2, left: value ? 20 : 2,
          width: 18, height: 18, borderRadius: '50%',
          background: value ? 'var(--brand-ink)' : 'var(--ink-4)',
          transition: 'left 0.18s cubic-bezier(0.23,1,0.32,1)',
          display: 'block',
        }} />
      </button>
      <span style={{ fontSize: 13 }}>{label}</span>
    </label>
  );
}

export default function AssetEditor({ asset, onSave, onCancel, showToast }) {
  const isNew = !asset.id;

  const [a, setA] = useState({
    id: asset.id || id(),
    kind:          asset.kind          || 'realestate-land',
    name:          asset.name          || '',
    currency:      asset.currency      || 'RWF',
    purchasePrice: asset.purchasePrice ?? '',
    purchaseDate:  asset.purchaseDate  || new Date().toISOString().slice(0, 10),
    currentValue:  asset.currentValue  ?? '',
    notes:         asset.notes         || '',
    neighbourhood: asset.neighbourhood || '',
    upi:           asset.upi           || '',
    propertyCategory: asset.propertyCategory || '',
    sizeM2:        asset.sizeM2        ?? '',
    model:         asset.model         || '',
    chassis:       asset.chassis       || '',
    count:         asset.count         ?? '',
    ticker:        asset.ticker        || '',
    shares:        asset.shares        ?? '',
    units:         asset.units         ?? '',
    lastPrice:     asset.lastPrice     ?? '',
    yieldPct:      asset.yieldPct      ?? '',
    maturity:      asset.maturity      || '',
    bank:          asset.bank          || '',
    wallet:        asset.wallet        || '',
    grams:         asset.grams         ?? '',
    stakePct:      asset.stakePct      ?? '',
    debtor:          asset.debtor          || '',
    dueDate:         asset.dueDate         || '',
    vehicleCategory: asset.vehicleCategory || 'car',
    // Pension (§5) projection inputs
    monthlyContribution: asset.monthlyContribution ?? '',
    employerMatch:       asset.employerMatch       ?? '',
    currentAge:          asset.currentAge          ?? '',
    annualSalary:        asset.annualSalary         ?? '',
    // UPI / land-title (§7)
    titleDocId:      asset.titleDocId      || '',
    registeredOwner: asset.registeredOwner || '',
    district:        asset.district        || '',
    ownerConfirmed:  asset.ownerConfirmed  || false,
    lastRevaluedAt:  asset.lastRevaluedAt  || '',
    // ── NEW fields ──────────────────────────────────────────
    location: asset.location || {
      country: 'Rwanda', province: '', district: '',
      sector: '', cell: '', village: '',
    },
    incomeGenerates: asset.incomeGenerates || false,
    incomeAmount:    asset.incomeAmount    ?? '',
    incomeFrequency: asset.incomeFrequency || 'monthly',
    incomeCurrency:  asset.incomeCurrency  || (asset.currency || 'RWF'),
    photos:    asset.photos    || [],
    documents: asset.documents || [],
  });

  const cls = CLASSES.find(c => c.kind === a.kind) || CLASSES[CLASSES.length - 1];

  const photoInputRef = useRef();
  const docInputRef   = useRef();
  const [photoLoading, setPhotoLoading] = useState(false);
  const [docLoading,   setDocLoading]   = useState(false);

  // ── Suggested valuation ─────────────────────────────────
  const suggested = useMemo(() => {
    if (!a.purchasePrice || !a.purchaseDate) return null;
    return suggestValue({ ...a, purchasePrice: +a.purchasePrice });
  }, [a.kind, a.purchasePrice, a.purchaseDate, a.shares, a.units, a.lastPrice, a.yieldPct]);

  // ── State helpers ───────────────────────────────────────
  const update    = (k, v) => setA(s => ({ ...s, [k]: v }));
  const updateLoc = (k, v) => setA(s => ({
    ...s,
    location: {
      ...s.location, [k]: v,
      ...(k === 'province' ? { district: '' } : {}),
    },
  }));

  const districts = a.location.country === 'Rwanda' && a.location.province
    ? (RWANDA_DISTRICTS[a.location.province] || [])
    : [];

  // ── Save handler ────────────────────────────────────────
  const handleSave = () => {
    const cleaned = { ...a, purchasePrice: +a.purchasePrice || 0 };
    ['count','shares','units','lastPrice','yieldPct','grams','stakePct'].forEach(k => {
      if (cleaned[k] === '' || cleaned[k] == null) delete cleaned[k];
      else cleaned[k] = +cleaned[k];
    });
    if (cleaned.currentValue === '' || cleaned.currentValue == null) cleaned.currentValue = '';
    else cleaned.currentValue = +cleaned.currentValue;
    if (cleaned.incomeAmount !== '' && !isNaN(+cleaned.incomeAmount)) {
      cleaned.incomeAmount = +cleaned.incomeAmount;
    } else {
      delete cleaned.incomeAmount;
    }
    if (!cleaned.incomeGenerates) {
      delete cleaned.incomeAmount;
      delete cleaned.incomeFrequency;
      delete cleaned.incomeCurrency;
    }
    // Remove empty location to save space
    const loc = cleaned.location;
    if (!loc.province && !loc.district && !loc.sector && !loc.cell && !loc.village) {
      delete cleaned.location;
    }
    onSave(cleaned);
  };

  // ── Photo handlers ──────────────────────────────────────
  const handleAddPhotos = async (files) => {
    const remaining = 3 - a.photos.length;
    if (!remaining || !files.length) return;
    setPhotoLoading(true);
    try {
      const compressed = await Promise.all(
        Array.from(files).slice(0, remaining).map(f => compressImage(f))
      );
      update('photos', [...a.photos, ...compressed]);
    } catch (err) {
      console.error('Photo compression failed:', err);
    } finally {
      setPhotoLoading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  // ── Document handlers ───────────────────────────────────
  const handleAddDocs = async (files) => {
    const remaining = 5 - a.documents.length;
    if (!remaining || !files.length) return;
    setDocLoading(true);
    try {
      const MAX_SIZE = 2 * 1024 * 1024;
      const oversized = Array.from(files).filter(f => f.size > MAX_SIZE);
      if (oversized.length) {
        const msg = `Skipped (over 2 MB): ${oversized.map(f => f.name).join(', ')}`;
        if (showToast) showToast(msg, 'warning');
        else alert(msg); // fallback if hosted without toast context
      }
      const valid = Array.from(files)
        .filter(f => f.size <= MAX_SIZE)
        .slice(0, remaining);
      const docs = await Promise.all(valid.map(readDoc));
      update('documents', [...a.documents, ...docs]);
    } catch (err) {
      console.error('Document read failed:', err);
    } finally {
      setDocLoading(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  const docGlyph = (type) => {
    if (!type) return '◧';
    if (type.startsWith('image/')) return '▣';
    if (type === 'application/pdf') return '§';
    return '◧';
  };

  // ── Render ───────────────────────────────────────────────
  return (
    <Modal open onClose={onCancel} maxWidth={720} title={isNew ? 'Add asset' : 'Edit asset'}>
        {/* Header */}
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div className="muted" style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {isNew ? 'Add asset' : 'Edit asset'}
            </div>
            <h2 className="font-serif" style={{ fontSize: 26, marginTop: 2, margin: 0, fontWeight: 400 }}>{a.name || 'Untitled asset'}</h2>
          </div>
          <button
            type="button" onClick={onCancel} aria-label="Close dialog"
            className="btn-icon-sm"
          ><span aria-hidden="true">×</span></button>
        </div>

        {/* Asset class — radiogroup, keyboard accessible */}
        <Field label="Asset class">
          <div role="radiogroup" aria-label="Asset class" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {CLASSES.map(c => {
              const selected = c.kind === a.kind;
              return (
                <button
                  key={c.kind}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => update('kind', c.kind)}
                  style={{
                    padding: '10px 12px', borderRadius: 9, cursor: 'pointer',
                    background: selected ? 'var(--brand-soft)' : 'var(--bg-2)',
                    color: selected ? 'var(--brand)' : 'var(--ink-2)',
                    border: selected ? '1px solid var(--brand)' : '1px solid transparent',
                    fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8,
                    fontFamily: 'inherit', textAlign: 'left',
                  }}
                >
                  <AssetIcon kind={c.kind} color={selected ? 'var(--brand)' : c.color} size={22} />
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>
        </Field>

        {/* Core fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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

          {cls.fields.includes('neighbourhood') && (
            <Field label="Neighbourhood">
              <Input value={a.neighbourhood} onChange={v => update('neighbourhood', v)} placeholder="e.g. Kabuga" />
            </Field>
          )}
          {cls.fields.includes('upi') && (
            <Field label="UPI" hint="Unique Parcel Identifier — from your title deed">
              <Input value={a.upi} onChange={v => update('upi', v)} placeholder="e.g. 1/01/01/01/0001" />
            </Field>
          )}
          {cls.fields.includes('upi') && (
            <Field label="Registered owner (on title)">
              <Input value={a.registeredOwner} onChange={v => update('registeredOwner', v)} placeholder="Name as on the NLA e-title" />
            </Field>
          )}
          {cls.fields.includes('upi') && (
            <Field label="District">
              <Input value={a.district} onChange={v => update('district', v)} placeholder="e.g. Kicukiro" />
            </Field>
          )}
          {cls.fields.includes('upi') && (
            <Field label="Last revalued" hint="Used to prompt a re-valuation when stale">
              <Input value={a.lastRevaluedAt} onChange={v => update('lastRevaluedAt', v)} type="date" />
            </Field>
          )}
          {cls.fields.includes('upi') && (
            <Field label="Owner verification" hint="Self-check — Imari does no automated NID lookup (privacy)">
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!a.ownerConfirmed} onChange={e => update('ownerConfirmed', e.target.checked)} style={{ accentColor: 'var(--brand)' }} />
                Registered owner matches my NID
              </label>
            </Field>
          )}
          {cls.fields.includes('propertyCategory') && (
            <Field label="Property category">
              <select
                value={a.propertyCategory}
                onChange={e => update('propertyCategory', e.target.value)}
                style={inputStyle}
              >
                <option value="">— Pick a category —</option>
                {PROPERTY_CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </Field>
          )}
          {cls.fields.includes('sizeM2') && (
            <Field label="Size (m²)">
              <Input
                value={a.sizeM2} onChange={v => update('sizeM2', v)}
                type="number" placeholder="e.g. 500"
              />
            </Field>
          )}
          {cls.fields.includes('model') && (
            <Field label="Model">
              <Input value={a.model} onChange={v => update('model', v)} placeholder="e.g. Toyota Rav4 2018" />
            </Field>
          )}
          {cls.fields.includes('chassis') && (
            <Field label="Chassis / VIN" hint="From the vehicle logbook">
              <Input value={a.chassis} onChange={v => update('chassis', v)} placeholder="e.g. JTMBD33V585012345" />
            </Field>
          )}
          {cls.fields.includes('vehicleCategory') && (
            <Field label="Vehicle category" hint="Road levy · Law 013/2025">
              <select value={a.vehicleCategory} onChange={e => update('vehicleCategory', e.target.value)} style={inputStyle}>
                {VEHICLE_CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.label} — RWF {c.levy.toLocaleString()} / yr
                  </option>
                ))}
              </select>
            </Field>
          )}
          {cls.fields.includes('count') && (
            <Field label="Count (head)">
              <Input value={a.count} onChange={v => update('count', v)} type="number" />
            </Field>
          )}
          {cls.fields.includes('ticker') && (
            <Field label="Ticker">
              <Input value={a.ticker} onChange={v => update('ticker', v)} placeholder="e.g. BOK" />
            </Field>
          )}
          {cls.fields.includes('shares') && (
            <Field label="Shares">
              <Input value={a.shares} onChange={v => update('shares', v)} type="number" />
            </Field>
          )}
          {cls.fields.includes('units') && (
            <Field label="Units">
              <Input value={a.units} onChange={v => update('units', v)} type="number" />
            </Field>
          )}
          {cls.fields.includes('lastPrice') && (
            <Field label="Last price / unit" hint={`in ${a.currency}`}>
              <Input value={a.lastPrice} onChange={v => update('lastPrice', v)} type="number" />
            </Field>
          )}
          {cls.fields.includes('yieldPct') && (
            <Field label="Yield (%/yr)">
              <Input value={a.yieldPct} onChange={v => update('yieldPct', v)} type="number" placeholder="e.g. 12.5" />
            </Field>
          )}
          {cls.fields.includes('maturity') && (
            <Field label="Maturity date">
              <Input value={a.maturity} onChange={v => update('maturity', v)} type="date" />
            </Field>
          )}
          {cls.fields.includes('bank') && (
            <Field label="Bank">
              <Input value={a.bank} onChange={v => update('bank', v)} />
            </Field>
          )}
          {cls.fields.includes('wallet') && (
            <Field label="Wallet">
              <Input value={a.wallet} onChange={v => update('wallet', v)} placeholder="MTN MoMo / Airtel / Cash" />
            </Field>
          )}
          {cls.fields.includes('grams') && (
            <Field label="Weight (grams)">
              <Input value={a.grams} onChange={v => update('grams', v)} type="number" />
            </Field>
          )}
          {cls.fields.includes('stakePct') && (
            <Field label="Your stake (%)">
              <Input value={a.stakePct} onChange={v => update('stakePct', v)} type="number" />
            </Field>
          )}
          {cls.fields.includes('debtor') && (
            <Field label="Debtor">
              <Input value={a.debtor} onChange={v => update('debtor', v)} />
            </Field>
          )}
          {cls.fields.includes('dueDate') && (
            <Field label="Due date">
              <Input value={a.dueDate} onChange={v => update('dueDate', v)} type="date" />
            </Field>
          )}
          {cls.fields.includes('monthlyContribution') && (
            <Field label="Monthly contribution">
              <Input value={a.monthlyContribution} onChange={v => update('monthlyContribution', v)} type="number" placeholder="e.g. 50000" />
            </Field>
          )}
          {cls.fields.includes('employerMatch') && (
            <Field label="Employer match / month">
              <Input value={a.employerMatch} onChange={v => update('employerMatch', v)} type="number" placeholder="e.g. 50000" />
            </Field>
          )}
          {cls.fields.includes('currentAge') && (
            <Field label="Your current age">
              <Input value={a.currentAge} onChange={v => update('currentAge', v)} type="number" placeholder="e.g. 35" />
            </Field>
          )}
          {cls.fields.includes('annualSalary') && (
            <Field label="Annual salary (for replacement %)">
              <Input value={a.annualSalary} onChange={v => update('annualSalary', v)} type="number" placeholder="e.g. 6000000" />
            </Field>
          )}
        </div>

        {/* Suggested valuation banner */}
        {suggested != null && (
          <div style={{
            margin: '20px 0 0', padding: 16, borderRadius: 12,
            background: 'var(--brand-soft)', border: '1px solid var(--brand)',
          }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div className="col" style={{ gap: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--brand)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  ✦ Imari suggests
                </div>
                <div className="font-serif" style={{ fontSize: 24, color: 'var(--brand)' }}>
                  {fmt(suggested, a.currency)}
                </div>
                <div className="muted" style={{ fontSize: 11, lineHeight: 1.4, maxWidth: 360 }}>{cls.note}</div>
              </div>
              <button type="button" onClick={() => update('currentValue', String(suggested))} style={{
                padding: '8px 14px', borderRadius: 8, background: 'var(--brand)', color: 'var(--brand-ink)',
                border: 0, fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>Use suggestion</button>
            </div>
          </div>
        )}

        <Field label="Today's value (your number)" hint={`in ${a.currency} · leave blank to use suggestion`} top={16}>
          <Input value={a.currentValue} onChange={v => update('currentValue', v)} type="number" placeholder="Leave blank for suggestion" />
        </Field>

        <Field label="Notes" top={4}>
          <textarea value={a.notes} onChange={e => update('notes', e.target.value)} placeholder="optional"
            style={{ ...inputStyle, minHeight: 60, paddingTop: 8, fontFamily: 'inherit', resize: 'vertical' }} />
        </Field>

        {/* ═══ LOCATION ═════════════════════════════════════════════ */}
        <Accordion
          icon="◎"
          label="Location"
          defaultOpen={!!(a.location?.province || a.location?.district)}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Country *">
              <select value={a.location.country} onChange={e => updateLoc('country', e.target.value)} style={inputStyle}>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>

            {a.location.country === 'Rwanda' ? (
              <Field label="Province *">
                <select value={a.location.province} onChange={e => updateLoc('province', e.target.value)} style={inputStyle}>
                  <option value="">— Select province</option>
                  {RWANDA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
            ) : (
              <Field label="Province / State *">
                <Input value={a.location.province} onChange={v => updateLoc('province', v)} placeholder="Province or state" />
              </Field>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {a.location.country === 'Rwanda' ? (
              <Field label="District *">
                <select
                  value={a.location.district}
                  onChange={e => updateLoc('district', e.target.value)}
                  style={{ ...inputStyle, opacity: districts.length ? 1 : 0.5 }}
                  disabled={!districts.length}
                >
                  <option value="">— Select district</option>
                  {districts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
            ) : (
              <Field label="District / City *">
                <Input value={a.location.district} onChange={v => updateLoc('district', v)} placeholder="District or city" />
              </Field>
            )}
            <Field label="Sector" hint="optional">
              <Input value={a.location.sector} onChange={v => updateLoc('sector', v)} placeholder="e.g. Remera" />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Cell" hint="optional">
              <Input value={a.location.cell} onChange={v => updateLoc('cell', v)} placeholder="e.g. Nyabisindu" />
            </Field>
            <Field label="Village" hint="optional">
              <Input value={a.location.village} onChange={v => updateLoc('village', v)} placeholder="e.g. Inganzo" />
            </Field>
          </div>

          <div style={{
            fontSize: 11, color: 'var(--ink-4)', lineHeight: 1.55,
            padding: '8px 12px', background: 'var(--bg)', borderRadius: 8,
          }}>
            * Country, Province and District are required when providing location details.
          </div>
        </Accordion>

        {/* ═══ INCOME ═══════════════════════════════════════════════ */}
        <Accordion
          icon="◈"
          label="Income generation"
          badge={a.incomeGenerates && a.incomeAmount ? `${a.incomeFrequency === 'monthly' ? '/mo' : '/yr'}` : null}
          defaultOpen={a.incomeGenerates}
        >
          <Toggle
            value={a.incomeGenerates}
            onChange={v => update('incomeGenerates', v)}
            label="This asset generates income"
          />

          {a.incomeGenerates ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <Field label="Amount">
                <Input value={a.incomeAmount} onChange={v => update('incomeAmount', v)} type="number" placeholder="0" />
              </Field>
              <Field label="Frequency">
                <select value={a.incomeFrequency} onChange={e => update('incomeFrequency', e.target.value)} style={inputStyle}>
                  <option value="monthly">Per month</option>
                  <option value="annually">Per year</option>
                </select>
              </Field>
              <Field label="Currency">
                <select value={a.incomeCurrency} onChange={e => update('incomeCurrency', e.target.value)} style={inputStyle}>
                  {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                </select>
              </Field>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.55, padding: '6px 0' }}>
              Toggle on if this asset earns rental income, interest, dividends, or other periodic returns.
              Income data is used to calculate your passive income ratio on the dashboard.
            </div>
          )}
        </Accordion>

        {/* ═══ PHOTOS ════════════════════════════════════════════════ */}
        <Accordion
          icon="▣"
          label="Photos"
          badge={a.photos.length > 0 ? `${a.photos.length} / 3` : null}
          defaultOpen={a.photos.length > 0}
        >
          {a.photos.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {a.photos.map((p, i) => (
                <div key={i} style={{
                  position: 'relative', borderRadius: 9, overflow: 'hidden',
                  aspectRatio: '4/3', background: 'var(--bg-2)',
                }}>
                  <img src={p.dataUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <button
                    type="button"
                    onClick={() => update('photos', a.photos.filter((_, j) => j !== i))}
                    style={{
                      position: 'absolute', top: 5, right: 5,
                      width: 22, height: 22, borderRadius: 6, border: 0,
                      background: 'rgba(0,0,0,0.62)', color: '#fff',
                      fontSize: 13, cursor: 'pointer', lineHeight: 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    aria-label="Remove photo"
                  >×</button>
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    padding: '4px 8px', background: 'rgba(0,0,0,0.48)',
                    fontSize: 10, color: '#fff',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{p.name}</div>
                </div>
              ))}
            </div>
          )}

          {a.photos.length < 3 ? (
            <>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={e => handleAddPhotos(e.target.files)}
              />
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={photoLoading}
                style={{
                  width: '100%', padding: 14, borderRadius: 10,
                  border: '1.5px dashed var(--line-strong)',
                  background: 'transparent', cursor: photoLoading ? 'default' : 'pointer',
                  color: 'var(--ink-3)', fontSize: 13, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'border-color 0.15s, background 0.15s',
                  opacity: photoLoading ? 0.6 : 1,
                }}
                onMouseEnter={e => { if (!photoLoading) e.currentTarget.style.background = 'var(--bg-2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                {photoLoading
                  ? '◌ Compressing…'
                  : `▣ Upload photo${3 - a.photos.length > 1 ? 's' : ''} · ${3 - a.photos.length} slot${3 - a.photos.length > 1 ? 's' : ''} remaining · auto-compressed`}
              </button>
            </>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--ink-4)', textAlign: 'center', padding: '4px 0' }}>
              Maximum 3 photos reached.
            </div>
          )}
        </Accordion>

        {/* ═══ DOCUMENTS ════════════════════════════════════════════ */}
        <Accordion
          icon="◧"
          label="Supporting documents"
          badge={a.documents.length > 0 ? `${a.documents.length} / 5` : null}
          defaultOpen={a.documents.length > 0}
        >
          {a.documents.length > 0 && (
            <div className="col" style={{ gap: 8 }}>
              {a.documents.map((d, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  padding: '10px 14px', borderRadius: 9, background: 'var(--bg-2)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 16, flexShrink: 0, color: 'var(--brand)' }}>{docGlyph(d.type)}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 600,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{d.name}</div>
                      <div className="muted" style={{ fontSize: 10, marginTop: 1 }}>
                        {(d.size / 1024).toFixed(0)} KB
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => update('documents', a.documents.filter((_, j) => j !== i))}
                    style={{
                      width: 26, height: 26, borderRadius: 6, border: 0,
                      background: 'transparent', color: 'var(--down)',
                      cursor: 'pointer', fontSize: 15, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    aria-label="Remove document"
                  >×</button>
                </div>
              ))}
            </div>
          )}

          {a.documents.length < 5 ? (
            <>
              <input
                ref={docInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.heic,.webp"
                multiple
                style={{ display: 'none' }}
                onChange={e => handleAddDocs(e.target.files)}
              />
              <button
                type="button"
                onClick={() => docInputRef.current?.click()}
                disabled={docLoading}
                style={{
                  width: '100%', padding: 14, borderRadius: 10,
                  border: '1.5px dashed var(--line-strong)',
                  background: 'transparent', cursor: docLoading ? 'default' : 'pointer',
                  color: 'var(--ink-3)', fontSize: 13, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'border-color 0.15s, background 0.15s',
                  opacity: docLoading ? 0.6 : 1,
                }}
                onMouseEnter={e => { if (!docLoading) e.currentTarget.style.background = 'var(--bg-2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                {docLoading
                  ? '◌ Reading…'
                  : `◧ Attach document${5 - a.documents.length > 1 ? 's' : ''} · ${5 - a.documents.length} slot${5 - a.documents.length > 1 ? 's' : ''} remaining · max 2 MB each`}
              </button>
            </>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--ink-4)', textAlign: 'center', padding: '4px 0' }}>
              Maximum 5 documents reached.
            </div>
          )}
          <div style={{
            fontSize: 11, color: 'var(--ink-4)', lineHeight: 1.55,
            padding: '8px 12px', background: 'var(--bg)', borderRadius: 8,
          }}>
            Accepted: PDF, Word, Excel, images (JPEG, PNG, HEIC). Documents are stored locally in your browser.
          </div>
        </Accordion>

        {/* Action row */}
        <div className="row" style={{ gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} className="btn btn-ghost">Cancel</button>
          <button
            type="button"
            onClick={handleSave}
            className="btn btn-primary"
            disabled={!a.name || !a.purchasePrice}
            aria-describedby={(!a.name || !a.purchasePrice) ? 'asset-save-hint' : undefined}
          >
            {isNew ? 'Add asset' : 'Save changes'}
          </button>
          {(!a.name || !a.purchasePrice) && (
            <span id="asset-save-hint" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
              Fill in name and purchase price to enable saving
            </span>
          )}
        </div>
    </Modal>
  );
}
