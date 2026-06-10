import { useState, useRef, useEffect, useMemo } from 'react';
import { searchPortfolio } from '../services/search.js';
import { useT } from '../contexts/I18nContext.jsx';

const TYPE_GLYPH = { asset: '◆', liability: '↓', goal: '◎', cashflow: '⇄', view: '▸' };

// F8 — global search in the TopBar. Pure lookup over the in-memory state via
// searchPortfolio(); ⌘K / Ctrl-K focuses, arrows navigate, Enter jumps to the
// owning view, Escape closes. Results use onMouseDown so a click lands before
// the input's blur closes the panel.
export default function GlobalSearch({ state, onNav }) {
  const { t } = useT();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  const results = useMemo(() => searchPortfolio(state, q), [state, q]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { setActive(0); }, [q]);

  const go = (r) => {
    if (!r) return;
    onNav?.(r.to);
    setQ('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(results[active]); }
    else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
  };

  const showPanel = open && q.trim().length >= 2;

  return (
    <div className="global-search" style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls="global-search-results"
        aria-activedescendant={showPanel && results[active] ? `gsr-${results[active].type}-${results[active].id}` : undefined}
        aria-label={t('search.label')}
        placeholder={t('search.placeholder')}
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        style={{
          padding: '7px 12px', borderRadius: 'var(--r-md)',
          border: '0.5px solid var(--line-strong)', background: 'var(--bg-2)',
          fontSize: 12, fontFamily: 'inherit', color: 'var(--ink)', width: 170,
        }}
      />
      {showPanel && (
        <div
          id="global-search-results"
          role="listbox"
          aria-label={t('search.label')}
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 320, maxWidth: '90vw',
            background: 'var(--paper)', border: '0.5px solid var(--line-strong)',
            borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-2)', zIndex: 60,
            overflow: 'hidden',
          }}
        >
          {results.length === 0 ? (
            <div className="muted" style={{ padding: '14px 16px', fontSize: 12 }}>{t('search.no_results')}</div>
          ) : results.map((r, i) => (
            <div
              key={`${r.type}-${r.id}`}
              id={`gsr-${r.type}-${r.id}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); go(r); }}
              onMouseEnter={() => setActive(i)}
              style={{
                display: 'flex', gap: 10, alignItems: 'center', padding: '9px 14px',
                cursor: 'pointer', background: i === active ? 'var(--bg-2)' : 'transparent',
              }}
            >
              <span aria-hidden="true" style={{ fontSize: 13, color: 'var(--brand)', flexShrink: 0 }}>{TYPE_GLYPH[r.type] || '•'}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                <div className="muted" style={{ fontSize: 10.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.subtitle}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
