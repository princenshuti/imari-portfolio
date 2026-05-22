import { useMemo } from 'react';
import { CLASSES, TAX_RULES, toBase, valueRWF, costRWF, fmtBase, fmt } from '../data.js';

export default function TaxReportView({ state }) {
  const { assets, profile } = state;
  const today = new Date();

  const rows = useMemo(() => {
    return assets.map(a => {
      const cls   = CLASSES.find(c => c.kind === a.kind) || CLASSES[CLASSES.length - 1];
      const rule  = TAX_RULES[a.kind] || TAX_RULES['other'];
      const cost  = costRWF(a);
      const value = valueRWF(a, today);
      const gain  = value - cost;
      const taxable = gain > 0 ? gain : 0;
      const cgt   = Math.round(taxable * rule.rate);
      const withholding = rule.withholding && a.yieldPct
        ? Math.round(cost * (a.yieldPct / 100) * rule.wRate)
        : 0;
      return { a, cls, rule, cost, value, gain, taxable, cgt, withholding };
    }).sort((a, b) => b.cgt - a.cgt);
  }, [assets]);

  const totalGain        = rows.reduce((s, r) => s + Math.max(r.gain, 0), 0);
  const totalCGT         = rows.reduce((s, r) => s + r.cgt, 0);
  const totalWithholding = rows.reduce((s, r) => s + r.withholding, 0);
  const totalTax         = totalCGT + totalWithholding;

  const handlePrint = () => window.print();

  return (
    <div style={{ padding: 28, background: 'var(--bg)', minHeight: 'calc(100vh - 70px)' }}>

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="font-serif" style={{ fontSize: 26 }}>Tax Report {today.getFullYear()}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            Estimated Rwanda tax liability · Based on current asset values · For reference only, not legal tax advice.
          </div>
        </div>
        <button onClick={handlePrint} className="btn btn-ghost">🖨 Print / Save PDF</button>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 22 }}>
        {[
          { label: 'Unrealised gains', value: fmtBase(totalGain, profile.displayCurrency, { compact: true }), color: 'var(--up)' },
          { label: 'Estimated CGT', value: fmtBase(totalCGT, profile.displayCurrency, { compact: true }), color: 'var(--down)' },
          { label: 'Withholding tax', value: fmtBase(totalWithholding, profile.displayCurrency, { compact: true }), color: 'var(--gold)' },
          { label: 'Total estimated tax', value: fmtBase(totalTax, profile.displayCurrency, { compact: true }), color: 'var(--down)', bold: true },
        ].map((c, i) => (
          <div key={i} style={{ padding: '14px 18px', borderRadius: 'var(--r-md)', background: 'var(--paper)', border: '0.5px solid var(--line)' }}>
            <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
            <div className="num" style={{ fontSize: 20, fontWeight: c.bold ? 800 : 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <div style={{ padding: '14px 20px', borderBottom: '0.5px solid var(--line)' }}>
          <div className="font-serif" style={{ fontSize: 16 }}>Asset-by-asset breakdown</div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg-2)' }}>
              {['Asset', 'Class', 'Cost basis', 'Current value', 'Unrealised gain', 'CGT rate', 'Est. CGT', 'Withholding'].map(h => (
                <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ a, cls, rule, cost, value, gain, cgt, withholding }, i) => (
              <tr key={a.id} style={{ borderTop: i > 0 ? '0.5px solid var(--line)' : 'none' }}>
                <td style={{ padding: '10px 14px', fontWeight: 500 }}>{a.name}</td>
                <td style={{ padding: '10px 14px', color: 'var(--ink-2)' }}>{cls.label}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'Geist Mono, monospace' }}>{fmtBase(cost, profile.displayCurrency, { compact: true })}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'Geist Mono, monospace' }}>{fmtBase(value, profile.displayCurrency, { compact: true })}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'Geist Mono, monospace', color: gain >= 0 ? 'var(--up)' : 'var(--down)', fontWeight: 600 }}>
                  {gain >= 0 ? '+' : ''}{fmtBase(gain, profile.displayCurrency, { compact: true })}
                </td>
                <td style={{ padding: '10px 14px', color: 'var(--ink-3)' }}>{rule.label}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'Geist Mono, monospace', color: cgt > 0 ? 'var(--down)' : 'var(--ink-3)', fontWeight: cgt > 0 ? 600 : 400 }}>
                  {cgt > 0 ? fmtBase(cgt, profile.displayCurrency, { compact: true }) : '—'}
                </td>
                <td style={{ padding: '10px 14px', fontFamily: 'Geist Mono, monospace', color: withholding > 0 ? 'var(--gold)' : 'var(--ink-3)' }}>
                  {withholding > 0 ? fmtBase(withholding, profile.displayCurrency, { compact: true }) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '1px solid var(--line-strong)', background: 'var(--bg-2)' }}>
              <td colSpan={4} style={{ padding: '10px 14px', fontWeight: 700 }}>Totals</td>
              <td style={{ padding: '10px 14px', fontFamily: 'Geist Mono, monospace', color: 'var(--up)', fontWeight: 700 }}>+{fmtBase(totalGain, profile.displayCurrency, { compact: true })}</td>
              <td />
              <td style={{ padding: '10px 14px', fontFamily: 'Geist Mono, monospace', color: 'var(--down)', fontWeight: 700 }}>{fmtBase(totalCGT, profile.displayCurrency, { compact: true })}</td>
              <td style={{ padding: '10px 14px', fontFamily: 'Geist Mono, monospace', color: 'var(--gold)', fontWeight: 700 }}>{fmtBase(totalWithholding, profile.displayCurrency, { compact: true })}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="muted" style={{ fontSize: 10, marginTop: 16, lineHeight: 1.7 }}>
        <strong>Disclaimer:</strong> These are illustrative estimates based on current asset values and simplified Rwanda tax rules. CGT is typically only realised upon disposal of an asset.
        Withholding tax applies to interest/dividends at source (15% for listed securities, T-bonds). Consult a licensed Rwanda tax advisor or the Rwanda Revenue Authority (RRA) before making tax decisions.
        This report is not a substitute for professional tax advice.
      </div>
    </div>
  );
}
