// portfolio-store.js — tiny LocalStorage-backed state container.
// All keys are namespaced under "imari:portfolio:".

const STORAGE_KEY = 'imari:portfolio:v1';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('portfolio: failed to load state', e);
    return null;
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('portfolio: failed to save state', e);
  }
}

function defaultState() {
  return {
    profile: { name: '', displayCurrency: 'RWF', createdAt: new Date().toISOString() },
    assets:  window.SEED_ASSETS.slice(),
    fx:      { ...window.FX },
    chat:    [],
    seeded:  true,
  };
}

function exportJSON(state) {
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

function importJSONFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const obj = JSON.parse(e.target.result);
        // Light validation
        if (!obj.assets || !Array.isArray(obj.assets)) throw new Error('Missing assets array');
        resolve(obj);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

Object.assign(window, { loadState, saveState, defaultState, exportJSON, importJSONFile, STORAGE_KEY });
