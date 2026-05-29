import React, { useState, useMemo, useRef, useEffect } from 'react';
import { CLASSES, valueRWF, costRWF, fmtBase } from '../data.js';
import AssetRow from '../components/AssetRow.jsx';
import AssetEditor from '../components/AssetEditor.jsx';
import { ConfirmDestructive } from '../components/ConfirmDestructive.jsx';
import { downloadAssetTemplate, parseAssetExcel, findExistingByNaturalKey } from '../excel.js';
import { useRovingFocus } from '../hooks/useRovingFocus.js';

// Canonical group order from CLASSES definition
const ALL_GROUPS = Array.from(new Set(CLASSES.map(c => c.group)));

// Page size for the asset list (B5). Config constant so it's easy to tune.
const PAGE_SIZE = 10;

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

export default function AssetsView({ state, dispatch, showToast }) {
  const { assets, profile } = state;
  const [editing, setEditing]           = useState(null);
  const [typeFilter, setTypeFilter]     = useState('all');
  const [locationFilter, setLocFilter]  = useState('all');
  const [sortBy, setSortBy]             = useState('default');
  const [search, setSearch]             = useState('');
  const [importResult, setImportResult] = useState(null);
  const [selected, setSelected]         = useState(new Set());
  // Pending destructive action awaiting modal confirm. `{kind:'single', asset}` for row deletes,
  // `{kind:'bulk', ids}` for bulk-action-bar deletes. Null = no modal.
  const [pendingDelete, setPendingDelete] = useState(null);
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
    setPendingDelete({ kind: 'bulk', ids: new Set(selected) });
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

  // Flat ordered list across all filtered groups — drives pagination + roving focus.
  const flatAssets = useMemo(() => filtered.flatMap(g => g.items), [filtered]);

  // ── Pagination (B5) — paginate the filtered/sorted RESULT, 10 per page ──
  const [page, setPage] = useState(1);
  const listRef = useRef(null);
  const focusFirstRowRef = useRef(false);
  // Reset to page 1 whenever the filtered/sorted set changes.
  useEffect(() => { setPage(1); }, [typeFilter, locationFilter, sortBy, search]);

  const totalPages = Math.max(1, Math.ceil(flatAssets.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  useEffect(() => { if (page !== safePage) setPage(safePage); }, [safePage]); // clamp when result shrinks
  const pageStart  = (safePage - 1) * PAGE_SIZE;
  const pageItems  = useMemo(
    () => flatAssets.slice(pageStart, pageStart + PAGE_SIZE),
    [flatAssets, pageStart],
  );
  // After Prev/Next, move focus to the first row of the new page (FR-ASSET-7).
  useEffect(() => {
    if (!focusFirstRowRef.current) return;
    focusFirstRowRef.current = false;
    listRef.current?.querySelector('.asset-row-focusable')?.focus();
  }, [safePage]);
  const goToPage = (p) => { focusFirstRowRef.current = true; setPage(Math.min(Math.max(1, p), totalPages)); };

  // Re-bucket the current page's items into their groups for display. Group
  // headers use the FULL filtered group (allItems) so totals stay meaningful
  // when a group spans pages; only the page's rows render.
  const pagedGroups = useMemo(() => {
    const pageSet = new Set(pageItems.map(a => a.id));
    return filtered
      .map(g => ({ ...g, allItems: g.items, items: g.items.filter(a => pageSet.has(a.id)) }))
      .filter(g => g.items.length > 0);
  }, [filtered, pageItems]);

  // "Select all visible" = current page; the bulk bar offers an explicit
  // "select all N" across the whole filtered set.
  const visibleIds     = useMemo(() => new Set(pageItems.map(a => a.id)), [pageItems]);
  const allFilteredIds = useMemo(() => new Set(flatAssets.map(a => a.id)), [flatAssets]);

  // Keyboard nav across the current page's rows in render order.
  const { containerProps, getItemProps } = useRovingFocus(pageItems.length, {
    onActivate: (i) => { const a = pageItems[i]; if (a) setEditing(a); },
    onItemKeyDown: (e, i) => {
      const a = pageItems[i];
      if (!a) return;
      if (e.key === 'e' || e.key === 'E') { e.preventDefault(); setEditing(a); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); setPendingDelete({ kind: 'single', asset: a }); }
      else if (e.key === ' ') { e.preventDefault(); toggleOne(a.id); }
    },
  });

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
            <button type="button" onClick={() => setSearch('')} aria-label="Clear search" style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 14, padding: 0 }}><span aria-hidden="true">×</span></button>
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

      {/* ─ Bulk-select banner — sticky so it follows the user while scrolling
            through the table. Shows count + summed value so users see exactly
            what they're about to delete. (UX review #22.) */}
      {someSelected && (() => {
        const today = new Date();
        const selectedTotal = assets
          .filter(a => selected.has(a.id))
          .reduce((s, a) => s + valueRWF(a, today), 0);
        return (
          <div
            role="region"
            aria-label="Bulk actions"
            style={{
              position: 'sticky', top: 8, zIndex: 30,
              padding: '12px 16px', borderRadius: 10, marginBottom: 12,
              background: 'var(--down-soft)',
              border: '1px solid color-mix(in oklab, var(--down) 30%, transparent)',
              boxShadow: 'var(--shadow-2)',
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--down)', fontWeight: 600, flex: 1, minWidth: 200 }}>
              {selected.size} asset{selected.size === 1 ? '' : 's'} selected
              <span className="num" style={{ fontWeight: 500, opacity: 0.85, marginLeft: 8 }}>
                · {fmtBase(selectedTotal, profile.displayCurrency, { compact: true })} total value
              </span>
            </span>
            {selected.size < allFilteredIds.size && (
              <button onClick={() => setSelected(new Set(allFilteredIds))} className="btn btn-ghost" style={{ fontSize: 12 }}>
                Select all {allFilteredIds.size}
              </button>
            )}
            <button onClick={() => setSelected(new Set())} className="btn btn-ghost" style={{ fontSize: 12 }}>
              Deselect all
            </button>
            <button type="button" onClick={handleBulkDelete} className="btn btn-danger btn-sm">
              Delete {selected.size} asset{selected.size === 1 ? '' : 's'}
            </button>
          </div>
        );
      })()}

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
            <button type="button" onClick={() => setImportResult(null)} aria-label="Dismiss import result" style={{
              width: 24, height: 24, borderRadius: 6, border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 14,
            }}><span aria-hidden="true">×</span></button>
          </div>
        </div>
      )}

      {/* ─ Asset group cards ─ wrapped in a single keyboard-nav region
            so arrow keys move focus across groups in render order. */}
      <div
        {...containerProps}
        ref={listRef}
        role="listbox"
        aria-label="Assets — use arrow keys to navigate, Enter to edit, Delete to remove, Space to select"
      >
      {pagedGroups.map(g => {
        // Group header totals reflect the FULL filtered group, even when the
        // group spans pages; only g.items (the current page slice) renders.
        const gCost  = g.allItems.reduce((s, a) => s + costRWF(a), 0);
        const gValue = g.allItems.reduce((s, a) => s + valueRWF(a, today), 0);
        const gGain  = gValue - gCost;
        const gPct   = gCost ? (gGain / gCost) * 100 : 0;

        return (
          <div key={g.group} className="card" style={{ marginBottom: 14, padding: 0 }}>
            {/* Group header */}
            <div className="row" style={{ padding: '16px 22px', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                <div className="font-serif" style={{ fontSize: 17 }}>{g.group}</div>
                <span className="pill pill-soft">{g.allItems.length}</span>
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
              display: 'grid', gridTemplateColumns: '28px 2.3fr 1fr 1.2fr 1.2fr 0.9fr 80px',
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
            {g.items.map((a, i) => {
              // Resolve the row's index within the current page so roving
              // focus moves across group boundaries on this page.
              const flatIdx = pageItems.indexOf(a);
              return (
                <React.Fragment key={a.id}>
                  {i > 0 && <div className="hr" style={{ margin: '0 22px' }} />}
                  <AssetRow
                    asset={a}
                    displayCurrency={profile.displayCurrency}
                    isSelected={selected.has(a.id)}
                    onToggle={() => toggleOne(a.id)}
                    onEdit={asset => setEditing(asset)}
                    onDelete={asset => setPendingDelete({ kind: 'single', asset })}
                    onSaveValue={(asset, newValue) =>
                      dispatch({ type: 'upsertAsset', asset: { ...asset, currentValue: newValue } })
                    }
                    rowProps={getItemProps(flatIdx)}
                  />
                </React.Fragment>
              );
            })}
          </div>
        );
      })}
      </div>

      {/* ─ Pagination controls (B5) ────────────────────────────── */}
      {flatAssets.length > PAGE_SIZE && (
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
          <div className="muted" style={{ fontSize: 12 }}>
            Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, flatAssets.length)} of {flatAssets.length}
          </div>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <button type="button" className="btn btn-ghost btn-sm" disabled={safePage <= 1}
              onClick={() => goToPage(safePage - 1)} aria-label="Previous page">← Prev</button>
            <span className="muted num" style={{ fontSize: 12, minWidth: 96, textAlign: 'center' }}>
              Page {safePage} of {totalPages}
            </span>
            <button type="button" className="btn btn-ghost btn-sm" disabled={safePage >= totalPages}
              onClick={() => goToPage(safePage + 1)} aria-label="Next page">Next →</button>
          </div>
        </div>
      )}

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
          showToast={showToast}
        />
      )}

      <ConfirmDestructive
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete?.kind === 'single') {
            dispatch({ type: 'deleteAsset', id: pendingDelete.asset.id });
          } else if (pendingDelete?.kind === 'bulk') {
            dispatch({ type: 'bulkDeleteAssets', ids: pendingDelete.ids });
            setSelected(new Set());
          }
          setPendingDelete(null);
        }}
        title={
          pendingDelete?.kind === 'bulk'
            ? `Delete ${pendingDelete.ids.size} asset${pendingDelete.ids.size === 1 ? '' : 's'}?`
            : 'Delete this asset?'
        }
        description={
          pendingDelete?.kind === 'single' ? (
            <span>
              <strong style={{ color: 'var(--ink)' }}>{pendingDelete.asset.name}</strong>
              {' · '}
              <span className="num">{fmtBase(valueRWF(pendingDelete.asset, new Date()), profile.displayCurrency, { compact: true })}</span>
              <br />
              This removes the asset permanently. You can't undo this.
            </span>
          ) : (
            <span>
              This removes <strong style={{ color: 'var(--ink)' }}>{pendingDelete?.ids?.size}</strong> assets permanently.
              You can't undo this.
            </span>
          )
        }
        confirmLabel={
          pendingDelete?.kind === 'bulk'
            ? `Delete ${pendingDelete.ids.size}`
            : 'Delete asset'
        }
      />
    </div>
  );
}
