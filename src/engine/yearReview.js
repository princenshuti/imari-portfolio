// yearReview.js — net-worth year-in-review. Pure: deterministic given
// (snapshots, now). Distills the trailing 12 months of daily snapshots into a
// reflection — where the year started, where it ended, which months did the
// work — so the history users accrue every day is finally surfaced back.

/** Trailing-12-month window of snapshots (sorted ascending by date). */
function windowSnapshots(snapshots, now) {
  const cut = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const cutStr = `${cut.getFullYear()}-${String(cut.getMonth() + 1).padStart(2, '0')}-${String(cut.getDate()).padStart(2, '0')}`;
  return [...snapshots]
    .filter(s => s.date >= cutStr)
    .sort((a, b) => a.date.localeCompare(b.date));
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * @param {Array} snapshots  state.snapshots ({date, netWorth, costBasis, synthetic?})
 * @param {{ now?: Date }} opts
 * @returns {null | {
 *   start: {date, netWorth}, end: {date, netWorth},
 *   change: number, changePct: number|null,
 *   high: {date, netWorth}, low: {date, netWorth},
 *   months: Array<{ ym, label, endNetWorth, change, days }>,
 *   bestMonth: object|null, worstMonth: object|null,
 *   daysTracked: number, includesSynthetic: boolean,
 * }}  null when fewer than 2 real data points exist.
 */
export function buildYearReview(snapshots = [], { now = new Date() } = {}) {
  const snaps = windowSnapshots(snapshots, now);
  if (snaps.length < 2) return null;

  const start = snaps[0], end = snaps[snaps.length - 1];
  const change = end.netWorth - start.netWorth;
  const changePct = start.netWorth ? (change / Math.abs(start.netWorth)) * 100 : null;

  let high = snaps[0], low = snaps[0];
  for (const s of snaps) {
    if (s.netWorth > high.netWorth) high = s;
    if (s.netWorth < low.netWorth) low = s;
  }

  // Month buckets: last snapshot of each month is its closing value; a month's
  // change is measured against the previous month's close (or the window start).
  const byMonth = new Map();
  for (const s of snaps) {
    const ym = s.date.slice(0, 7);
    const cur = byMonth.get(ym) || { ym, last: s, days: 0 };
    cur.days += 1;
    if (s.date >= cur.last.date) cur.last = s;
    byMonth.set(ym, cur);
  }
  const ordered = [...byMonth.values()].sort((a, b) => a.ym.localeCompare(b.ym));
  let prevClose = start.netWorth;
  const months = ordered.map((m, i) => {
    const endNetWorth = m.last.netWorth;
    const chg = i === 0 ? endNetWorth - start.netWorth : endNetWorth - prevClose;
    prevClose = endNetWorth;
    return {
      ym: m.ym,
      label: MONTH_LABELS[Number(m.ym.slice(5, 7)) - 1],
      endNetWorth,
      change: chg,
      days: m.days,
    };
  });

  // Only months with more than one observation can claim a best/worst title —
  // a single stray snapshot says nothing about the month's motion.
  const eligible = months.filter(m => m.days > 1 || months.length === 1);
  const bestMonth = eligible.length
    ? eligible.reduce((a, b) => (b.change > a.change ? b : a)) : null;
  const worstMonth = eligible.length
    ? eligible.reduce((a, b) => (b.change < a.change ? b : a)) : null;

  return {
    start: { date: start.date, netWorth: start.netWorth },
    end: { date: end.date, netWorth: end.netWorth },
    change,
    changePct,
    high: { date: high.date, netWorth: high.netWorth },
    low: { date: low.date, netWorth: low.netWorth },
    months,
    bestMonth,
    worstMonth,
    daysTracked: snaps.length,
    includesSynthetic: snaps.some(s => s.synthetic),
  };
}
