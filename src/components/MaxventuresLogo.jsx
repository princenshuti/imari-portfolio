/**
 * MaxventuresLogo — SVG recreation of the Maxventures brand mark.
 *
 * The logo is an infinity symbol (∞) with a blue → purple → orange gradient,
 * with the left portion dissolving into scattered pixel squares.
 *
 * Exports:
 *   MaxventuresIcon   — compact square icon (sidebar / favicon use)
 *   MaxventuresBadge  — full horizontal logo with "MAXVENTURES" wordmark
 */

/**
 * Compact icon — infinity + pixels, no text. Fits in any square.
 * @param {number} size - width and height in px (default 36)
 * @param {string} id   - unique id prefix for gradient (avoid collisions)
 */
export function MaxventuresIcon({ size = 36, id = 'mv' }) {
  const gid = `${id}-grad`;
  const mid = `${id}-mask`;

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Maxventures"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        {/* Blue → Purple → Red → Orange horizontal gradient */}
        <linearGradient id={gid} x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%"   stopColor="#1848D8" />
          <stop offset="30%"  stopColor="#7030C4" />
          <stop offset="60%"  stopColor="#C82878" />
          <stop offset="100%" stopColor="#E85010" />
        </linearGradient>
      </defs>

      {/* ── Dispersing pixel squares (upper-left quadrant) ──────── */}
      {/* Larger squares — near the loop */}
      <rect x="3"  y="9"  width="6" height="6" rx="0.8" fill="#1848D8" opacity="0.95" />
      <rect x="11" y="4"  width="6" height="6" rx="0.8" fill="#E87820" opacity="0.92" />
      <rect x="3"  y="18" width="6" height="6" rx="0.8" fill="#1848D8" opacity="0.90" />
      <rect x="10" y="13" width="5" height="5" rx="0.7" fill="#1848D8" opacity="0.85" />
      <rect x="18" y="7"  width="5" height="5" rx="0.7" fill="#E87820" opacity="0.80" />

      {/* Medium squares */}
      <rect x="4"  y="27" width="4" height="4" rx="0.6" fill="#1848D8" opacity="0.78" />
      <rect x="11" y="22" width="4" height="4" rx="0.6" fill="#1848D8" opacity="0.72" />
      <rect x="19" y="15" width="4" height="4" rx="0.6" fill="#E87820" opacity="0.65" />
      <rect x="18" y="23" width="3" height="3" rx="0.5" fill="#1848D8" opacity="0.58" />

      {/* Small squares — dissolving effect */}
      <rect x="6"  y="33" width="3" height="3" rx="0.4" fill="#1848D8" opacity="0.50" />
      <rect x="13" y="29" width="3" height="3" rx="0.4" fill="#1848D8" opacity="0.42" />
      <rect x="22" y="30" width="2" height="2" rx="0.3" fill="#E87820" opacity="0.35" />
      <rect x="8"  y="39" width="2" height="2" rx="0.3" fill="#1848D8" opacity="0.28" />
      <rect x="16" y="35" width="2" height="2" rx="0.3" fill="#1848D8" opacity="0.22" />

      {/* ── Infinity symbol — stroked centerline path ─────────────── */}
      {/*
        Path traces the centerline of the infinity shape.
        Starting at the center crossover (32,32), going right/up:
          → top arc to right tip (56,32)
          → bottom arc back to center
          → top arc to left tip (8,32)
          → bottom arc back to center
      */}
      <path
        d="
          M 32 32
          C 34 20, 52 15, 56 32
          C 60 49, 36 44, 32 32
          C 28 20, 10 15, 8 32
          C 4 49, 30 44, 32 32
        "
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Full horizontal badge — icon + "MAXVENTURES" text with gradient.
 * Use in About / Settings footers, or wherever the full brand needs showing.
 */
export function MaxventuresBadge({ height = 44 }) {
  const scale = height / 44;
  return (
    <svg
      viewBox="0 0 320 44"
      height={height}
      width={320 * scale}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Maxventures"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id="mvb-grad" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%"   stopColor="#1848D8" />
          <stop offset="30%"  stopColor="#7030C4" />
          <stop offset="60%"  stopColor="#C82878" />
          <stop offset="100%" stopColor="#E85010" />
        </linearGradient>
      </defs>

      {/* ── Compact infinity icon (left side) ─────────────────── */}
      {/* Pixel squares scaled to 44-high context */}
      <rect x="1"  y="5"  width="4" height="4" rx="0.5" fill="#1848D8" opacity="0.90" />
      <rect x="7"  y="2"  width="4" height="4" rx="0.5" fill="#E87820" opacity="0.88" />
      <rect x="1"  y="11" width="4" height="4" rx="0.5" fill="#1848D8" opacity="0.85" />
      <rect x="6"  y="8"  width="3" height="3" rx="0.4" fill="#1848D8" opacity="0.78" />
      <rect x="11" y="4"  width="3" height="3" rx="0.4" fill="#E87820" opacity="0.70" />
      <rect x="2"  y="17" width="3" height="3" rx="0.4" fill="#1848D8" opacity="0.62" />
      <rect x="8"  y="14" width="2" height="2" rx="0.3" fill="#1848D8" opacity="0.50" />
      <rect x="12" y="10" width="2" height="2" rx="0.3" fill="#1848D8" opacity="0.38" />
      <rect x="4"  y="22" width="2" height="2" rx="0.3" fill="#1848D8" opacity="0.28" />

      {/* Infinity path */}
      <path
        d="
          M 22 22
          C 23 15, 36 11, 38 22
          C 40 33, 25 30, 22 22
          C 19 14, 6 11, 4 22
          C 2 33, 19 30, 22 22
        "
        fill="none"
        stroke="url(#mvb-grad)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* ── "MAXVENTURES" wordmark ────────────────────────────── */}
      <text
        x="52" y="30"
        fontFamily="'Geist', 'Arial Black', sans-serif"
        fontWeight="700"
        fontSize="22"
        letterSpacing="1.5"
        fill="url(#mvb-grad)"
      >MAXVENTURES</text>
    </svg>
  );
}
