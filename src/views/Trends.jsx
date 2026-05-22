import { useMemo } from 'react';
import { TREND_DOMAINS, KIGALI_NEIGHBOURHOODS, fmt } from '../data.js';
import { TrendCard } from '../components/Field.jsx';

export default function TrendsView() {
  const groups = useMemo(() => {
    const out = {};
    TREND_DOMAINS.forEach(d => { (out[d.group] = out[d.group] || []).push(d); });
    return out;
  }, []);

  return (
    <div style={{ padding: 28, background:'var(--bg)', minHeight:'calc(100vh - 70px)' }}>
      <div className="card" style={{ padding: 14, marginBottom: 18, borderLeft:'3px solid var(--gold)' }}>
        <div className="row" style={{ gap: 10 }}>
          <span style={{ fontSize: 18, color:'var(--gold)' }}>◆</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Values are illustrative</div>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 2, lineHeight: 1.45 }}>
              This personal portal runs entirely in your browser and can't reliably fetch live market data.
              The series below are synthesised so the trends and shapes are realistic, but the absolute numbers
              are placeholders. Replace them by updating your asset's "last price" or yield.
            </div>
          </div>
        </div>
      </div>

      {Object.entries(groups).map(([groupName, domains]) => (
        <div key={groupName} style={{ marginBottom: 22 }}>
          <div className="row" style={{ justifyContent:'space-between', marginBottom: 12 }}>
            <div className="font-serif" style={{ fontSize: 20 }}>{groupName}</div>
            <span className="muted" style={{ fontSize: 11 }}>{domains.length} indicators</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 14 }}>
            {domains.map(d => <TrendCard key={d.id} d={d} big />)}
          </div>
        </div>
      ))}

      <div className="card" style={{ padding: 22, marginTop: 8 }}>
        <div className="row" style={{ justifyContent:'space-between', marginBottom: 14 }}>
          <div>
            <div className="font-serif" style={{ fontSize: 20 }}>Kigali real-estate · per neighbourhood</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>Indicative price per m² · sorted by value</div>
          </div>
          <span className="pill pill-soft">illustrative</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap: 10 }}>
          {KIGALI_NEIGHBOURHOODS.sort((a,b) => b.pricePerSqm - a.pricePerSqm).map(n => (
            <div key={n.name} className="row" style={{ padding: '12px 14px', borderRadius: 9, background:'var(--bg-2)', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{n.name}</div>
                <div className="muted" style={{ fontSize: 11 }}>per m²</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div className="num" style={{ fontSize: 14, fontWeight: 600 }}>{fmt(n.pricePerSqm, 'RWF', { compact: true })}</div>
                <div className="num" style={{ fontSize: 10, color: n.change >= 0 ? 'var(--up)' : 'var(--down)' }}>{n.change >= 0 ? '▲' : '▼'} {Math.abs(n.change)}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
