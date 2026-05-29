import { useMemo } from 'react';
import {
  CLASSES, LIABILITY_TYPES, valueRWF, costRWF, toBase, fromBase, fmtBase,
} from '../data.js';

// B18 — Personal balance sheet. The net-worth total here MUST equal the
// dashboard figure (single source of truth): same valueRWF/costRWF/toBase math.
export default function BalanceSheetView({ state }) {
  const { assets = [], liabilities = [], profile } = state;
  const ccy = profile.displayCurrency || 'RWF';
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const data = useMemo(() => {
    // Assets grouped by class group.
    const groups = {};
    let estimatedCount = 0;
    assets.forEach(a => {
      const cls = CLASSES.find(c => c.kind === a.kind) || CLASSES[CLASSES.length - 1];
      const g = cls.group;
      const estimated = a.currentValue === '' || a.currentValue == null;
      if (estimated) estimatedCount += 1;
      (groups[g] = groups[g] || { group: g, color: cls.color, items: [], cost: 0, value: 0 });
      const v = valueRWF(a, today), c = costRWF(a);
      groups[g].items.push({ name: a.name, kind: cls.label, cost: c, value: v, estimated });
      groups[g].cost += c; groups[g].value += v;
    });
    const assetGroups = Object.values(groups).sort((a, b) => b.value - a.value);
    const totalAssets = assetGroups.reduce((s, g) => s + g.value, 0);
    const totalCost = assetGroups.reduce((s, g) => s + g.cost, 0);

    // Liabilities grouped by type.
    const liabByType = {};
    liabilities.forEach(l => {
      const t = LIABILITY_TYPES.find(x => x.kind === l.kind) || LIABILITY_TYPES[LIABILITY_TYPES.length - 1];
      const amt = toBase(l.remainingAmount || 0, l.currency || 'RWF');
      (liabByType[t.label] = liabByType[t.label] || { label: t.label, color: t.color, items: [], total: 0 });
      liabByType[t.label].items.push({ name: l.name || l.lender || t.label, amount: amt });
      liabByType[t.label].total += amt;
    });
    const liabGroups = Object.values(liabByType).sort((a, b) => b.total - a.total);
    const totalDebt = liabGroups.reduce((s, g) => s + g.total, 0);

    return { assetGroups, totalAssets, totalCost, liabGroups, totalDebt, netWorth: totalAssets - totalDebt, estimatedCount };
  }, [assets, liabilities]);

  const show = (rwf) => fmtBase(rwf, ccy, { compact: false });

  const downloadCSV = () => {
    const conv = (rwf) => Math.round(fromBase(rwf, ccy));
    const rows = [['Section', 'Group', 'Item', `Cost basis (${ccy})`, `Current value (${ccy})`, 'Basis']];
    data.assetGroups.forEach(g => g.items.forEach(it =>
      rows.push(['Asset', g.group, it.name, conv(it.cost), conv(it.value), it.estimated ? 'Estimated' : 'Your value'])));
    data.liabGroups.forEach(g => g.items.forEach(it =>
      rows.push(['Liability', g.label, it.name, '', conv(it.amount), ''])));
    rows.push([]);
    rows.push(['Total assets', '', '', conv(data.totalCost), conv(data.totalAssets), '']);
    rows.push(['Total liabilities', '', '', '', conv(data.totalDebt), '']);
    rows.push(['Net worth', '', '', '', conv(data.netWorth), '']);
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `imari-balance-sheet-${today.toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const sectionLabel = { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: '0 0 8px' };

  return (
    <div style={{ padding: 28, background: 'var(--bg)', minHeight: 'calc(100vh - 70px)' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, gap: 12, flexWrap: 'wrap' }} data-noprint>
        <div>
          <div className="font-serif" style={{ fontSize: 26 }}>Balance sheet</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>Assets − liabilities = net worth · as of {dateStr}</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button onClick={downloadCSV} className="btn btn-ghost">↓ CSV</button>
          <button onClick={() => window.print()} className="btn btn-primary">⎙ Print / Save PDF</button>
        </div>
      </div>

      <div className="card" style={{ padding: '24px 28px', maxWidth: 820 }}>
        {/* Print header */}
        <div style={{ marginBottom: 20 }}>
          <div className="font-serif" style={{ fontSize: 22 }}>Statement of Net Worth</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            {profile.name ? `${profile.name} · ` : ''}as of {dateStr} · valued in {ccy}
          </div>
        </div>

        {/* Assets */}
        <p style={sectionLabel}>Assets</p>
        {data.assetGroups.map(g => (
          <div key={g.group} style={{ marginBottom: 14 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: g.color }} />
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{g.group}</span>
              </div>
              <span className="num" style={{ fontSize: 13.5, fontWeight: 700 }}>{show(g.value)}</span>
            </div>
            {g.items.map((it, i) => (
              <div key={i} className="row" style={{ justifyContent: 'space-between', padding: '3px 0 3px 16px', fontSize: 12, color: 'var(--ink-2)' }}>
                <span>{it.name}{it.estimated && <span className="muted" style={{ marginLeft: 6, fontSize: 10 }}>est.</span>}</span>
                <span className="num">{show(it.value)}</span>
              </div>
            ))}
          </div>
        ))}
        <div className="row" style={{ justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--line)', marginTop: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Total assets</span>
          <span className="num" style={{ fontSize: 14, fontWeight: 700 }}>{show(data.totalAssets)}</span>
        </div>

        {/* Liabilities */}
        <p style={{ ...sectionLabel, marginTop: 18 }}>Liabilities</p>
        {data.liabGroups.length === 0 ? (
          <div className="muted" style={{ fontSize: 12, paddingLeft: 16 }}>No debts tracked — net worth equals total assets.</div>
        ) : data.liabGroups.map(g => (
          <div key={g.label} className="row" style={{ justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
            <span style={{ color: 'var(--ink-2)' }}>{g.label}</span>
            <span className="num" style={{ fontWeight: 600 }}>{show(g.total)}</span>
          </div>
        ))}
        {data.liabGroups.length > 0 && (
          <div className="row" style={{ justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--line)', marginTop: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Total liabilities</span>
            <span className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--down)' }}>{show(data.totalDebt)}</span>
          </div>
        )}

        {/* Net worth */}
        <div className="row" style={{ justifyContent: 'space-between', padding: '14px 16px', marginTop: 16, borderRadius: 'var(--r-md)', background: 'var(--brand-softer)', border: '0.5px solid var(--brand-soft)' }}>
          <span className="font-serif" style={{ fontSize: 18 }}>Net worth</span>
          <span className="num" style={{ fontSize: 20, fontWeight: 700, color: 'var(--brand)' }}>{show(data.netWorth)}</span>
        </div>

        {data.estimatedCount > 0 && (
          <div className="muted" style={{ fontSize: 10.5, marginTop: 14, lineHeight: 1.5 }}>
            {data.estimatedCount} asset{data.estimatedCount === 1 ? '' : 's'} marked <em>est.</em> use Imari's modeled valuation rather than a figure you entered — a lender should treat these as estimates, not appraised values. Cost basis total: {show(data.totalCost)}.
          </div>
        )}
      </div>
    </div>
  );
}
