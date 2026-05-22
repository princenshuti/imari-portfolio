import { FX, SEED_ASSETS } from './data.js';

const STORAGE_KEY = 'imari:portfolio:v1';

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('portfolio: failed to load state', e);
    return null;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('portfolio: failed to save state', e);
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

export function importJSONFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const obj = JSON.parse(e.target.result);
        if (!obj.assets || !Array.isArray(obj.assets)) throw new Error('Missing assets array');
        resolve(obj);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
