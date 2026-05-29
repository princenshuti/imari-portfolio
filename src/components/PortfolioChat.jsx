/**
 * PortfolioChat — B4 in-portfolio member chat. Realtime, text-only, members
 * only (RLS-enforced). No file upload, no external email relay (v1 scope).
 */
import { useState, useEffect, useRef } from 'react';
import { listMessages, sendMessage, subscribeMessages } from '../cloud.js';

export default function PortfolioChat({ portfolioId, session }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [err, setErr] = useState(null);
  const endRef = useRef(null);
  const myId = session?.user?.id;

  useEffect(() => {
    if (!portfolioId) return;
    let alive = true;
    listMessages(portfolioId).then(m => { if (alive) setMessages(m); }).catch(e => setErr(e.message));
    const unsub = subscribeMessages(portfolioId, (msg) =>
      setMessages(prev => (prev.some(x => x.id === msg.id) ? prev : [...prev, msg])));
    return () => { alive = false; unsub(); };
  }, [portfolioId]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText(''); setErr(null);
    try { await sendMessage(portfolioId, body); }
    catch (e2) { setErr(e2.message); }
  };

  if (!portfolioId) return null;

  return (
    <div style={{ marginTop: 18 }}>
      <div className="muted" style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
        Member chat
      </div>
      <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 2px', marginBottom: 10 }}>
        {messages.length === 0 ? (
          <div className="muted" style={{ fontSize: 12 }}>No messages yet — keep money decisions next to the numbers.</div>
        ) : messages.map(m => {
          const mine = m.sender_user_id === myId;
          return (
            <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
              <div style={{
                padding: '7px 11px', borderRadius: 12, fontSize: 12.5, lineHeight: 1.4,
                background: mine ? 'var(--brand)' : 'var(--bg-2)',
                color: mine ? 'var(--brand-ink)' : 'var(--ink)',
              }}>{m.body}</div>
              <div className="muted" style={{ fontSize: 9.5, marginTop: 2, textAlign: mine ? 'right' : 'left' }}>
                {new Date(m.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {err && <div role="alert" style={{ fontSize: 11.5, color: 'var(--down)', marginBottom: 8 }}>{err}</div>}
      <form onSubmit={send} className="row" style={{ gap: 8 }}>
        <input value={text} onChange={e => setText(e.target.value)} maxLength={2000} placeholder="Message your members…"
          style={{ flex: 1, padding: '9px 12px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 13 }} />
        <button type="submit" className="btn btn-primary" disabled={!text.trim()}>Send</button>
      </form>
    </div>
  );
}
