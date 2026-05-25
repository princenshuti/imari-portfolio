/**
 * ConfirmDestructive — a confirmation modal for irreversible actions.
 *
 * Replaces native window.confirm() for delete/reset operations. Shows the
 * thing being deleted (name, value, count), uses distinct red styling, and
 * optionally requires the user to type a phrase ("DELETE") before the action
 * can run — for catastrophic operations.
 *
 * Props:
 *   open          — controls visibility
 *   onClose       — fired on Esc, backdrop click, or Cancel
 *   onConfirm     — fired when the user clicks the destructive button
 *   title         — short modal heading (e.g. "Delete asset?")
 *   description   — string or JSX explaining what's being removed
 *   confirmLabel  — destructive button text (default: "Delete")
 *   requireType   — if set, user must type this exact string to enable confirm
 *                   (use for Danger-Zone-level operations: pass "DELETE")
 *   loading       — disables the confirm button while an async op is in flight
 */
import { useEffect, useRef, useState } from 'react';

export function ConfirmDestructive({
  open,
  onClose,
  onConfirm,
  title         = 'Are you sure?',
  description,
  confirmLabel  = 'Delete',
  requireType   = null,
  loading       = false,
}) {
  const [typed, setTyped] = useState('');
  const inputRef = useRef(null);

  // Reset typed text + autofocus the right element each time the modal opens.
  useEffect(() => {
    if (!open) { setTyped(''); return; }
    const t = setTimeout(() => {
      if (requireType && inputRef.current) inputRef.current.focus();
    }, 30);
    return () => clearTimeout(t);
  }, [open, requireType]);

  // Esc closes the modal (parity with native confirm).
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !loading) onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onClose]);

  if (!open) return null;

  const canConfirm = requireType ? typed === requireType : true;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-destructive-title"
      onClick={() => !loading && onClose?.()}
      style={{
        position: 'fixed', inset: 0, zIndex: 2147483640,
        background: 'rgba(20, 20, 16, 0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        animation: 'imari-fade-in 0.15s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{
          maxWidth: 440, width: '100%',
          padding: 28,
          display: 'flex', flexDirection: 'column', gap: 16,
          background: 'var(--paper)',
        }}
      >
        {/* Header — warning icon + title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div
            aria-hidden="true"
            style={{
              flex: '0 0 auto', width: 38, height: 38, borderRadius: 10,
              background: 'var(--down-soft)', color: 'var(--down)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 700, lineHeight: 1,
            }}
          >!</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              id="confirm-destructive-title"
              className="font-serif"
              style={{ fontSize: 20, lineHeight: 1.2, margin: 0, letterSpacing: '-0.01em', color: 'var(--ink)' }}
            >
              {title}
            </h2>
            {description && (
              <div className="muted" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
                {description}
              </div>
            )}
          </div>
        </div>

        {/* Typed-confirm input (for catastrophic actions only) */}
        {requireType && (
          <div>
            <label style={{ fontSize: 11.5, color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>
              Type <strong style={{ color: 'var(--down)', fontFamily: 'var(--mono, monospace)' }}>{requireType}</strong> to confirm
            </label>
            <input
              ref={inputRef}
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 7,
                border: '1px solid var(--line-strong)',
                background: 'var(--paper-2)', color: 'var(--ink)',
                fontSize: 14, fontFamily: 'var(--mono, monospace)',
                outline: 'none', letterSpacing: '0.04em',
              }}
            />
          </div>
        )}

        {/* Action row */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn btn-ghost"
            style={{ padding: '9px 16px' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => canConfirm && onConfirm?.()}
            disabled={!canConfirm || loading}
            className="btn btn-danger"
            style={{
              padding: '9px 18px',
              opacity: (!canConfirm || loading) ? 0.5 : 1,
              cursor: (!canConfirm || loading) ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
