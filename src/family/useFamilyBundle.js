// useFamilyBundle — the app-level family data used by the insight engine and
// the floating advisor. Loads nothing unless the portfolio is entitled, and
// exposes the SAME write functions the screens use (RLS-scoped) as `api` so
// advisor tool calls cannot do anything a form couldn't.
import { useMemo } from 'react';
import { useFamily } from './useFamily.js';
import { useItems } from './useItems.js';

export function useFamilyBundle(portfolioId, role, enabled) {
  const pid = enabled ? portfolioId : null;
  const fam = useFamily(pid, role);
  const it = useItems(pid, role);
  return useMemo(() => {
    if (!pid) return null;
    return {
      logs: fam.logs, notes: fam.notes, items: it.items, canEdit: fam.canEdit,
      loading: fam.logs === null || it.items === null,
      api: { saveItem: it.save, setHabit: fam.toggleHabit, setNote: fam.saveNote },
    };
  }, [pid, fam.logs, fam.notes, fam.canEdit, fam.toggleHabit, fam.saveNote, it.items, it.save]);
}
