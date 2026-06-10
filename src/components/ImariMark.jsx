/**
 * ImariMark — the one canonical product mark (design review #16 / round-3 #14).
 * The green rounded square with the serif dot, as established on Login and
 * the Landing nav. Use this everywhere a mark appears; the Maxventures
 * identity lives in footers as a monochrome wordmark, never a bitmap.
 */
export default function ImariMark({ size = 36, radius = null }) {
  return (
    <div aria-hidden="true" style={{
      width: size, height: size, borderRadius: radius ?? Math.round(size * 0.27),
      background: 'var(--brand)', color: 'var(--brand-ink)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Instrument Serif, serif', fontSize: size * 0.58, lineHeight: 1,
      flexShrink: 0, boxShadow: 'var(--shadow-brand)',
    }}>●</div>
  );
}

/** Monochrome Maxventures wordmark for footers — replaces the white-boxed PNG. */
export function MaxventuresWordmark({ fontSize = 12 }) {
  return (
    <span className="num" style={{
      fontSize, fontWeight: 700, letterSpacing: '0.18em',
      color: 'var(--ink-3)', textTransform: 'uppercase',
    }}>Maxventures</span>
  );
}
