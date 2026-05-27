/**
 * useRovingFocus — roving-tabindex pattern for keyboard-navigable lists.
 *
 * One Tab stop on the whole list; arrow keys move focus between items;
 * Home/End jump to the ends; consumer wires Enter / Delete / custom hotkeys
 * via the onItemKeyDown callback.
 *
 * Usage:
 *   const { containerProps, getItemProps, focusedIndex, focusItem } =
 *     useRovingFocus(items.length, {
 *       onActivate: (i) => openEditor(items[i]),
 *       onItemKeyDown: (e, i) => {
 *         if (e.key === 'Delete') deleteItem(items[i]);
 *       },
 *     });
 *
 *   <div {...containerProps} role="listbox">
 *     {items.map((item, i) => (
 *       <Row key={item.id} {...getItemProps(i)} />
 *     ))}
 *   </div>
 *
 * Each Row spreads getItemProps(i) which provides:
 *   tabIndex (0 for the focused item, -1 for the rest)
 *   onFocus / onClick handlers that sync focusedIndex
 *   data-focused for CSS styling
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const isInteractive = (el) => {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
};

export function useRovingFocus(itemCount, { onActivate, onItemKeyDown } = {}) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const itemRefs = useRef([]);

  // Clamp when the underlying list shrinks (e.g. filter)
  useEffect(() => {
    if (focusedIndex >= itemCount && itemCount > 0) setFocusedIndex(itemCount - 1);
  }, [itemCount, focusedIndex]);

  const focusItem = useCallback((i) => {
    const el = itemRefs.current[i];
    if (el) {
      setFocusedIndex(i);
      el.focus();
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, []);

  const containerProps = {
    onKeyDown: (e) => {
      // Let typing in inputs win — don't hijack arrow keys inside form fields.
      if (isInteractive(e.target) && e.target !== itemRefs.current[focusedIndex]) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          focusItem(Math.min(focusedIndex + 1, itemCount - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          focusItem(Math.max(focusedIndex - 1, 0));
          break;
        case 'Home':
          e.preventDefault();
          focusItem(0);
          break;
        case 'End':
          e.preventDefault();
          focusItem(itemCount - 1);
          break;
        case 'Enter':
          if (e.target === itemRefs.current[focusedIndex]) {
            e.preventDefault();
            onActivate?.(focusedIndex);
          }
          break;
        default:
          if (onItemKeyDown && e.target === itemRefs.current[focusedIndex]) {
            onItemKeyDown(e, focusedIndex);
          }
      }
    },
  };

  const getItemProps = (i) => ({
    ref: (el) => { itemRefs.current[i] = el; },
    tabIndex: focusedIndex === i ? 0 : -1,
    'data-focused': focusedIndex === i || undefined,
    onFocus: () => setFocusedIndex(i),
  });

  return { containerProps, getItemProps, focusedIndex, focusItem };
}
