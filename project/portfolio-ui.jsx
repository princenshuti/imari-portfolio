// portfolio-ui.jsx — Shared primitives + sidebar + asset row + asset editor modal.

(function(){
const { useState, useEffect, useMemo, useRef } = React;
const {
  CURRENCIES, CLASSES, FX, suggestValue, valueRWF, costRWF,
  fmt, fmtBase, toBase, fromBase, id,
} = window;

// ─── Sparkline / Area shared via window from ui.jsx (showcase) ──
// We re-declare locally so portal works standalone too.
function Sparkline({ data, w = 80, h = 26, stroke = 'currentColor', fill = false }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - ((v - min) / range) * (h - 4) - 2,
  ]);
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = path + ` L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display:'block' }}>
      {fill && <path d={area} fill={stroke} opacity={0.12} />}
      <path d={path} stroke={stroke} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AreaChart({ data, w = 320, h = 120, stroke = 'currentColor', accent = 'currentColor', showGuides = true }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data) * 0.97, max = Math.max(...data) * 1.02;
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - ((v - min) / range) * (h - 12) - 6,
  ]);
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = path + ` L${w},${h} L0,${h} Z`;
  const lastY = pts[pts.length - 1][1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display:'block' }}>
      {showGuides && [0, 0.25, 0.5, 0.75, 1].map((p, i) => (
        <line key={i} x1="0" x2={w} y1={p * h} y2={p * h} stroke="var(--line-soft)" strokeDasharray={i === 0 || i === 4 ? '' : '2 3'} />
      ))}
      <path d={area} fill={accent} fillOpacity={0.12} />
      <path d={path} stroke={stroke} strokeWidth="1.75" fill="none" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={lastY} r="3" fill={stroke} />
      <circle cx={pts[pts.length - 1][0]} cy={lastY} r="7" fill={stroke} fillOpacity="0.15" />
    </svg>
  );
}

function Donut({ slices, size = 120, thickness = 14, gap = 1.5 }) {
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform:'rotate(-90deg)' }}>
      {slices.map((s, i) => {
        const len = (s.value / total) * C;
        const seg = Math.max(len - gap, 0);
        const el = <circle key={i} cx={size/2} cy={size/2} r={r}
            stroke={s.color} strokeWidth={thickness} fill="none"
            strokeDasharray={`${seg} ${C - seg}`} strokeDashoffset={-offset} strokeLinecap="butt" />;
        offset += len;
        return el;
      })}
    </svg>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────
function Sidebar({ active, onNav, profile, netWorth, displayCurrency }) {
  const items = [
    { id:'dashboard', label:'Dashboard', glyph:'◐' },
    { id:'assets',    label:'Assets',    glyph:'◆' },
    { id:'trends',    label:'Trends',    glyph:'↗' },
    { id:'advisor',   label:'AI Advisor',glyph:'✦' },
    { id:'settings',  label:'Settings',  glyph:'⚙' },
  ];
  return (
    <div className="col" style={{
      width: 240, padding: '22px 16px', background:'var(--paper)',
      borderRight: '0.5px solid var(--line)', gap: 20, flexShrink: 0, height: '100vh', position:'sticky', top: 0,
    }}>
      <div className="row" style={{ gap: 10, padding: '0 6px' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background:'var(--brand)', color:'var(--brand-ink)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontFamily:'Instrument Serif, serif', fontSize: 20,
        }}>●</div>
        <div>
          <div className="font-serif" style={{ fontSize: 19, lineHeight: 1 }}>Imari</div>
          <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>Personal Portfolio</div>
        </div>
      </div>

      <div className="col" style={{ padding: 14, borderRadius: 12, background:'var(--bg-2)', gap: 4 }}>
        <div className="muted" style={{ fontSize: 10, letterSpacing:'0.06em', textTransform:'uppercase', fontWeight: 600 }}>Net worth</div>
        <div className="font-serif" style={{ fontSize: 26, letterSpacing:'-0.02em', lineHeight: 1.1 }}>
          {fmtBase(netWorth, displayCurrency, { compact: true })}
        </div>
        <div className="muted" style={{ fontSize: 11 }}>{displayCurrency} · {profile.name || 'You'}</div>
      </div>

      <div className="col" style={{ gap: 1 }}>
        {items.map(it => (
          <div key={it.id} onClick={() => onNav(it.id)} style={{
            display:'flex', alignItems:'center', gap: 12, padding: '9px 11px', borderRadius: 9,
            background: it.id === active ? 'var(--brand-soft)' : 'transparent',
            color: it.id === active ? 'var(--brand)' : 'var(--ink-2)',
            fontSize: 13.5, fontWeight: it.id === active ? 600 : 500, cursor:'pointer',
            transition: 'background .12s',
          }}>
            <span style={{ width: 16, textAlign:'center', fontSize: 15 }}>{it.glyph}</span>
            <span>{it.label}</span>
          </div>
        ))}
      </div>

      <div className="col" style={{ marginTop:'auto', gap: 6, padding: 12, borderRadius: 10, background:'var(--bg-2)', fontSize: 11, color:'var(--ink-3)', lineHeight: 1.5 }}>
        <div className="row" style={{ gap: 6 }}>
          <span style={{ width:6, height:6, borderRadius:999, background:'var(--up)' }}/>
          <span>Saved locally · this browser</span>
        </div>
        <div className="muted" style={{ fontSize: 10 }}>Use Settings to back up to JSON</div>
      </div>
    </div>
  );
}

// ─── Topbar ──────────────────────────────────────────────────
function TopBar({ title, subtitle, profile, displayCurrency, onCurrency, right }) {
  return (
    <div className="row" style={{
      padding: '18px 28px', justifyContent:'space-between', alignItems:'center',
      borderBottom: '0.5px solid var(--line)', background:'var(--paper)',
    }}>
      <div>
        {subtitle && <div className="muted" style={{ fontSize: 11, letterSpacing:'0.06em', textTransform:'uppercase' }}>{subtitle}</div>}
        <div className="font-serif" style={{ fontSize: 26, lineHeight: 1.1, marginTop: 2 }}>{title}</div>
      </div>
      <div className="row" style={{ gap: 10 }}>
        {right}
        <select value={displayCurrency} onChange={e => onCurrency(e.target.value)} style={{
          padding: '7px 10px', borderRadius: 8, border:'1px solid var(--line)', background:'var(--paper)',
          fontSize: 12, fontFamily:'inherit', color:'var(--ink)',
        }}>
          {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
        </select>
        <div style={{
          width: 36, height: 36, borderRadius: 999, background:'var(--brand)', color:'var(--brand-ink)',
          display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Instrument Serif, serif', fontSize: 16,
        }}>{(profile.name || 'You').split(' ').slice(0,2).map(s => s[0] || '').join('').toUpperCase().slice(0,2)}</div>
      </div>
    </div>
  );
}

// ─── Asset row ───────────────────────────────────────────────
function AssetRow({ asset, displayCurrency, onEdit, onDelete }) {
  const cls = CLASSES.find(c => c.kind === asset.kind) || CLASSES[CLASSES.length - 1];
  const suggested = suggestValue(asset);
  const current = asset.currentValue !== '' && asset.currentValue != null ? asset.currentValue : suggested;
  const cost = asset.purchasePrice || 0;
  const gain = current - cost;
  const gainPct = cost ? (gain / cost * 100) : 0;
  const yrs = window.yearsBetween(asset.purchaseDate, new Date());

  return (
    <div style={{ display:'grid', gridTemplateColumns:'2.3fr 1fr 1.2fr 1.2fr 0.9fr 60px', alignItems:'center', padding: '14px 22px', gap: 12 }}>
      {/* Name + class */}
      <div className="row" style={{ gap: 12, minWidth: 0 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background:`color-mix(in oklab, ${cls.color} 18%, transparent)`,
          color: cls.color, display:'flex', alignItems:'center', justifyContent:'center',
          fontSize: 18, fontWeight: 600, flexShrink: 0,
        }}>{cls.glyph}</div>
        <div className="col" style={{ minWidth: 0, gap: 2 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{asset.name}</div>
          <div className="muted" style={{ fontSize: 11 }}>
            {cls.label}
            {asset.ticker && ` · ${asset.ticker}`}
            {asset.shares != null && ` · ${asset.shares.toLocaleString()} sh`}
            {asset.units != null && ` · ${asset.units} units`}
            {asset.count != null && ` · ${asset.count} head`}
            {asset.neighbourhood && ` · ${asset.neighbourhood}`}
          </div>
        </div>
      </div>

      {/* Bought */}
      <div className="col" style={{ gap: 2 }}>
        <div className="num" style={{ fontSize: 12 }}>
          {fmt(cost, asset.currency, { compact: true })}
        </div>
        <div className="muted" style={{ fontSize: 10 }}>{new Date(asset.purchaseDate).toLocaleDateString('en-GB', { month:'short', year:'numeric' })} · {yrs.toFixed(1)}y ago</div>
      </div>

      {/* Today's value */}
      <div className="col" style={{ gap: 2 }}>
        <div className="num" style={{ fontSize: 13, fontWeight: 500 }}>
          {fmt(current, asset.currency, { compact: true })}
        </div>
        <div className="muted" style={{ fontSize: 10 }}>{asset.currency} · {asset.currentValue ? 'your value' : 'suggested'}</div>
      </div>

      {/* RWF base */}
      <div className="num" style={{ fontSize: 12.5, color:'var(--ink-2)' }}>
        {fmtBase(toBase(current, asset.currency), displayCurrency, { compact: true })}
      </div>

      {/* Gain/loss */}
      <div className="col" style={{ alignItems:'flex-end', gap: 2 }}>
        <div className="num" style={{ fontSize: 12, fontWeight: 600, color: gain >= 0 ? 'var(--up)' : 'var(--down)' }}>
          {gain >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
        </div>
        <div className="num" style={{ fontSize: 10, color: gain >= 0 ? 'var(--up)' : 'var(--down)' }}>
          {gain >= 0 ? '+' : ''}{fmt(gain, asset.currency, { compact: true })}
        </div>
      </div>

      {/* Actions */}
      <div className="row" style={{ gap: 4, justifyContent:'flex-end' }}>
        <button onClick={() => onEdit(asset)} title="Edit" style={iconBtnStyle}>✎</button>
        <button onClick={() => onDelete(asset)} title="Delete" style={{ ...iconBtnStyle, color:'var(--down)' }}>×</button>
      </div>
    </div>
  );
}

const iconBtnStyle = {
  width: 26, height: 26, borderRadius: 6, border: 0, background: 'transparent',
  color: 'var(--ink-3)', cursor: 'pointer', fontSize: 14, padding: 0,
};

// ─── Asset editor modal ──────────────────────────────────────
function AssetEditor({ asset, onSave, onCancel }) {
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
    // class-specific fields
    neighbourhood: asset.neighbourhood || '',
    model: asset.model || '',
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

  // Auto-suggest current value whenever inputs change
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

        {/* Class picker */}
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
                <span style={{ color: c.color, fontSize: 14 }}>{c.glyph}</span>
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

          {/* Class-specific fields */}
          {cls.fields.includes('neighbourhood') && <Field label="Neighbourhood"><Input value={a.neighbourhood} onChange={v=>update('neighbourhood',v)} placeholder="e.g. Kabuga" /></Field>}
          {cls.fields.includes('model')         && <Field label="Model"><Input value={a.model} onChange={v=>update('model',v)} placeholder="e.g. Toyota Rav4 2018" /></Field>}
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

        {/* Valuation suggestion */}
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

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--line)', background: 'var(--paper-2)', color: 'var(--ink)',
  fontFamily: 'inherit', fontSize: 13, outline:'none',
};

function Input({ value, onChange, type = 'text', placeholder }) {
  return <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />;
}

function Field({ label, hint, children, top = 14 }) {
  return (
    <div style={{ marginTop: top }}>
      <div className="row" style={{ justifyContent:'space-between', marginBottom: 5 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color:'var(--ink-2)', letterSpacing:'0.02em' }}>{label}</label>
        {hint && <span className="muted" style={{ fontSize: 10 }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ─── KPI Card (used on dashboard) ────────────────────────────
function KPI({ label, value, sub, accent = 'var(--brand)' }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="muted" style={{ fontSize: 11, letterSpacing:'0.06em', textTransform:'uppercase', fontWeight: 600 }}>{label}</div>
      <div className="font-serif" style={{ fontSize: 28, marginTop: 4, letterSpacing:'-0.01em', color: accent }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── Trend card ──────────────────────────────────────────────
function TrendCard({ d, big = false }) {
  return (
    <div className="card" style={{ padding: 16, position:'relative' }}>
      <div className="row" style={{ justifyContent:'space-between' }}>
        <div className="muted" style={{ fontSize: 11, fontWeight: 500 }}>{d.label}</div>
        <span className="pill pill-soft" style={{ fontSize: 9 }}>illustrative</span>
      </div>
      <div className="row" style={{ alignItems:'baseline', gap: 8, marginTop: 6 }}>
        <div className="font-serif num" style={{ fontSize: big ? 28 : 22, letterSpacing:'-0.01em' }}>
          {d.unit === '$' ? '$' : ''}{d.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}{d.unit && d.unit !== '$' ? d.unit : ''}
        </div>
        <div className="num" style={{ fontSize: 12, color: d.change >= 0 ? 'var(--up)' : 'var(--down)' }}>
          {d.change >= 0 ? '▲' : '▼'} {Math.abs(d.change).toFixed(2)}{d.unit === '%' ? 'pp' : '%'}
        </div>
      </div>
      <div style={{ marginTop: 6, color: d.color }}>
        <Sparkline data={d.series} w={big ? 240 : 160} h={big ? 38 : 28} stroke={d.color} fill />
      </div>
      <div className="muted" style={{ fontSize: 10, marginTop: 4 }}>{d.source}</div>
    </div>
  );
}

Object.assign(window, { Sidebar, TopBar, AssetRow, AssetEditor, KPI, TrendCard, Sparkline, AreaChart, Donut, Field });
})();
