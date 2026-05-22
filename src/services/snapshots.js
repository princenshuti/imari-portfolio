/**
 * snapshots.js — Daily portfolio value recorder.
 * Snapshots are stored inside the portfolio state (synced to cloud).
 * One snapshot per day; rolling window of ~400 entries (~13 months).
 */

const MAX = 400;

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Add (or update) today's snapshot. Returns new snapshots array. */
export function addSnapshot(snapshots = [], netWorth, costBasis) {
  const today = todayStr();
  const idx = snapshots.findIndex(s => s.date === today);
  const entry = { date: today, netWorth: Math.round(netWorth), costBasis: Math.round(costBasis) };
  let next;
  if (idx >= 0) {
    next = [...snapshots];
    next[idx] = entry;
  } else {
    next = [...snapshots, entry].sort((a, b) => a.date.localeCompare(b.date));
  }
  return next.slice(-MAX);
}

/** Filter snapshots to a time range. */
export function filterByRange(snapshots = [], range = '1Y') {
  const now = new Date();
  const cut = new Date(now);
  if (range === '1M') cut.setMonth(now.getMonth() - 1);
  else if (range === '3M') cut.setMonth(now.getMonth() - 3);
  else if (range === '6M') cut.setMonth(now.getMonth() - 6);
  else if (range === '1Y') cut.setFullYear(now.getFullYear() - 1);
  else return snapshots; // ALL
  const cutStr = cut.toISOString().slice(0, 10);
  return snapshots.filter(s => s.date >= cutStr);
}

/** Return % gain from first to last snapshot in set. */
export function calcReturn(snapshots = []) {
  if (snapshots.length < 2) return 0;
  const first = snapshots[0].netWorth;
  const last  = snapshots[snapshots.length - 1].netWorth;
  return first ? ((last - first) / first) * 100 : 0;
}

/** Seed synthetic history for demo (used on first load). */
export function seedHistory(currentNetWorth, currentCostBasis, days = 60) {
  const snapshots = [];
  const today = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const noise = 1 + (Math.sin(i * 0.4) * 0.03 + (Math.random() - 0.5) * 0.02);
    const ratio = (days - i) / days;
    const nw = Math.round(currentNetWorth * (0.88 + ratio * 0.12) * noise);
    const cb = Math.round(currentCostBasis * (0.92 + ratio * 0.08));
    snapshots.push({ date: d.toISOString().slice(0, 10), netWorth: nw, costBasis: cb });
  }
  return snapshots;
}
