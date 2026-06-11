import { useEffect, useRef, useState } from 'react';
import { motion, animate, useReducedMotion } from 'motion/react';

// Shared motion vocabulary for the app. One easing + one spring everywhere so
// every surface moves with the same physical character.
export const EASE_OUT = [0.22, 1, 0.36, 1];
export const SPRING = { type: 'spring', stiffness: 300, damping: 26, mass: 0.9 };

// ─── Scroll reveal ──────────────────────────────────────────────────────────
/** Fades + lifts content in the first time it scrolls into view. */
export function Reveal({ children, delay = 0, y = 22, amount = 0.12, style, ...rest }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.65, delay, ease: EASE_OUT }}
      style={style}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

// ─── Stagger variants ───────────────────────────────────────────────────────
// Usage: <motion.div variants={staggerParent} initial="hidden" whileInView="show"
//          viewport={{ once: true, amount: 0.2 }}> … <motion.div variants={staggerItem}>
export const staggerParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};
export const staggerItem = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: SPRING },
};

// ─── Stagger convenience wrappers ───────────────────────────────────────────
/**
 * <Stagger> + <StaggerItem> — declarative list entrance without per-view
 * variant boilerplate. Children cascade in on mount with the shared spring.
 *   <Stagger className="col" style={{gap:10}}>
 *     {items.map(x => <StaggerItem key={x.id}>…</StaggerItem>)}
 *   </Stagger>
 */
export function Stagger({ children, ...rest }) {
  return (
    <motion.div variants={staggerParent} initial="hidden" animate="show" {...rest}>
      {children}
    </motion.div>
  );
}
export function StaggerItem({ children, ...rest }) {
  return <motion.div variants={staggerItem} {...rest}>{children}</motion.div>;
}

// ─── Animated number ────────────────────────────────────────────────────────
/**
 * Counts a number up (or down) to `value` whenever it changes, formatting each
 * frame with `format`. Renders the final value immediately for users who
 * prefer reduced motion.
 */
export function CountUp({ value, format, duration = 1.1, className, style }) {
  const reduce = useReducedMotion();
  const fmtRef = useRef(format);
  fmtRef.current = format;
  const fromRef = useRef(reduce ? value : 0);
  const [display, setDisplay] = useState(() => fmtRef.current(fromRef.current));

  useEffect(() => {
    if (reduce || fromRef.current === value) {
      fromRef.current = value;
      setDisplay(fmtRef.current(value));
      return;
    }
    const controls = animate(fromRef.current, value, {
      duration,
      ease: EASE_OUT,
      onUpdate: v => setDisplay(fmtRef.current(v)),
    });
    fromRef.current = value;
    return () => controls.stop();
  }, [value, reduce, duration]);

  return <span className={className} style={style}>{display}</span>;
}

// ─── GPU-friendly bar fill ──────────────────────────────────────────────────
/**
 * Progress-bar fill that grows from the left on first view using scaleX
 * (transform-only, so it never causes layout work). Drop inside a track div
 * with overflow:hidden; pass the final width as `pct` (0–100).
 */
export function BarFill({ pct, color, height = '100%', radius = 2, delay = 0, title }) {
  const capped = Math.min(Math.max(pct, 0), 100);
  return (
    <motion.div
      title={title}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.9, delay, ease: EASE_OUT }}
      style={{
        height,
        width: capped + '%',
        background: color,
        borderRadius: radius,
        transformOrigin: 'left center',
      }}
    />
  );
}
