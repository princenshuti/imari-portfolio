/**
 * Modal — accessible dialog primitive.
 *
 * Handles overlay, scrim, ESC-to-close, click-outside, focus trap, focus
 * restoration, and reduced-motion compliance. Renders children inside a card.
 *
 * Callers supply their own header / body / footer markup — Modal only owns
 * the chrome and a11y wiring.
 */
import { useEffect, useId, useRef } from 'react';

const FOCUSABLE = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export default function Modal({
  open = true,
  onClose,
  title,
  maxWidth = 720,
  children,
  scrimVariant = 'default', // 'default' | 'image'
  initialFocusRef,
}) {
  const labelId = useId();
  const cardRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement;

    // Focus first focusable inside (or the card itself) on mount
    const t = setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }
      const focusables = cardRef.current?.querySelectorAll(FOCUSABLE);
      if (focusables?.length) focusables[0].focus();
      else cardRef.current?.focus();
    }, 0);

    return () => {
      clearTimeout(t);
      // Restore focus to whatever opened the modal
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, [open, initialFocusRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab') return;
      // Focus trap
      const focusables = cardRef.current?.querySelectorAll(FOCUSABLE);
      if (!focusables?.length) return;
      const first = focusables[0];
      const last  = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const scrim = scrimVariant === 'image' ? 'var(--scrim-image)' : 'var(--scrim)';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: scrim, backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2147483640, padding: 20,
      }}
    >
      <div
        ref={cardRef}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? labelId : undefined}
        tabIndex={-1}
        className="card"
        style={{
          width: '100%', maxWidth, maxHeight: '90vh', overflow: 'auto',
          padding: 28, background: 'var(--paper)', boxShadow: 'var(--shadow-pop)',
          outline: 'none',
        }}
      >
        {title && <span id={labelId} style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>{title}</span>}
        {children}
      </div>
    </div>
  );
}

/**
 * ImageLightbox — full-bleed image viewer modal. Black scrim, no card chrome.
 */
export function ImageLightbox({ open, onClose, src, alt = '' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt || 'Image preview'}
      style={{
        // Above any other modal — lightbox is always the topmost layer
        position: 'fixed', inset: 0, background: 'var(--scrim-image)', zIndex: 2147483646,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        cursor: 'zoom-out',
      }}
    >
      <img src={src} alt={alt} style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 10 }} />
    </div>
  );
}
