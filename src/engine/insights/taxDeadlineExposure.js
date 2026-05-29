// taxDeadlineExposure — the next RRA obligation (Fixed Asset Tax · 31 March,
// Vehicle Road-Maintenance Levy · 31 December), days-to-deadline, and the late
// penalty if missed. Surfaces in the dashboard as a Cost-of-Absence card.

import { REFERENCE } from './refs.js';
import { makeInsight, inputsAsOf } from './_shared.js';
import { valueRWF, fixedAssetTax, FIXED_ASSET_TAX, VEHICLE_CATEGORIES } from '../../data.js';

const HORIZON_DAYS = 120;

function nextAnnual(month, day, now) {
  const y = now.getFullYear();
  let d = new Date(y, month, day, 23, 59, 59);
  if (d < now) d = new Date(y + 1, month, day, 23, 59, 59);
  return d;
}

export default function taxDeadlineExposure(state, { now = new Date() } = {}) {
  const assets = state.assets || [];
  const candidates = [];

  // ── Fixed Asset Tax (immovable property) — declaration/payment 31 March ──
  const properties = assets.filter(a => a.kind === 'realestate-land' || a.kind === 'realestate-house');
  if (properties.length) {
    let tax = 0; const ids = [];
    for (const a of properties) {
      const r = fixedAssetTax(a, valueRWF(a, now));
      if (r.tax > 0) { tax += r.tax; ids.push(a.id); }
    }
    if (tax > 0) {
      candidates.push({
        kind: 'fat', label: 'RRA Fixed Asset Tax',
        deadline: nextAnnual(2, 31, now), amount: tax, ids,
      });
    }
  }

  // ── Vehicle Road-Maintenance Levy — due 31 December ──
  const vehicles = assets.filter(a => a.kind === 'vehicle');
  if (vehicles.length) {
    let levy = 0; const ids = [];
    for (const a of vehicles) {
      const cat = VEHICLE_CATEGORIES.find(v => v.id === a.vehicleCategory);
      levy += cat?.levy ?? 50_000; // default to car-class levy when uncategorised
      ids.push(a.id);
    }
    if (levy > 0) {
      candidates.push({
        kind: 'levy', label: 'Vehicle Road-Maintenance Levy',
        deadline: nextAnnual(11, 31, now), amount: levy, ids,
      });
    }
  }

  if (candidates.length === 0) return null;

  // Nearest upcoming obligation.
  candidates.sort((a, b) => a.deadline - b.deadline);
  const next = candidates[0];
  const days = Math.ceil((next.deadline - now) / 86400000);
  if (days > HORIZON_DAYS) return null; // too far out to nag

  const penalty = Math.round(next.amount * FIXED_ASSET_TAX.latePenalties[0]); // first bracket ~10%
  const severity = days <= 14 ? 'critical' : days <= 60 ? 'warning' : 'info';
  const rwfStr = n => `RWF ${Math.round(n).toLocaleString('en-US')}`;

  return makeInsight({
    id: 'tax-deadline-exposure',
    type: 'foresight',
    category: 'tax',
    headline: `${next.label} in ${days} days`,
    body: `${next.label} of about ${rwfStr(next.amount)} is due ${next.deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.`,
    costOfAbsence: {
      severity,
      amount: penalty,
      costStatement: `Miss it and the late penalty starts at ${rwfStr(penalty)}, then accrues ${(FIXED_ASSET_TAX.lateInterestMonthly * 100).toFixed(1)}%/month interest.`,
      action: { label: 'Open Tax Report', to: 'tax' },
    },
    sourceRefs: next.ids,
    dataAsOf: inputsAsOf(state, next.ids, now),
    now,
  });
}
