import { FX, SEED_ASSETS } from './data.js';

const STORAGE_KEY = 'imari:portfolio:v1';

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    if (import.meta.env.DEV) console.warn('portfolio: failed to load state', e);
    return null;
  }
}

export function saveState(state) {
  try {
    // Strip transient routing state — _nav is reducer-internal, not user data
    const { _nav, ...persistable } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
  } catch (e) {
    if (import.meta.env.DEV) console.warn('portfolio: failed to save state', e);
  }
}

export function defaultState() {
  return {
    profile:     { name: '', displayCurrency: 'RWF', createdAt: new Date().toISOString(), phone: '', bio: '', location: '', avatar: null },
    assets:      SEED_ASSETS.slice(),
    liabilities: [],
    goals:       [],
    cashflows:   [],
    snapshots:       [],
    reachedMilestones: [],   // milestone values (numbers) already celebrated
    fx:          { ...FX },
    chat:        [],
    seeded:      true,
  };
}

export function exportJSON(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `imari-portfolio-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Import validation ─────────────────────────────────────────────────────────
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;   // 10 MB hard cap
const MAX_ASSETS       = 500;
const MAX_ITEMS        = 2000;                // liabilities / goals / cashflows
const MAX_STR_LEN      = 500;                 // generic string field
const MAX_NOTE_LEN     = 2000;               // notes / description fields

/** Strip control characters and clamp length — prevents injection into AI prompts. */
function sanitizeStr(v, max = MAX_STR_LEN) {
  if (typeof v !== 'string') return typeof v === 'number' ? String(v) : '';
  // Remove ASCII control chars (except tab/newline) and enforce length
  return v.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').slice(0, max);
}

function sanitizeNum(v, fallback = 0) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Deep-sanitize one asset object. */
function sanitizeAsset(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const a = raw;
  return {
    ...a,
    id:            sanitizeStr(a.id, 36),
    name:          sanitizeStr(a.name, 100),
    notes:         sanitizeStr(a.notes, MAX_NOTE_LEN),
    model:         sanitizeStr(a.model, 100),
    chassis:       sanitizeStr(a.chassis, 60),
    currency:      sanitizeStr(a.currency, 5),
    kind:          sanitizeStr(a.kind, 40),
    purchasePrice: sanitizeNum(a.purchasePrice),
    currentValue:  a.currentValue === '' || a.currentValue == null
                     ? ''
                     : sanitizeNum(a.currentValue),
    yieldPct:      sanitizeNum(a.yieldPct),
    // Base64 photos/documents: only keep if they look like valid data URIs
    photos: Array.isArray(a.photos)
      ? a.photos.filter(p => typeof p === 'string' && p.startsWith('data:image/')).slice(0, 5)
      : [],
    documents: Array.isArray(a.documents)
      ? a.documents
          .filter(d => d && typeof d.dataUrl === 'string' && d.dataUrl.startsWith('data:'))
          .slice(0, 5)
      : [],
  };
}

export function importJSONFile(file) {
  // 1. Size guard — before reading anything into memory
  if (file.size > MAX_IMPORT_BYTES) {
    return Promise.reject(new Error(`File too large (max ${MAX_IMPORT_BYTES / 1024 / 1024} MB)`));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const obj = JSON.parse(e.target.result);

        // 2. Top-level structure check
        if (!obj || typeof obj !== 'object' || Array.isArray(obj))
          throw new Error('Invalid portfolio file structure');
        if (!Array.isArray(obj.assets))
          throw new Error('Missing assets array');
        if (obj.assets.length > MAX_ASSETS)
          throw new Error(`Too many assets (max ${MAX_ASSETS})`);

        // 3. Sanitize assets
        obj.assets = obj.assets.map(sanitizeAsset).filter(Boolean);

        // 4. Clamp other collections (no deep sanitization needed — they're not in AI prompts)
        if (Array.isArray(obj.liabilities)) obj.liabilities = obj.liabilities.slice(0, MAX_ITEMS);
        if (Array.isArray(obj.goals))       obj.goals       = obj.goals.slice(0, MAX_ITEMS);
        if (Array.isArray(obj.cashflows))   obj.cashflows   = obj.cashflows.slice(0, MAX_ITEMS);
        if (Array.isArray(obj.snapshots))   obj.snapshots   = obj.snapshots.slice(0, MAX_ITEMS);

        // 5. Never import chat or AI insight — could contain injected instructions
        //    that would be loaded into the AI context on next session open
        delete obj.chat;
        delete obj.insight;

        resolve(obj);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
