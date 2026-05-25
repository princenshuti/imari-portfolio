import { useState } from 'react';
import Modal from '../components/Modal.jsx';

export default function NamePrompt({ onSubmit }) {
  const [name, setName] = useState('');
  return (
    <Modal open onClose={() => { /* no-op: name is required */ }} maxWidth={440} title="Welcome — what should I call you?">
      <div aria-hidden="true" style={{
        width: 48, height: 48, borderRadius: 12, background:'var(--brand)', color:'var(--brand-ink)',
        display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Instrument Serif, serif', fontSize: 28, marginBottom: 16,
      }}>●</div>
      <h1 className="font-serif" style={{ fontSize: 32, lineHeight: 1.1, letterSpacing:'-0.02em', margin: 0, fontWeight: 400 }}>Muraho.</h1>
      <div className="muted" style={{ fontSize: 13, marginTop: 6, marginBottom: 22, lineHeight: 1.5 }}>
        Welcome to your personal wealth portal. What should I call you?
      </div>
      <form onSubmit={e => { e.preventDefault(); if (name.trim()) onSubmit(name.trim()); }}>
        <label htmlFor="name-prompt-input" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>Your name</label>
        <input
          id="name-prompt-input"
          value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
          autoFocus required
          style={{ width:'100%', padding:'12px 14px', borderRadius: 9, border:'1px solid var(--line-strong)', background:'var(--paper-2)', fontSize: 14, fontFamily:'inherit', color:'var(--ink)' }}
        />
        <button type="submit" disabled={!name.trim()} className="btn btn-primary" style={{ width:'100%', marginTop: 12 }}>
          Continue →
        </button>
      </form>
      <div className="muted" style={{ fontSize: 10, marginTop: 14, textAlign:'center', lineHeight: 1.5 }}>
        Your data stays in this browser. Nothing leaves until you choose to back it up.
      </div>
    </Modal>
  );
}
