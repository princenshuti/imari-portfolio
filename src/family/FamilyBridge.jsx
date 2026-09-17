// FamilyBridge — renders nothing; exists so the whole family data layer
// (hooks, planning, context, cloud) loads as a LAZY chunk only for entitled
// households. App mounts it behind React.lazy and receives the bundle through
// onChange; the insight engine and the floating advisor read everything they
// need (rules, id set, summary, tool runner) from that bundle, so the main
// bundle never imports src/family/*.
import { useEffect } from 'react';
import { useFamilyBundle } from './useFamilyBundle.js';

export default function FamilyBridge({ portfolioId, role, onChange }) {
  const bundle = useFamilyBundle(portfolioId, role, true);
  useEffect(() => { onChange(bundle); return () => onChange(null); }, [bundle, onChange]);
  return null;
}
