import React, { useState, useMemo, useRef } from 'react';
import { CLASSES, valueRWF, costRWF, fmtBase } from '../data.js';
import AssetRow from '../components/AssetRow.jsx';
import AssetEditor from '../components/AssetEditor.jsx';
import { downloadAssetTemplate, parseAssetExcel, findExistingByNaturalKey } from '../excel.js';

export default function AssetsView({ state, dispatch }) {
  const { assets, profile } = state;
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const fileRef = useRef(null);
  const today = new Date();

  function toggleOne(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleBulkDelete() {
    if (!confirm(`Permanently delete ${selected.size} asset${selected.size === 1 ? '' : 's'}?`)) return;
    dispatch({ type: 'bulkDeleteAssets', ids: selected });
    setSelected(new Set());
  }

  const handleImport = async (file) => {
    try {
      const { assets: parsed, errors } = await parseAssetExcel(file);
      if (parsed.length === 0 && errors.length === 0) {
        setImportResult({ kind: 'error', message: 'No rows found in the spreadsheet.' });
        return;
      }
      if (parsed.length === 0) {
        setImportResult({ kind: 'error', message: `No valid rows. ${errors.length} error${errors.length === 1 ? '' : 's'} found.`, errors });
        return;
      }
      // Match each parsed row against existing assets using natural keys
      // (UPI → chassis → ticker+kind). Carry over the existing id so
      // upsertAsset updates in place instead of creating a duplicate.
      const matched = parsed.map(p => {
        const existing = findExistingByNaturalKey(p, assets);
        return existing ? { ...p, id: existing.id } : p;
      });
      const updates = matched.filter(p => assets.some(a => a.id === p.id));
      const inserts = matched.filter(p => !assets.some(a => a.id === p.id));

      const summary = [
        inserts.length && `add ${inserts.length} new`,
        updates.length && `update ${updates.length} existing`,
      ].filter(Boolean).join(' · ');
      const msg = `This will ${summary} asset${matched.length === 1 ? '' : 's'}.` +
        (errors.length ? `\n\n${errors.length} row${errors.length === 1 ? ' was' : 's were'} skipped due to errors.` : '');
      if (!confirm(msg)) return;
      matched.forEach(asset => dispatch({ type:'upsertAsset', asset }));
      setImportResult({
        kind: errors.length ? 'partial' : 'success',
        message: [
          inserts.length && `${inserts.length} asset${inserts.length === 1 ? '' : 's'} added.`,
          updates.length && `${updates.length} asset${updates.length === 1 ? '' : 's'} updated.`,
          errors.length  && `${errors.length} row${errors.length === 1 ? '' : 's'} skipped.`,
        ].filter(Boolean).join('  '),
        errors,
      });
    } catch (e) {
      setImportResult({ kind: 'error', message: `Could not read the file: ${e.message}` });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

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

  const visibleIds = useMemo(() => {
    const ids = new Set();
    filtered.forEach(g => g.items.forEach(a => ids.add(a.id)));
    return ids;
  }, [filtered]);

  const allVisibleSelected = visibleIds.size > 0 && [...visibleIds].every(id => selected.has(id));
  const someSelected = selected.size > 0;

  return (
    <div style={{ padding: 28, background:'var(--bg)', minHeight:'calc(100vh - 70px)' }}>
      <div className="row" style={{ gap: 10, marginBottom: 12 }}>
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
        <button onClick={downloadAssetTemplate} className="btn btn-ghost" title="Download an Excel template for bulk import">↓ Template</button>
        <button onClick={() => fileRef.current?.click()} className="btn btn-ghost" title="Import filled-in Excel template">↑ Import Excel</button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }}
          onChange={e => e.target.files?.[0] && handleImport(e.target.files[0])} />
        <button onClick={() => setEditing({})} className="btn btn-primary">＋ Add asset</button>
      </div>

      {someSelected && (
        <div className="row" style={{
          padding: '10px 16px', borderRadius: 10, marginBottom: 12,
          background: 'var(--down-soft)', gap: 12, alignItems: 'center',
        }}>
          <span style={{ fontSize: 13, color: 'var(--down)', fontWeight: 500, flex: 1 }}>
            {selected.size} asset{selected.size === 1 ? '' : 's'} selected
          </span>
          <button onClick={() => setSelected(new Set())} className="btn btn-ghost" style={{ fontSize: 12 }}>
            Deselect all
          </button>
          <button onClick={handleBulkDelete} className="btn" style={{
            fontSize: 12, background: 'var(--down)', color: '#fff', border: 0,
            padding: '6px 14px', borderRadius: 7, cursor: 'pointer',
          }}>
            Delete {selected.size} asset{selected.size === 1 ? '' : 's'}
          </button>
        </div>
      )}

      {importResult && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 16,
          background: importResult.kind === 'success' ? 'var(--up-soft)' : importResult.kind === 'partial' ? 'var(--gold-soft)' : 'var(--down-soft)',
          color: importResult.kind === 'success' ? 'var(--up)' : importResult.kind === 'partial' ? 'var(--gold)' : 'var(--down)',
          fontSize: 13, lineHeight: 1.5,
        }}>
          <div className="row" style={{ justifyContent:'space-between', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <strong>{importResult.message}</strong>
              {importResult.errors?.length > 0 && (
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12 }}>
                  {importResult.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
                  {importResult.errors.length > 8 && <li>…and {importResult.errors.length - 8} more.</li>}
                </ul>
              )}
            </div>
            <button onClick={() => setImportResult(null)} style={{
              width: 24, height: 24, borderRadius: 6, border: 0, background:'transparent', color:'inherit', cursor:'pointer', fontSize: 14,
            }}>×</button>
          </div>
        </div>
      )}

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
            display:'grid', gridTemplateColumns:'28px 2.3fr 1fr 1.2fr 1.2fr 0.9fr 60px',
            padding:'8px 22px', fontSize: 10, fontWeight: 600, letterSpacing:'0.06em', textTransform:'uppercase', gap: 12, alignItems: 'center',
          }}>
            <input type="checkbox"
              checked={allVisibleSelected}
              onChange={() => {
                if (allVisibleSelected) {
                  setSelected(prev => { const next = new Set(prev); visibleIds.forEach(id => next.delete(id)); return next; });
                } else {
                  setSelected(prev => new Set([...prev, ...visibleIds]));
                }
              }}
              title={allVisibleSelected ? 'Deselect all' : 'Select all visible'}
              style={{ cursor: 'pointer', accentColor: 'var(--down)', margin: 0 }}
            />
            <span>Name</span><span>Bought</span><span>Today's value</span><span>In {profile.displayCurrency}</span><span style={{ textAlign:'right' }}>P/L</span><span></span>
          </div>
          <div className="hr"/>
          {g.items.map((a, i) => (
            <React.Fragment key={a.id}>
              {i > 0 && <div className="hr" style={{ margin: '0 22px' }}/>}
              <AssetRow asset={a} displayCurrency={profile.displayCurrency}
                isSelected={selected.has(a.id)}
                onToggle={() => toggleOne(a.id)}
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
