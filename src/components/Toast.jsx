import { useState, useCallback } from 'react';

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, showToast, dismiss };
}

const COLOURS = {
  error:   { bg: 'var(--down)',  text: '#fff' },
  success: { bg: 'var(--up)',    text: '#fff' },
  info:    { bg: 'var(--ink)',   text: 'var(--paper)' },
  warning: { bg: 'var(--gold)',  text: '#fff' },
};

export function ToastContainer({ toasts, dismiss }) {
  if (!toasts.length) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 20, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => {
        const c = COLOURS[t.type] || COLOURS.info;
        return (
          <div key={t.id} className="toast-item row" style={{
            padding: '12px 16px', borderRadius: 11, maxWidth: 340, gap: 10,
            background: c.bg, color: c.text,
            boxShadow: 'var(--shadow-pop)',
            pointerEvents: 'all', fontSize: 13, lineHeight: 1.4, fontWeight: 500,
          }}>
            <span style={{ flex: 1 }}>{t.message}</span>
            <button onClick={() => dismiss(t.id)} style={{
              background: 'transparent', border: 0, color: 'inherit',
              cursor: 'pointer', fontSize: 16, opacity: 0.7, padding: 0, lineHeight: 1,
            }}>×</button>
          </div>
        );
      })}
    </div>
  );
}
