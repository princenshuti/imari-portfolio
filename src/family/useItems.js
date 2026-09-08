// useItems — remote state for family_items: one load, live rows from the
// other member, optimistic writes that roll back by reloading on error.
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchItems, saveItem, setItemStatus, deleteItem, subscribeItems } from './items.js';

export function useItems(portfolioId, role) {
  const [items, setItems] = useState(null); // null while loading
  const [error, setError] = useState(null);
  const canEdit = role !== 'viewer';
  const alive = useRef(true);

  const reload = useCallback(async () => {
    if (!portfolioId) return;
    try { const rows = await fetchItems(portfolioId); if (alive.current) { setItems(rows); setError(null); } }
    catch (e) { if (alive.current) setError(e.message || 'Could not load family items'); }
  }, [portfolioId]);

  useEffect(() => {
    alive.current = true;
    setItems(null);
    reload();
    const off = subscribeItems(portfolioId, (p) => {
      setItems(prev => {
        const list = prev || [];
        if (p.eventType === 'DELETE') return list.filter(i => i.id !== p.old?.id);
        const row = p.new; if (!row?.id) return list;
        const idx = list.findIndex(i => i.id === row.id);
        return idx === -1 ? [...list, row] : list.map(i => (i.id === row.id ? row : i));
      });
    });
    return () => { alive.current = false; off(); };
  }, [portfolioId, reload]);

  const fail = (e) => { setError(e.message || 'Save failed'); reload(); throw e; };

  const save = useCallback(async (form) => {
    if (!canEdit) throw new Error('View-only access');
    const row = await saveItem(portfolioId, form).catch(fail);
    setItems(prev => { const list = prev || []; return list.some(i => i.id === row.id) ? list.map(i => (i.id === row.id ? row : i)) : [...list, row]; });
    return row;
  }, [portfolioId, canEdit, reload]);

  const setStatus = useCallback(async (id, status) => {
    if (!canEdit) return;
    setItems(prev => (prev || []).map(i => (i.id === id ? { ...i, status } : i)));
    await setItemStatus(portfolioId, id, status).catch(fail);
  }, [portfolioId, canEdit, reload]);

  const remove = useCallback(async (item) => {
    if (!canEdit) return;
    setItems(prev => (prev || []).filter(i => i.id !== item.id));
    await deleteItem(portfolioId, item).catch(fail);
  }, [portfolioId, canEdit, reload]);

  return { items, error, canEdit, reload, save, setStatus, remove };
}
