/**
 * Skeleton primitives — placeholder UI that mirrors final card geometry
 * during async loads. Better than centred "Loading…" text because the user
 * sees layout taking shape immediately and never wonders whether the app broke.
 *
 * The shimmer animation is defined globally in styles.css (`.skeleton` class).
 */

/**
 * Single shimmer block. Defaults to a one-line placeholder; pass width / height
 * to size it. All units are CSS strings (px, %, em, etc.).
 */
export function Skeleton({
  width  = '100%',
  height = 14,
  radius = 6,
  style  = {},
}) {
  return (
    <div
      aria-hidden="true"
      className="skeleton"
      style={{
        width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: typeof radius === 'number' ? `${radius}px` : radius,
        ...style,
      }}
    />
  );
}

/**
 * Card-sized skeleton — title row + body lines + a "stat" block.
 * Use to scaffold individual cards in a grid.
 */
export function CardSkeleton({ height = 140 }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="card"
      style={{
        padding: 16,
        minHeight: typeof height === 'number' ? `${height}px` : height,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width="40%" height={11} />
        <Skeleton width={48}  height={16} radius={20} />
      </div>
      <Skeleton width="55%" height={22} />
      <Skeleton width="100%" height={30} radius={4} />
      <Skeleton width="70%" height={10} />
    </div>
  );
}

/**
 * Inline page-area skeleton — fills the lazy-load gap without blanking the
 * whole viewport like the original FullScreenLoader did. Use as the Suspense
 * fallback for route-level lazy imports so the sidebar/topbar stay visible.
 *
 * Renders a title row + a grid of CardSkeletons; matches the typical
 * dashboard/assets/trends layout closely enough to feel like the right page
 * is about to appear.
 */
export function ViewSkeleton({ cards = 6, label = 'Loading view' }) {
  return (
    <div
      role="status"
      aria-label={label}
      style={{ padding: 28, background: 'var(--bg)', minHeight: 'calc(100vh - 70px)' }}
    >
      <div style={{ marginBottom: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton width={140} height={11} />
        <Skeleton width="40%" height={28} />
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 14,
      }}>
        {Array.from({ length: cards }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    </div>
  );
}

/**
 * Row-shaped skeleton for list views (member rows, asset rows, etc.)
 * Renders `count` placeholder rows with an avatar circle + two text lines.
 */
export function RowSkeleton({ count = 3, showAvatar = false }) {
  return (
    <div role="status" aria-label="Loading list" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 12px',
            borderRadius: 8,
            background: 'var(--bg-2)',
          }}
        >
          {showAvatar && <Skeleton width={32} height={32} radius="50%" />}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <Skeleton width="40%" height={12} />
            <Skeleton width="20%" height={10} />
          </div>
          <Skeleton width={56} height={22} radius={6} />
        </div>
      ))}
    </div>
  );
}
