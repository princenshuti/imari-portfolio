/**
 * AssetIcon — crisp SVG icons for every Imari asset category.
 * All icons are 24×24 viewBox, stroke-based (fill: none),
 * strokeWidth 1.75, round linecap/join — consistent Lucide-style.
 */

const ICONS = {

  /* ── Real estate ──────────────────────────────────────────── */
  'realestate-land': (
    /* Map with fold lines — represents a land parcel / cadastral plot */
    <>
      <polygon points="3 7 9 4 15 7 21 4 21 17 15 20 9 17 3 20" />
      <line x1="9" y1="4" x2="9" y2="17" />
      <line x1="15" y1="7" x2="15" y2="20" />
    </>
  ),

  'realestate-house': (
    /* Classic pitched roof house */
    <>
      <path d="M3 9.5 L12 3 L21 9.5 V20 A1 1 0 0 1 20 21 H4 A1 1 0 0 1 3 20 Z" />
      <polyline points="9 21 9 13 15 13 15 21" />
    </>
  ),

  /* ── Vehicles ─────────────────────────────────────────────── */
  'vehicle': (
    /* Side-on car silhouette */
    <>
      <path d="M5 11 L7 6 H17 L19 11" />
      <rect x="2" y="11" width="20" height="7" rx="2" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
      <line x1="9" y1="18" x2="15" y2="18" />
    </>
  ),

  /* ── Livestock ────────────────────────────────────────────── */
  'livestock': (
    /* Stylised cow head — ears, muzzle, horns */
    <>
      {/* Head */}
      <ellipse cx="12" cy="13" rx="6" ry="5" />
      {/* Horns */}
      <path d="M8 9 C7 6 5 5 4 6" />
      <path d="M16 9 C17 6 19 5 20 6" />
      {/* Ears */}
      <path d="M6.5 10 C5 10 4.5 12 6 12" />
      <path d="M17.5 10 C19 10 19.5 12 18 12" />
      {/* Muzzle */}
      <ellipse cx="12" cy="16" rx="3" ry="2" />
      {/* Nostrils */}
      <circle cx="10.5" cy="16" r="0.5" fill="currentColor" />
      <circle cx="13.5" cy="16" r="0.5" fill="currentColor" />
    </>
  ),

  /* ── Stocks ───────────────────────────────────────────────── */
  'rse-equity': (
    /* Candlestick chart — RSE trading */
    <>
      <line x1="9" y1="3"  x2="9"  y2="5"  />
      <rect x="6"  y="5"  width="6" height="6" rx="0.5" />
      <line x1="9" y1="11" x2="9"  y2="14" />
      <line x1="15" y1="6" x2="15" y2="8"  />
      <rect x="12" y="8"  width="6" height="7" rx="0.5" />
      <line x1="15" y1="15" x2="15" y2="18" />
      <line x1="4"  y1="21" x2="20" y2="21" />
    </>
  ),

  'foreign-equity': (
    /* Globe with latitude + longitude lines — international markets */
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <path d="M12 3 C9 6 9 18 12 21" />
      <path d="M12 3 C15 6 15 18 12 21" />
      <path d="M4.2 8 C6.5 9 9 9.5 12 9.5 S17.5 9 19.8 8" />
      <path d="M4.2 16 C6.5 15 9 14.5 12 14.5 S17.5 15 19.8 16" />
    </>
  ),

  /* ── Fixed income ─────────────────────────────────────────── */
  'bond': (
    /* Shield — protection, fixed-income security */
    <>
      <path d="M12 3 L4 7 V12 C4 17 7.5 20.5 12 22 C16.5 20.5 20 17 20 12 V7 Z" />
      <polyline points="9 12 11 14 15 10" />
    </>
  ),

  /* ── Cash & savings ───────────────────────────────────────── */
  'savings': (
    /* Bank / landmark — classical columns */
    <>
      <line x1="3" y1="22" x2="21" y2="22" />
      <line x1="5" y1="22" x2="5"  y2="12" />
      <line x1="9" y1="22" x2="9"  y2="12" />
      <line x1="15" y1="22" x2="15" y2="12" />
      <line x1="19" y1="22" x2="19" y2="12" />
      <rect x="3" y="10" width="18" height="2" />
      <polygon points="12 2 2 10 22 10" />
    </>
  ),

  'momo-cash': (
    /* Smartphone with signal waves — mobile money */
    <>
      <rect x="7" y="2" width="10" height="18" rx="2" />
      <line x1="11" y1="18" x2="13" y2="18" />
      {/* Signal arcs */}
      <path d="M3 7 C4.5 5 7 4 9 4" />
      <path d="M21 7 C19.5 5 17 4 15 4" />
      <path d="M1 10 C3 7 7 5.5 10 5.5" />
      <path d="M23 10 C21 7 17 5.5 14 5.5" />
    </>
  ),

  /* ── Crypto ───────────────────────────────────────────────── */
  'crypto': (
    /* Diamond / gem — crypto crystal */
    <>
      <path d="M6 3 H18 L22 9 L12 22 L2 9 Z" />
      <line x1="2" y1="9" x2="22" y2="9" />
      <line x1="6" y1="3"  x2="12" y2="22" />
      <line x1="18" y1="3" x2="12" y2="22" />
      <line x1="6" y1="3"  x2="2"  y2="9"  />
      <line x1="18" y1="3" x2="22" y2="9"  />
    </>
  ),

  /* ── Commodities ──────────────────────────────────────────── */
  'gold': (
    /* Stacked bars / bullion ingots */
    <>
      <rect x="3"  y="15" width="18" height="5" rx="1.5" />
      <rect x="5"  y="10" width="14" height="5" rx="1.5" />
      <rect x="7"  y="5"  width="10" height="5" rx="1.5" />
    </>
  ),

  /* ── Business ─────────────────────────────────────────────── */
  'business': (
    /* Briefcase */
    <>
      <rect x="2" y="8" width="20" height="13" rx="2" />
      <path d="M16 8 V6 A2 2 0 0 0 14 4 H10 A2 2 0 0 0 8 6 V8" />
      <line x1="2" y1="14" x2="22" y2="14" />
    </>
  ),

  /* ── Receivables ──────────────────────────────────────────── */
  'receivable': (
    /* Arrows + circle — money owed / loan transfer */
    <>
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2"  x2="12" y2="8"  />
      <polyline points="9 5 12 2 15 5" />
      <line x1="12" y1="16" x2="12" y2="22" />
      <polyline points="15 19 12 22 9 19" />
    </>
  ),

  /* ── Other ────────────────────────────────────────────────── */
  'other': (
    /* Package / box — miscellaneous asset */
    <>
      <polyline points="21 8 12 3 3 8" />
      <line x1="12" y1="3"  x2="12" y2="22" />
      <path d="M3 8 V19 A1 1 0 0 0 4 20 L12 22 L20 20 A1 1 0 0 0 21 19 V8" />
      <polyline points="7.5 5.5 12 8 16.5 5.5" />
    </>
  ),
};

/**
 * AssetIcon renders a square tile with a colored background and the
 * category SVG icon centred inside it.
 *
 * Props:
 *   kind  — asset kind string (e.g. 'realestate-land')
 *   color — CSS color string for icon + background tint
 *   size  — tile size in px (default 38)
 */
export default function AssetIcon({ kind, color = 'var(--brand)', size = 38 }) {
  const icon = ICONS[kind] || ICONS['other'];
  const iconSize = Math.round(size * 0.55); // SVG is 55% of tile

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: Math.round(size * 0.28),
      background: `color-mix(in oklab, ${color} 15%, transparent)`,
      border: `0.5px solid color-mix(in oklab, ${color} 25%, transparent)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      <svg
        viewBox="0 0 24 24"
        width={iconSize}
        height={iconSize}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {icon}
      </svg>
    </div>
  );
}
