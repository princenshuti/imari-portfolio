import React, { useState, useMemo } from 'react';
import { CLASSES, valueRWF, costRWF, fmtBase } from '../data.js';
import AssetRow from '../components/AssetRow.jsx';
import AssetEditor from '../components/AssetEditor.jsx';

export default function AssetsView({ state, dispatch }) {
  const { assets, profile } = state;
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const today = new Date();

  const groups = useMemo(() => {
    const out = {};
    assets.forEach(a => {
      const cls = CLASSES.find(c => c.kind === a.kind) || CLASSES[CLASSES.length-1];
      const g = cls.group;
      out[g] = out[g] || { group: g, color: cls.color, items: [], total: 0, cost: 0 };
      out[g].items.push(a);
      out[g].total += valueRWF(a, today);
      out[g].cost  += costRWF(a);
    });
    return Object.values(out).sort((a,b) => b.total - a.total);
  }, [assets]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return groups
      .map(g => ({ ...g, items: g.items.filter(a => {
        if (filter !== 'all' && (CLASSES.find(c => c.kind === a.kind)?.group !== filter)) return false;
        if (q && !a.name.toLowerCase().includes(q)) return false;
        return true;
      })}))
      .filter(g => g.items.length > 0);
  }, [groups, filter, search]);

  return (
    <div style={{ padding: 28, background:'var(--bg)', minHeight:'calc(100vh - 70px)' }}>
      <div className="row" style={{ gap: 10, marginBottom: 18 }}>
        <div className="row" style={{ flex: 1, padding: '9px 12px', borderRadius: 9, background:'var(--paper)', border:'1px solid var(--line)', gap: 8 }}>
          <span className="muted">⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets…" style={{
            flex: 1, border: 0, outline: 'none', background:'transparent', fontSize: 13, fontFamily:'inherit', color:'var(--ink)',
          }}/>
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{
          padding: '9px 12px', borderRadius: 9, border:'1px solid var(--line)', background:'var(--paper)', fontSize: 13, fontFamily:'inherit',
        }}>
          <option value="all">All classes</option>
          {Array.from(new Set(CLASSES.map(c => c.group))).map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <button onClick={() => setEditing({})} className="btn btn-primary">＋ Add asset</button>
      </div>

      {filtered.map(g => (
        <div key={g.group} className="card" style={{ marginBottom: 14, padding: 0 }}>
          <div className="row" style={{ padding: '16px 22px', justifyContent:'space-between' }}>
            <div className="row" style={{ gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: g.color }}/>
              <div className="font-serif" style={{ fontSize: 17 }}>{g.group}</div>
              <span className="pill pill-soft">{g.items.length}</span>
            </div>
            <div className="row" style={{ gap: 12, fontSize: 12 }}>
              <span className="muted">Cost · <span className="num" style={{ color:'var(--ink-2)' }}>{fmtBase(g.cost, profile.displayCurrency, { compact:true })}</span></span>
              <span className="muted">Today · <span className="num" style={{ color:'var(--ink)', fontWeight: 600 }}>{fmtBase(g.total, profile.displayCurrency, { compact:true })}</span></span>
              <span className={`pill ${g.total >= g.cost ? 'pill-up' : 'pill-down'}`} style={{ fontSize: 10 }}>
                {g.total >= g.cost ? '▲' : '▼'} {(((g.total - g.cost) / g.cost) * 100 || 0).toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="hr"/>
          <div className="row muted" style={{
            display:'grid', gridTemplateColumns:'2.3fr 1fr 1.2fr 1.2fr 0.9fr 60px',
            padding:'8px 22px', fontSize: 10, fontWeight: 600, letterSpacing:'0.06em', textTransform:'uppercase', gap: 12,
          }}>
            <span>Name</span><span>Bought</span><span>Today's value</span><span>In {profile.displayCurrency}</span><span style={{ textAlign:'right' }}>P/L</span><span></span>
          </div>
          <div className="hr"/>
          {g.items.map((a, i) => (
            <React.Fragment key={a.id}>
              {i > 0 && <div className="hr" style={{ margin: '0 22px' }}/>}
              <AssetRow asset={a} displayCurrency={profile.displayCurrency}
                onEdit={asset => setEditing(asset)}
                onDelete={asset => {
                  if (confirm(`Delete "${asset.name}"?`)) dispatch({ type:'deleteAsset', id: asset.id });
                }}
              />
            </React.Fragment>
          ))}
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="card" style={{ padding: 60, textAlign:'center' }}>
          <div className="font-serif" style={{ fontSize: 22, marginBottom: 8 }}>No assets yet</div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 18 }}>Start by adding your first asset — a plot, vehicle, savings account, or anything else.</div>
          <button onClick={() => setEditing({})} className="btn btn-primary">＋ Add your first asset</button>
        </div>
      )}

      {editing && <AssetEditor asset={editing}
        onSave={a => { dispatch({ type:'upsertAsset', asset: a }); setEditing(null); }}
        onCancel={() => setEditing(null)} />}
    </div>
  );
}
