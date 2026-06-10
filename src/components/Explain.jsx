import { useState } from 'react';

/**
 * Explain — the education layer's inline explainer (F9).
 * Renders small "ⓘ term" chips; activating one opens a plain-language
 * explanation inline (not a hover tooltip — works on touch, keyboard, and
 * screen readers). One open at a time.
 *
 * Props: entries — output of glossaryFor(): [{ id, term, short, body }]
 */
export default function Explain({ entries = [], style }) {
  const [openId, setOpenId] = useState(null);
  if (!entries.length) return null;
  const open = entries.find(e => e.id === openId);

  return (
    <div style={style}>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Learn</span>
        {entries.map(e => (
          <button
            key={e.id}
            type="button"
            onClick={() => setOpenId(openId === e.id ? null : e.id)}
            aria-expanded={openId === e.id}
            aria-controls={openId === e.id ? `explain-${e.id}` : undefined}
            title={e.short}
            style={{
              padding: '3px 10px', borderRadius: 20, cursor: 'pointer',
              fontSize: 10.5, fontWeight: 600, fontFamily: 'inherit',
              background: openId === e.id ? 'var(--brand)' : 'var(--bg-2)',
              color: openId === e.id ? 'var(--brand-ink)' : 'var(--ink-2)',
              border: '0.5px solid var(--line)',
              transition: 'background 0.14s, color 0.14s',
            }}
          >
            <span aria-hidden="true" style={{ marginRight: 4 }}>ⓘ</span>{e.term}
          </button>
        ))}
      </div>
      {open && (
        <div
          id={`explain-${open.id}`}
          role="note"
          style={{
            marginTop: 8, padding: '10px 14px', borderRadius: 8,
            background: 'var(--bg-2)', fontSize: 12, lineHeight: 1.6, color: 'var(--ink-2)',
            animation: 'imari-slideUp 200ms cubic-bezier(0.23,1,0.32,1) both',
          }}
        >
          <strong style={{ color: 'var(--ink)' }}>{open.term}.</strong> {open.body}
        </div>
      )}
    </div>
  );
}
