import { useMemo, useState } from 'react';
import {
  CLASSES, TAX_RULES, FIXED_ASSET_TAX, VEHICLE_CATEGORIES,
  toBase, valueRWF, costRWF, fmtBase, fmt,
} from '../data.js';

// ─── Helpers ──────────────────────────────────────────────────

function Section({ title, sub, children, accent = 'var(--brand)' }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 3, height: 18, borderRadius: 2, background: accent, flexShrink: 0 }} />
        <div>
          <div className="font-serif" style={{ fontSize: 20 }}>{title}</div>
          {sub && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function KpiCard({ label, value, sub, color = 'var(--ink)', highlight }) {
  return (
    <div style={{
      padding: '16px 20px', borderRadius: 12,
      background: highlight ? `color-mix(in oklab, ${color} 8%, var(--paper))` : 'var(--paper)',
      border: highlight ? `1px solid color-mix(in oklab, ${color} 22%, transparent)` : '0.5px solid var(--line)',
      boxShadow: 'var(--shadow-1)',
    }}>
      <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div className="num" style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: '-0.01em' }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 10.5, marginTop: 5, lineHeight: 1.4 }}>{sub}</div>}
    </div>
  );
}

function LawBadge({ law, url }) {
  return (
    <span style={{
      fontSize: 9.5, padding: '2px 8px', borderRadius: 10, display: 'inline-flex', alignItems: 'center',
      background: 'color-mix(in oklab, var(--gold) 12%, var(--bg-2))',
      color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.02em',
    }}>{law}</span>
  );
}

function FormulaBox({ children }) {
  return (
    <div style={{
      padding: '12px 16px', borderRadius: 10,
      background: 'var(--bg-2)', border: '0.5px solid var(--line)',
      fontFamily: 'Geist Mono, monospace', fontSize: 12, color: 'var(--ink-2)',
      lineHeight: 1.7, marginBottom: 16,
    }}>{children}</div>
  );
}

function TaxTable({ columns, rows, footerRow }) {
  return (
    <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--bg-2)' }}>
            {columns.map(c => (
              <th key={c} style={{
                padding: '9px 14px', textAlign: 'left', fontWeight: 600,
                fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
                color: 'var(--ink-3)', whiteSpace: 'nowrap',
              }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: i > 0 ? '0.5px solid var(--line)' : 'none' }}>
              {row.map((cell, j) => (
                <td key={j} style={{
                  padding: '10px 14px',
                  fontFamily: typeof cell === 'object' && cell?.mono ? 'Geist Mono, monospace' : 'inherit',
                  color: typeof cell === 'object' ? (cell.color || 'inherit') : 'inherit',
                  fontWeight: typeof cell === 'object' ? (cell.bold ? 600 : 400) : 400,
                }}>
                  {typeof cell === 'object' ? cell.value : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footerRow && (
          <tfoot>
            <tr style={{ borderTop: '1px solid var(--line-strong)', background: 'var(--bg-2)' }}>
              {footerRow.map((cell, j) => (
                <td key={j} style={{
                  padding: '10px 14px',
                  fontFamily: typeof cell === 'object' && cell?.mono ? 'Geist Mono, monospace' : 'inherit',
                  color: typeof cell === 'object' ? (cell.color || 'inherit') : 'inherit',
                  fontWeight: 700,
                }}>
                  {typeof cell === 'object' ? cell.value : cell}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────

export default function TaxReportView({ state }) {
  const { assets, profile } = state;
  const today = new Date();
  const year  = today.getFullYear();
  const [dueDate, setDueDate] = useState('');

  // ═══ 1. FIXED ASSET TAX (annual, real estate) ════════════════
  const propertyTaxRows = useMemo(() => {
    return assets
      .filter(a => a.kind === 'realestate-land' || a.kind === 'realestate-house')
      .map(a => {
        const isResidential = a.kind === 'realestate-house';
        const marketValueRWF = valueRWF(a, today);
        let taxableBase, annualTax, note;

        if (isResidential) {
          // Only excess above 3,000,000 RWF is taxed
          taxableBase = Math.max(0, marketValueRWF - FIXED_ASSET_TAX.residentialExemption);
          annualTax   = Math.round(taxableBase * FIXED_ASSET_TAX.rate);
          note = marketValueRWF <= FIXED_ASSET_TAX.residentialExemption
            ? 'Below 3M threshold — fully exempt'
            : `Taxable = ${fmt(marketValueRWF,'RWF',{compact:true})} − 3M exemption`;
        } else {
          // Land: full rate; may be exempt if agricultural ≤ 2 ha
          taxableBase = marketValueRWF;
          annualTax   = Math.round(taxableBase * FIXED_ASSET_TAX.rate);
          note        = 'Exempt if agricultural/forestry land ≤ 2 ha — verify with RRA';
        }
        return { a, isResidential, marketValueRWF, taxableBase, annualTax, note };
      });
  }, [assets]);

  const totalPropertyTax = propertyTaxRows.reduce((s, r) => s + r.annualTax, 0);

  // ═══ 2. VEHICLE ROAD MAINTENANCE LEVY (annual) ══════════════
  const vehicleLevyRows = useMemo(() => {
    return assets
      .filter(a => a.kind === 'vehicle')
      .map(a => {
        const cat = VEHICLE_CATEGORIES.find(c => c.id === (a.vehicleCategory || 'car'))
               || VEHICLE_CATEGORIES[0];
        return { a, cat, levy: cat.levy };
      });
  }, [assets]);

  const totalVehicleLevy = vehicleLevyRows.reduce((s, r) => s + r.levy, 0);

  // ═══ 3. CAPITAL GAINS TAX (on disposal) ══════════════════════
  const cgtRows = useMemo(() => {
    return assets.map(a => {
      const cls  = CLASSES.find(c => c.kind === a.kind) || CLASSES[CLASSES.length - 1];
      const rule = TAX_RULES[a.kind] || TAX_RULES['other'];
      const cost  = costRWF(a);
      const value = valueRWF(a, today);
      const gain  = value - cost;
      const taxable = Math.max(gain, 0);
      const cgt     = Math.round(taxable * rule.rate);
      const withholding = rule.withholding && a.yieldPct
        ? Math.round(cost * (a.yieldPct / 100) * rule.wRate)
        : 0;
      return { a, cls, rule, cost, value, gain, taxable, cgt, withholding };
    }).sort((a, b) => b.cgt - a.cgt);
  }, [assets]);

  const totalGain        = cgtRows.reduce((s, r) => s + Math.max(r.gain, 0), 0);
  const totalCGT         = cgtRows.reduce((s, r) => s + r.cgt, 0);
  const totalWithholding = cgtRows.reduce((s, r) => s + r.withholding, 0);
  const totalCGTAll      = totalCGT + totalWithholding;

  // ═══ Grand totals ════════════════════════════════════════════
  const totalAnnual = totalPropertyTax + totalVehicleLevy;

  const c = profile.displayCurrency;

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div style={{ padding: 28, background: 'var(--bg)', minHeight: 'calc(100vh - 70px)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="font-serif" style={{ fontSize: 28 }}>Tax Report {year}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
            Rwanda Revenue Authority · Based on asset values as at {today.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}
          </div>
        </div>
        <button onClick={() => window.print()} className="btn btn-ghost" style={{ fontSize: 12 }}>
          Print / Save PDF
        </button>
      </div>

      {/* ── Summary KPIs ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 28 }}>
        <KpiCard
          label="Fixed asset tax (annual)"
          value={fmtBase(totalPropertyTax, c, { compact: true })}
          sub="Real estate · due 31 March"
          color="var(--down)"
          highlight={totalPropertyTax > 0}
        />
        <KpiCard
          label="Vehicle road levy (annual)"
          value={fmtBase(totalVehicleLevy, c, { compact: true })}
          sub="Per vehicle · due 31 December"
          color="var(--clay)"
          highlight={totalVehicleLevy > 0}
        />
        <KpiCard
          label="Total annual obligations"
          value={fmtBase(totalAnnual, c, { compact: true })}
          sub="Fixed recurring tax per year"
          color="var(--down)"
          highlight
        />
        <KpiCard
          label="Est. CGT on full disposal"
          value={fmtBase(totalCGTAll, c, { compact: true })}
          sub="Only triggered when assets sold"
          color="var(--ink-3)"
        />
      </div>

      {/* ══════════════════════════════════════════════════════════
          SECTION A: FIXED ASSET TAX
      ══════════════════════════════════════════════════════════ */}
      <Section
        title="Fixed Asset Tax"
        sub="Annual obligation on immovable property · RRA"
        accent="var(--down)"
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <LawBadge law="RRA · Fixed Asset Tax Law" />
          <span className="muted" style={{ fontSize: 11 }}>Declaration & payment deadline: 31 March · Late interest: 1.5%/month + 10% surcharge (max RWF 100,000)</span>
        </div>

        <FormulaBox>
          {'Annual tax  =  taxable base  ×  1/1000  (0.1%)\n\n'}
          {'Land (realestate):          taxable base  =  full market value\n'}
          {'House (residential):        taxable base  =  max(0,  market value − RWF 3,000,000)\n'}
          {'Agricultural land ≤ 2 ha:  EXEMPT  (verify area with RRA)'}
        </FormulaBox>

        {propertyTaxRows.length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <div className="muted" style={{ fontSize: 13 }}>No real estate assets in your portfolio yet.</div>
          </div>
        ) : (
          <TaxTable
            columns={['Asset', 'Type', 'Market value', 'Exemption', 'Taxable base', 'Rate', 'Annual tax', 'Note']}
            rows={propertyTaxRows.map(r => [
              r.a.name,
              r.isResidential ? 'Residential house' : 'Land / plot',
              { value: fmtBase(r.marketValueRWF, c, { compact: true }), mono: true },
              { value: r.isResidential ? 'RWF 3,000,000' : '—', color: 'var(--up)' },
              { value: fmtBase(r.taxableBase, c, { compact: true }), mono: true },
              { value: '0.1% / yr', color: 'var(--ink-3)' },
              {
                value: r.annualTax > 0 ? fmtBase(r.annualTax, c) : 'Exempt',
                mono: true, bold: r.annualTax > 0,
                color: r.annualTax > 0 ? 'var(--down)' : 'var(--up)',
              },
              { value: r.note, color: 'var(--ink-3)' },
            ])}
            footerRow={[
              'Total', '', '', '', '',  '',
              { value: fmtBase(totalPropertyTax, c), mono: true, bold: true, color: 'var(--down)' },
              '',
            ]}
          />
        )}

        {/* Late payment calculator */}
        <div className="card" style={{ padding: '16px 20px', marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Late payment penalty estimator</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, fontSize: 12 }}>
            {[
              { label: '< 1 month late',  rate: 0.10 },
              { label: '1–2 months late', rate: 0.20 },
              { label: '2–3 months late', rate: 0.30 },
              { label: '> 3 months late', rate: 0.40 },
            ].map(b => (
              <div key={b.label} style={{ padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 8 }}>
                <div className="muted" style={{ fontSize: 10, marginBottom: 4 }}>{b.label}</div>
                <div className="num" style={{ fontWeight: 600, color: 'var(--down)' }}>
                  + {fmt(Math.round(totalPropertyTax * b.rate), 'RWF', { compact: true })}
                </div>
                <div className="muted" style={{ fontSize: 9.5, marginTop: 2 }}>{(b.rate * 100).toFixed(0)}% surcharge</div>
              </div>
            ))}
          </div>
          <div className="muted" style={{ fontSize: 10, marginTop: 8, lineHeight: 1.5 }}>
            Plus 1.5% monthly interest from 31 March. Maximum surcharge: RWF 100,000.
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════
          SECTION B: VEHICLE ROAD MAINTENANCE LEVY
      ══════════════════════════════════════════════════════════ */}
      <Section
        title="Vehicle Road Maintenance Levy"
        sub="Annual obligation per vehicle · Law 013/2025 of 27/05/2025"
        accent="var(--clay)"
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <LawBadge law="Law 013/2025 · Art. 2(2)" />
          <span className="muted" style={{ fontSize: 11 }}>
            Declared and paid to RRA by 31 December each year · Fuel levy (15% petrol/gas oil CIF) collected at customs separately
          </span>
        </div>

        {/* Rate schedule */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 16 }}>
          {VEHICLE_CATEGORIES.map(cat => (
            <div key={cat.id} style={{
              padding: '10px 14px', borderRadius: 9,
              background: 'var(--bg-2)', border: '0.5px solid var(--line)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-2)' }}>{cat.label}</div>
              <div className="num" style={{ fontSize: 15, fontWeight: 700, marginTop: 2, color: 'var(--clay)' }}>
                {fmt(cat.levy, 'RWF', { compact: false })}
              </div>
              <div className="muted" style={{ fontSize: 9.5 }}>per year</div>
            </div>
          ))}
        </div>

        {vehicleLevyRows.length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <div className="muted" style={{ fontSize: 13 }}>No vehicles in your portfolio.</div>
          </div>
        ) : (
          <TaxTable
            columns={['Vehicle', 'Model', 'Category (Law 013/2025)', 'Annual levy']}
            rows={vehicleLevyRows.map(r => [
              r.a.name,
              { value: r.a.model || '—', color: 'var(--ink-2)' },
              r.cat.label,
              { value: fmt(r.levy, 'RWF'), mono: true, bold: true, color: 'var(--clay)' },
            ])}
            footerRow={[
              'Total', '', '',
              { value: fmt(totalVehicleLevy, 'RWF'), mono: true, color: 'var(--clay)' },
            ]}
          />
        )}

        <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 10, background: 'var(--bg-2)', fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.55 }}>
          <strong style={{ color: 'var(--ink-2)' }}>Exempt:</strong> Government of Rwanda vehicles · Embassy and diplomatic mission vehicles · International organization vehicles with bilateral agreement (Art. 5, Law 013/2025)
          <br />
          <strong style={{ color: 'var(--ink-2)' }}>Fuel levy note:</strong> The 15% levy on petrol and gas oil (Art. 2(1)) is collected at the EAC customs point and is already embedded in pump prices — no separate filing required by individual taxpayers.
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════
          SECTION C: CAPITAL GAINS TAX (on disposal)
      ══════════════════════════════════════════════════════════ */}
      <Section
        title="Capital Gains Tax — on disposal"
        sub="CGT is only triggered when you sell an asset · estimated at current unrealised gains"
        accent="var(--gold)"
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
          <LawBadge law="Rwanda Income Tax Law · RRA CGT" />
          <span className="muted" style={{ fontSize: 11 }}>5% on realised gains for most asset classes · withholding 15% on investment income</span>
        </div>

        <FormulaBox>
          {'CGT  =  max(0,  disposal price − cost basis)  ×  rate\n\n'}
          {'Land, house, stocks, crypto, other:  5% of realised gain\n'}
          {'T-bonds / T-bills:                   Tax-exempt (capital gains)\n'}
          {'Withholding tax on investment income: 15% at source'}
        </FormulaBox>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          <KpiCard label="Unrealised gains"   value={fmtBase(totalGain, c, { compact:true })}  color="var(--up)" />
          <KpiCard label="Estimated CGT"       value={fmtBase(totalCGT, c, { compact:true })}   color="var(--down)" />
          <KpiCard label="Withholding tax"      value={fmtBase(totalWithholding, c, { compact:true })} color="var(--gold)" />
        </div>

        <TaxTable
          columns={['Asset', 'Class', 'Cost basis', 'Current value', 'Unrealised gain', 'CGT rate', 'Est. CGT', 'Withholding']}
          rows={cgtRows.map(({ a, cls, rule, cost, value, gain, cgt, withholding }) => [
            a.name,
            { value: cls.label, color: 'var(--ink-2)' },
            { value: fmtBase(cost, c, { compact:true }), mono: true },
            { value: fmtBase(value, c, { compact:true }), mono: true },
            {
              value: (gain >= 0 ? '+' : '') + fmtBase(gain, c, { compact:true }),
              mono: true, bold: gain > 0,
              color: gain >= 0 ? 'var(--up)' : 'var(--down)',
            },
            { value: rule.label, color: 'var(--ink-3)' },
            {
              value: cgt > 0 ? fmtBase(cgt, c, { compact:true }) : '—',
              mono: true, bold: cgt > 0, color: cgt > 0 ? 'var(--down)' : 'var(--ink-3)',
            },
            {
              value: withholding > 0 ? fmtBase(withholding, c, { compact:true }) : '—',
              mono: true, color: withholding > 0 ? 'var(--gold)' : 'var(--ink-3)',
            },
          ])}
          footerRow={[
            'Total', '',
            '', '',
            { value: '+' + fmtBase(totalGain, c, { compact:true }), mono:true, color:'var(--up)' },
            '',
            { value: fmtBase(totalCGT, c, { compact:true }), mono:true, color:'var(--down)' },
            { value: fmtBase(totalWithholding, c, { compact:true }), mono:true, color:'var(--gold)' },
          ]}
        />
      </Section>

      {/* ── Disclaimer ────────────────────────────────────────── */}
      <div style={{
        padding: '16px 18px', borderRadius: 12,
        background: 'var(--bg-2)', border: '0.5px solid var(--line)',
        fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.7, marginTop: 8,
      }}>
        <strong style={{ color: 'var(--ink-2)' }}>Disclaimer</strong>
        {' · '}
        Tax calculations are estimates based on current asset values and Rwanda tax law as understood at the time of publication.
        Fixed Asset Tax formula: 1/1000 × taxable value (RRA); residential exemption: first RWF 3,000,000.
        Road Maintenance Levy per Law 013/2025 of 27/05/2025 (Official Gazette Special, 29/05/2025).
        CGT is realised only upon disposal of an asset. Withholding tax is deducted at source by the payer.
        {' '}
        <strong style={{ color: 'var(--ink-2)' }}>Consult a licensed Rwanda tax advisor or contact RRA directly before filing.</strong>
        {' · rra.gov.rw · +250 788 185 500'}
      </div>
    </div>
  );
}
