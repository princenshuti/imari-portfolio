import { useState } from 'react';

export default function NamePrompt({ onSubmit }) {
  const [name, setName] = useState('');
  return (
    <div style={{
      position:'fixed', inset: 0, background:'rgba(20,20,16,0.65)', backdropFilter:'blur(6px)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex: 2147483640,
    }}>
      <div className="card" style={{ padding: 32, width: '90%', maxWidth: 440, background:'var(--paper)' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, background:'var(--brand)', color:'var(--brand-ink)',
          display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Instrument Serif, serif', fontSize: 28, marginBottom: 16,
        }}>●</div>
        <div className="font-serif" style={{ fontSize: 32, lineHeight: 1.1, letterSpacing:'-0.02em' }}>Muraho.</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 6, marginBottom: 22, lineHeight: 1.5 }}>
          Welcome to your personal wealth portal. What should I call you?
        </div>
        <form onSubmit={e => { e.preventDefault(); if (name.trim()) onSubmit(name.trim()); }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
            autoFocus
            style={{ width:'100%', padding:'12px 14px', borderRadius: 9, border:'1px solid var(--line)', background:'var(--paper-2)', fontSize: 14, fontFamily:'inherit', outline:'none' }}/>
          <button type="submit" disabled={!name.trim()} className="btn btn-primary" style={{ width:'100%', marginTop: 12 }}>
            Continue →
          </button>
        </form>
        <div className="muted" style={{ fontSize: 10, marginTop: 14, textAlign:'center', lineHeight: 1.5 }}>
          Your data stays in this browser. Nothing leaves until you choose to back it up.
        </div>
      </div>
    </div>
  );
}
