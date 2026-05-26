import { useState, useCallback } from 'react';

export function useToast() {
  const [toasts, setToasts] = useState([]);

  /**
   * showToast(message, type?, options?)
   *   options.action     { label, onClick }  — renders a button (e.g. Undo).
   *   options.duration   override the default visible window in ms.
   * Returns the toast id so the caller can dismiss programmatically.
   */
  const showToast = useCallback((message, type = 'info', options = {}) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, action: options.action }]);
    // Errors/warnings stay longer so screen-reader users can hear them.
    // Action toasts (undo) get the longer window too so the user has time to react.
    const defaultDuration = options.action ? 6000 : (type === 'error' || type === 'warning') ? 7000 : 4500;
    const duration = options.duration ?? defaultDuration;
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
    return id;
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, showToast, dismiss };
}

// White text on --gold (#C4932A) fails 4.5:1; use --ink for warning instead.
const COLOURS = {
  error:   { bg: 'var(--down)',  text: '#fff' },           // 5.5:1 — passes
  success: { bg: 'var(--up)',    text: '#fff' },           // 4.6:1 — passes
  info:    { bg: 'var(--ink)',   text: 'var(--paper)' },   // ~16:1 — passes
  warning: { bg: 'var(--gold)',  text: 'var(--ink)' },     // ~6:1 — passes (was '#fff' = 2.5:1, FAIL)
};

export function ToastContainer({ toasts, dismiss }) {
  if (!toasts.length) return null;
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      style={{
        position: 'fixed', bottom: 24, right: 20, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(t => {
        const c = COLOURS[t.type] || COLOURS.info;
        const isAlert = t.type === 'error' || t.type === 'warning';
        return (
          <div
            key={t.id}
            role={isAlert ? 'alert' : 'status'}
            className="toast-item row"
            style={{
              padding: '12px 16px', borderRadius: 11, maxWidth: 340, gap: 10,
              background: c.bg, color: c.text,
              boxShadow: 'var(--shadow-pop)',
              pointerEvents: 'all', fontSize: 13, lineHeight: 1.4, fontWeight: 500,
            }}
          >
            <span style={{ flex: 1 }}>{t.message}</span>
            {t.action && (
              <button
                onClick={() => { t.action.onClick?.(); dismiss(t.id); }}
                style={{
                  background: 'rgba(255,255,255,0.18)', border: 0, color: 'inherit',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  padding: '5px 10px', borderRadius: 6, lineHeight: 1,
                  marginRight: 2,
                }}
              >
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              style={{
                background: 'transparent', border: 0, color: 'inherit',
                cursor: 'pointer', fontSize: 16, opacity: 0.8, padding: 4, lineHeight: 1,
                minWidth: 24, minHeight: 24,
              }}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
