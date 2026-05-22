import React, { useState, useMemo, useRef } from 'react';
import { CLASSES, valueRWF, costRWF, fmtBase } from '../data.js';
import AssetRow from '../components/AssetRow.jsx';
import AssetEditor from '../components/AssetEditor.jsx';
import { downloadAssetTemplate, parseAssetExcel, findExistingByNaturalKey } from '../excel.js';

// Canonical group order from CLASSES definition
const ALL_GROUPS = Array.from(new Set(CLASSES.map(c => c.group)));

const SORT_OPTIONS = [
  { value: 'default',    label: 'Default (by group)' },
  { value: 'value-desc', label: 'Value: High → Low'  },
  { value: 'value-asc',  label: 'Value: Low → High'  },
  { value: 'gain-desc',  label: 'Gain %: Best first'  },
  { value: 'gain-asc',   label: 'Loss %: Worst first' },
  { value: 'cost-desc',  label: 'Cost: High → Low'   },
  { value: 'date-desc',  label: 'Newest purchase'     },
  { value: 'date-asc',   label: 'Oldest purchase'     },
  { value: 'name-asc',   label: 'Name: A → Z'         },
];

export default function AssetsView({ state, dispatch }) {
  const { assets, profile } = state;
  const [editing, setEditing]           = useState(null);
  const [typeFilter, setTypeFilter]     = useState('all');
  const [locationFilter, setLocFilter]  = useState('all');
  const [sortBy, setSortBy]             = useState('default');
  const [search, setSearch]             = useState('');
  const [importResult, setImportResult] = useState(null);
  const [selected, setSelected]         = useState(new Set());
  const fileRef = useRef(null);
  const today   = new Date();

  /* ── Checkbox helpers ─────────────────────────────────────────── */
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

  /* ── Excel import ─────────────────────────────────────────────── */
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
      matched.forEach(asset => dispatch({ type: 'upsertAsset', asset }));
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

  /* ── Unique neighbourhoods (for location filter) ──────────────── */
  const neighbourhoods = useMemo(() => {
    const ns = new Set();
    assets.forEach(a => { if (a.neighbourhood) ns.add(a.neighbourhood); });
    return Array.from(ns).sort();
  }, [assets]);

  /* ── Base groups (all assets, pre-filter) ─────────────────────── */
  const groups = useMemo(() => {
    const out = {};
    assets.forEach(a => {
      const cls = CLASSES.find(c => c.kind === a.kind) || CLASSES[CLASSES.length - 1];
      const g = cls.group;
      out[g] = out[g] || { group: g, color: cls.color, items: [], total: 0, cost: 0 };
      out[g].items.push(a);
      out[g].total += valueRWF(a, today);
      out[g].cost  += costRWF(a);
    });
    // keep canonical group order, then sort by descending value within
    return ALL_GROUPS
      .filter(g => out[g])
      .map(g => out[g])
      .sort((a, b) => b.total - a.total);
  }, [assets]);

  /* ── Filtered + sorted result ─────────────────────────────────── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    // Step 1 — apply type / location / search filters
    let result = groups
      .map(g => ({
        ...g,
        items: g.items.filter(a => {
          const cls = CLASSES.find(c => c.kind === a.kind);
          if (typeFilter !== 'all' && cls?.group !== typeFilter) return false;
          if (locationFilter !== 'all' && a.neighbourhood !== locationFilter) return false;
          if (q && !a.name.toLowerCase().includes(q) &&
              !(a.neighbourhood || '').toLowerCase().includes(q) &&
              !(a.ticker || '').toLowerCase().includes(q)) return false;
          return true;
        }),
      }))
      .filter(g => g.items.length > 0);

    // Step 2 — apply sort
    if (sortBy !== 'default') {
      const sortFn = (a, b) => {
        switch (sortBy) {
          case 'value-desc': return valueRWF(b, today) - valueRWF(a, today);
          case 'value-asc':  return valueRWF(a, today) - valueRWF(b, today);
          case 'cost-desc':  return costRWF(b) - costRWF(a);
          case 'gain-desc': {
            const ca = costRWF(a) || 1, cb = costRWF(b) || 1;
            return (valueRWF(b, today) - cb) / cb - (valueRWF(a, today) - ca) / ca;
          }
          case 'gain-asc': {
            const ca = costRWF(a) || 1, cb = costRWF(b) || 1;
            return (valueRWF(a, today) - ca) / ca - (valueRWF(b, today) - cb) / cb;
          }
          case 'date-desc': return new Date(b.purchaseDate) - new Date(a.purchaseDate);
          case 'date-asc':  return new Date(a.purchaseDate) - new Date(b.purchaseDate);
          case 'name-asc':  return a.name.localeCompare(b.name);
          default: return 0;
        }
      };

      // Flatten → sort → re-bucket per group (preserve headers)
      const allItems = result.flatMap(g => g.items).sort(sortFn);
      const buckets  = {};
      allItems.forEach(a => {
        const cls = CLASSES.find(c => c.kind === a.kind) || CLASSES[CLASSES.length - 1];
        const g   = cls.group;
        if (!buckets[g]) {
          const orig = result.find(r => r.group === g);
          buckets[g] = { ...orig, items: [] };
        }
        buckets[g].items.push(a);
      });
      result = Object.values(buckets);
    }

    return result;
  }, [groups, typeFilter, locationFilter, sortBy, search]);

  /* ── Aggregated summary for the filtered view ─────────────────── */
  const summary = useMemo(() => {
    let cost = 0, value = 0, count = 0;
    filtered.forEach(g => g.items.forEach(a => {
      cost  += costRWF(a);
      value += valueRWF(a, today);
      count++;
    }));
    const gain    = value - cost;
    const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
    return { cost, value, gain, gainPct, count };
  }, [filtered]);

  const visibleIds = useMemo(() => {
    const ids = new Set();
    filtered.forEach(g => g.items.forEach(a => ids.add(a.id)));
    return ids;
  }, [filtered]);

  const allVisibleSelected = visibleIds.size > 0 && [...visibleIds].every(id => selected.has(id));
  const someSelected       = selected.size > 0;
  const isFiltered         = typeFilter !== 'all' || locationFilter !== 'all' || search.trim() || sortBy !== 'default';

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div style={{ padding: 28, background: 'var(--bg)', minHeight: 'calc(100vh - 70px)' }}>

      {/* ─ Top action bar ──────────────────────────────────────── */}
      <div className="row" style={{ gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {/* Search */}
        <div className="row" style={{
          flex: 1, minWidth: 180, padding: '9px 12px', borderRadius: 9,
          background: 'var(--paper)', border: '1px solid var(--line)', gap: 8,
        }}>
          <span className="muted" style={{ fontSize: 15 }}>⌕</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, ticker, neighbourhood…"
            style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 14, padding: 0 }}>×</button>
          )}
        </div>

        {/* Sort */}
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
          padding: '9px 12px', borderRadius: 9, border: '1px solid var(--line)',
          background: sortBy !== 'default' ? 'var(--brand-soft)' : 'var(--paper)',
          color: sortBy !== 'default' ? 'var(--brand)' : 'var(--ink)',
          fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
          borderColor: sortBy !== 'default' ? 'var(--brand)' : 'var(--line)',
        }}>
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <button onClick={downloadAssetTemplate} className="btn btn-ghost" title="Download an Excel template for bulk import">↓ Template</button>
        <button onClick={() => fileRef.current?.click()} className="btn btn-ghost" title="Import filled-in Excel template">↑ Import</button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
          onChange={e => e.target.files?.[0] && handleImport(e.target.files[0])} />
        <button onClick={() => setEditing({})} className="btn btn-primary">＋ Add asset</button>
      </div>

      {/* ─ Filter chips row ────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Type chips — All + each group that has assets */}
        {['all', ...ALL_GROUPS.filter(g => groups.some(gr => gr.group === g))].map(g => {
          const isActive = typeFilter === g;
          const grData   = groups.find(gr => gr.group === g);
          const cls      = CLASSES.find(c => c.group === g);
          const dot      = cls?.color;
          return (
            <button
              key={g}
              onClick={() => { setTypeFilter(g); setLocFilter('all'); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', borderRadius: 'var(--r-pill)',
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                border: isActive ? '1.5px solid var(--brand)' : '1px solid var(--line)',
                background: isActive ? 'var(--brand-soft)' : 'var(--paper)',
                color: isActive ? 'var(--brand)' : 'var(--ink-2)',
                transition: 'all 0.15s ease', whiteSpace: 'nowrap',
              }}
            >
              {g !== 'all' && (
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
              )}
              {g === 'all' ? `All · ${assets.length}` : `${g} · ${grData?.items.length ?? 0}`}
            </button>
          );
        })}

        {/* Location filter — show only if neighbourhoods exist */}
        {neighbourhoods.length > 0 && (
          <select
            value={locationFilter}
            onChange={e => setLocFilter(e.target.value)}
            style={{
              padding: '5px 11px', borderRadius: 'var(--r-pill)', fontSize: 12,
              border: locationFilter !== 'all' ? '1.5px solid var(--brand)' : '1px solid var(--line)',
              background: locationFilter !== 'all' ? 'var(--brand-soft)' : 'var(--paper)',
              color: locationFilter !== 'all' ? 'var(--brand)' : 'var(--ink-2)',
              fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            <option value="all">📍 All locations</option>
            {neighbourhoods.map(n => <option key={n} value={n}>📍 {n}</option>)}
          </select>
        )}

        {/* Clear filters */}
        {isFiltered && (
          <button
            onClick={() => { setTypeFilter('all'); setLocFilter('all'); setSortBy('default'); setSearch(''); }}
            style={{
              padding: '5px 11px', borderRadius: 'var(--r-pill)', fontSize: 12, cursor: 'pointer',
              border: '1px solid var(--down-soft)', background: 'transparent',
              color: 'var(--down)', fontFamily: 'inherit',
            }}
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* ─ Summary stats strip ─────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20,
      }}>
        {/* Assets count */}
        <div style={{
          padding: '14px 16px', borderRadius: 'var(--r-md)',
          background: 'var(--paper)', border: '0.5px solid var(--line)',
        }}>
          <div className="muted" style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            {isFiltered ? 'Filtered assets' : 'Total assets'}
          </div>
          <div className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            {summary.count}
          </div>
          {isFiltered && assets.length !== summary.count && (
            <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>of {assets.length} total</div>
          )}
        </div>

        {/* Cost basis */}
        <div style={{
          padding: '14px 16px', borderRadius: 'var(--r-md)',
          background: 'var(--paper)', border: '0.5px solid var(--line)',
        }}>
          <div className="muted" style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            Cost basis
          </div>
          <div className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            {fmtBase(summary.cost, profile.displayCurrency, { compact: true })}
          </div>
          <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>purchase price total</div>
        </div>

        {/* Current value */}
        <div style={{
          padding: '14px 16px', borderRadius: 'var(--r-md)',
          background: 'var(--paper)', border: '0.5px solid var(--line)',
        }}>
          <div className="muted" style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            Current value
          </div>
          <div className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            {fmtBase(summary.value, profile.displayCurrency, { compact: true })}
          </div>
          <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>today's estimate</div>
        </div>

        {/* Gain / Loss */}
        <div style={{
          padding: '14px 16px', borderRadius: 'var(--r-md)',
          background: summary.gain >= 0 ? 'var(--up-soft)' : 'var(--down-soft)',
          border: `0.5px solid ${summary.gain >= 0 ? 'color-mix(in oklab, var(--up) 25%, transparent)' : 'color-mix(in oklab, var(--down) 25%, transparent)'}`,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4,
            color: summary.gain >= 0 ? 'var(--up)' : 'var(--down)',
          }}>
            {summary.gain >= 0 ? '▲ Appreciation' : '▼ Depreciation'}
          </div>
          <div className="num" style={{
            fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em',
            color: summary.gain >= 0 ? 'var(--up)' : 'var(--down)',
          }}>
            {summary.gain >= 0 ? '+' : ''}{fmtBase(summary.gain, profile.displayCurrency, { compact: true })}
          </div>
          <div style={{
            fontSize: 11, fontWeight: 600, marginTop: 2,
            color: summary.gain >= 0 ? 'var(--up)' : 'var(--down)',
          }}>
            {summary.gain >= 0 ? '+' : ''}{summary.gainPct.toFixed(1)}% overall
          </div>
        </div>
      </div>

      {/* ─ Bulk-select banner ──────────────────────────────────── */}
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
          <button onClick={handleBulkDelete} style={{
            fontSize: 12, background: 'var(--down)', color: '#fff', border: 0,
            padding: '6px 14px', borderRadius: 7, cursor: 'pointer',
          }}>
            Delete {selected.size} asset{selected.size === 1 ? '' : 's'}
          </button>
        </div>
      )}

      {/* ─ Import result banner ────────────────────────────────── */}
      {importResult && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 16,
          background: importResult.kind === 'success' ? 'var(--up-soft)' : importResult.kind === 'partial' ? 'var(--gold-soft)' : 'var(--down-soft)',
          color: importResult.kind === 'success' ? 'var(--up)' : importResult.kind === 'partial' ? 'var(--gold)' : 'var(--down)',
          fontSize: 13, lineHeight: 1.5,
        }}>
          <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
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
              width: 24, height: 24, borderRadius: 6, border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 14,
            }}>×</button>
          </div>
        </div>
      )}

      {/* ─ Asset group cards ───────────────────────────────────── */}
      {filtered.map(g => {
        // Recompute group totals from filtered items only
        const gCost  = g.items.reduce((s, a) => s + costRWF(a), 0);
        const gValue = g.items.reduce((s, a) => s + valueRWF(a, today), 0);
        const gGain  = gValue - gCost;
        const gPct   = gCost ? (gGain / gCost) * 100 : 0;

        return (
          <div key={g.group} className="card" style={{ marginBottom: 14, padding: 0 }}>
            {/* Group header */}
            <div className="row" style={{ padding: '16px 22px', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                <div className="font-serif" style={{ fontSize: 17 }}>{g.group}</div>
                <span className="pill pill-soft">{g.items.length}</span>
              </div>
              <div className="row" style={{ gap: 14, fontSize: 12, flexWrap: 'wrap' }}>
                <div className="col" style={{ gap: 1, alignItems: 'flex-end' }}>
                  <span className="muted" style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Cost basis</span>
                  <span className="num" style={{ color: 'var(--ink-2)', fontWeight: 600 }}>
                    {fmtBase(gCost, profile.displayCurrency, { compact: true })}
                  </span>
                </div>
                <div className="col" style={{ gap: 1, alignItems: 'flex-end' }}>
                  <span className="muted" style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Value</span>
                  <span className="num" style={{ color: 'var(--ink)', fontWeight: 700 }}>
                    {fmtBase(gValue, profile.displayCurrency, { compact: true })}
                  </span>
                </div>
                <div className="col" style={{ gap: 1, alignItems: 'flex-end' }}>
                  <span className="muted" style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {gGain >= 0 ? 'Gain' : 'Loss'}
                  </span>
                  <span className="num" style={{
                    color: gGain >= 0 ? 'var(--up)' : 'var(--down)',
                    fontWeight: 600,
                  }}>
                    {gGain >= 0 ? '+' : ''}{fmtBase(gGain, profile.displayCurrency, { compact: true })}
                  </span>
                </div>
                <span className={`pill ${gGain >= 0 ? 'pill-up' : 'pill-down'}`} style={{ fontSize: 10, alignSelf: 'center' }}>
                  {gGain >= 0 ? '▲' : '▼'} {Math.abs(gPct).toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="hr" />

            {/* Column headers */}
            <div className="row muted" style={{
              display: 'grid', gridTemplateColumns: '28px 2.3fr 1fr 1.2fr 1.2fr 0.9fr 60px',
              padding: '8px 22px', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
              textTransform: 'uppercase', gap: 12, alignItems: 'center',
            }}>
              <input
                type="checkbox"
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
              <span>Name</span>
              <span>Bought</span>
              <span>Today's value</span>
              <span>In {profile.displayCurrency}</span>
              <span style={{ textAlign: 'right' }}>P/L</span>
              <span />
            </div>
            <div className="hr" />

            {/* Asset rows */}
            {g.items.map((a, i) => (
              <React.Fragment key={a.id}>
                {i > 0 && <div className="hr" style={{ margin: '0 22px' }} />}
                <AssetRow
                  asset={a}
                  displayCurrency={profile.displayCurrency}
                  isSelected={selected.has(a.id)}
                  onToggle={() => toggleOne(a.id)}
                  onEdit={asset => setEditing(asset)}
                  onDelete={asset => {
                    if (confirm(`Delete "${asset.name}"?`)) dispatch({ type: 'deleteAsset', id: asset.id });
                  }}
                />
              </React.Fragment>
            ))}
          </div>
        );
      })}

      {/* ─ Empty state ─────────────────────────────────────────── */}
      {filtered.length === 0 && assets.length > 0 && (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
          <div className="font-serif" style={{ fontSize: 20, marginBottom: 6 }}>No assets match this filter</div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 18 }}>Try a different asset type, location, or search term.</div>
          <button
            onClick={() => { setTypeFilter('all'); setLocFilter('all'); setSortBy('default'); setSearch(''); }}
            className="btn btn-ghost"
          >
            Clear all filters
          </button>
        </div>
      )}

      {filtered.length === 0 && assets.length === 0 && (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <div className="font-serif" style={{ fontSize: 22, marginBottom: 8 }}>No assets yet</div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 18 }}>
            Start by adding your first asset — a plot, vehicle, savings account, or anything else.
          </div>
          <button onClick={() => setEditing({})} className="btn btn-primary">＋ Add your first asset</button>
        </div>
      )}

      {editing && (
        <AssetEditor
          asset={editing}
          onSave={a => { dispatch({ type: 'upsertAsset', asset: a }); setEditing(null); }}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}
