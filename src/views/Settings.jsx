import { useState, useRef } from 'react';
import { CURRENCIES } from '../data.js';
import { exportJSON, importJSONFile } from '../store.js';
import { getApiKey, setApiKey } from '../ai.js';
import { Field, inputStyle } from '../components/Field.jsx';

function Section({ title, subtitle, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div className="font-serif" style={{ fontSize: 22, marginBottom: subtitle ? 4 : 14 }}>{title}</div>
      {subtitle && <div className="muted" style={{ fontSize: 12, marginBottom: 14, lineHeight: 1.5, maxWidth: 600 }}>{subtitle}</div>}
      <div className="card" style={{ padding: 22 }}>{children}</div>
    </div>
  );
}

export default function SettingsView({ state, dispatch }) {
  const fileRef = useRef(null);
  const [fxLocal, setFxLocal] = useState(state.fx);
  const [apiKey, setApiKeyLocal] = useState(getApiKey());
  const [apiKeySaved, setApiKeySaved] = useState(false);

  const onImport = async (file) => {
    try {
      const obj = await importJSONFile(file);
      if (confirm(`Import will replace your current data (${state.assets.length} assets → ${obj.assets.length}). Continue?`)) {
        dispatch({ type:'replaceAll', state: obj });
      }
    } catch (e) {
      alert('Import failed: ' + e.message);
    }
  };

  const handleSaveFx = () => {
    dispatch({ type:'setFx', fx: Object.fromEntries(Object.entries(fxLocal).map(([k,v]) => [k, +v || 1])) });
  };

  const handleSaveApiKey = () => {
    setApiKey(apiKey);
    setApiKeySaved(true);
    setTimeout(() => setApiKeySaved(false), 2000);
  };

  return (
    <div style={{ padding: 28, background:'var(--bg)', minHeight:'calc(100vh - 70px)', maxWidth: 820 }}>
      <Section title="Profile">
        <Field label="Your name (used in greetings)">
          <input value={state.profile.name} onChange={e => dispatch({ type:'setProfile', patch: { name: e.target.value } })}
            placeholder="e.g. Prince" style={{ ...inputStyle }}/>
        </Field>
        <Field label="Primary display currency" top={14}>
          <select value={state.profile.displayCurrency} onChange={e => dispatch({ type:'setProfile', patch: { displayCurrency: e.target.value } })}
            style={{ ...inputStyle }}>
            {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.label}</option>)}
          </select>
        </Field>
      </Section>

      <Section title="AI Advisor" subtitle="Your Anthropic API key powers the AI Advisor and dashboard insights. It's stored only in this browser.">
        <Field label="Anthropic API key" hint="sk-ant-…">
          <div className="row" style={{ gap: 8 }}>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKeyLocal(e.target.value)}
              placeholder="sk-ant-api03-…"
              style={{ ...inputStyle, flex: 1, fontFamily:'Geist Mono, monospace' }}
            />
            <button onClick={handleSaveApiKey} className="btn btn-primary" style={{ whiteSpace:'nowrap' }}>
              {apiKeySaved ? '✓ Saved' : 'Save key'}
            </button>
          </div>
        </Field>
        <div className="muted" style={{ fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>
          Get a key at <strong>console.anthropic.com</strong>. The key never leaves this browser — it's sent directly to the Anthropic API when you use the advisor.
        </div>
      </Section>

      <Section title="Exchange rates" subtitle="Edit if the FX values look off. All amounts convert via these rates.">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap: 12 }}>
          {CURRENCIES.filter(c => c.code !== 'RWF').map(c => (
            <Field key={c.code} label={`1 ${c.code} = ? RWF`} hint={c.label}>
              <input type="number" value={fxLocal[c.code]} onChange={e => setFxLocal(s => ({ ...s, [c.code]: e.target.value }))}
                style={{ ...inputStyle, fontFamily:'Geist Mono, monospace' }}/>
            </Field>
          ))}
        </div>
        <button onClick={handleSaveFx} className="btn btn-primary" style={{ marginTop: 14 }}>Save FX rates</button>
      </Section>

      <Section title="Backup & restore" subtitle="Your portfolio lives in this browser's storage. Export to back up, or import to restore on another device.">
        <div className="row" style={{ gap: 10, flexWrap:'wrap' }}>
          <button onClick={() => exportJSON(state)} className="btn btn-primary">↓ Export to JSON</button>
          <button onClick={() => fileRef.current?.click()} className="btn btn-ghost">↑ Import from JSON</button>
          <input ref={fileRef} type="file" accept="application/json" style={{ display:'none' }}
            onChange={e => e.target.files?.[0] && onImport(e.target.files[0])} />
        </div>
      </Section>

      <Section title="Danger zone">
        <button onClick={() => {
          if (confirm('Reset to seed assets? Your current data will be replaced.')) dispatch({ type:'reset' });
        }} className="btn btn-ghost">↻ Reset to sample portfolio</button>
        <button onClick={() => {
          if (confirm('Delete ALL your assets? This cannot be undone.')) dispatch({ type:'clearAssets' });
        }} className="btn btn-ghost" style={{ marginLeft: 8, color:'var(--down)', borderColor:'var(--down-soft)' }}>✕ Delete all assets</button>
      </Section>

      <div className="muted" style={{ fontSize: 11, marginTop: 30, padding: 16, background:'var(--bg-2)', borderRadius: 10, lineHeight: 1.55 }}>
        <strong>About Imari Portfolio.</strong> A personal asset & wealth tracker built for Rwanda. Data is stored
        only in this browser (LocalStorage) — nothing is sent to any server except when you ask the AI Advisor a
        question, in which case your portfolio is passed in as context. Use the export button to back up regularly.
      </div>
    </div>
  );
}
