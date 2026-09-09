// FamilyCalendar — one agenda for everything dated: family events, tasks,
// renewals, expiries, goal deadlines, loan ends, recurring bills and Rwanda
// statutory dates (deriveEvents). Manual events are family_items of kind
// 'event'; the ICS card exposes the same agenda to Google/Apple Calendar.
import { useEffect, useMemo, useState } from 'react';
import { useItems } from '../family/useItems.js';
import { deriveEvents } from '../family/planning.js';
import { getCalendarToken, rotateCalendarToken, deleteCalendarToken, calendarFeedUrl } from '../family/items.js';
import { ItemEditor, ErrorBanner, SignInNote, PageHead, Empty, Due } from '../family/ui.jsx';
import { fromISO } from '../family/habits.js';

import { tx } from '../i18n/tx.js';

const KIND_STYLE = {
  event: 'pill-brand', task: 'pill-soft', policy: 'pill-gold', document: 'pill-gold', wish: 'pill-soft',
  goal: 'pill-up', loan: 'pill-down', bill: 'pill-soft', tax: 'pill-down',
};
const fmtDay = iso => fromISO(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const monthOf = iso => fromISO(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

export default function FamilyCalendar({ state, dispatch, portfolioId, role, showToast }) {
  const { items, error, canEdit, save, remove } = useItems(portfolioId, role);
  const [editing, setEditing] = useState(null); // null | 'new' | row
  const [days, setDays] = useState(90);
  const now = useMemo(() => new Date(), []);
  const events = useMemo(() => deriveEvents(state, items || [], { now, days }), [state, items, now, days]);

  if (!portfolioId) return <SignInNote what="the family calendar" />;

  const groups = [];
  for (const e of events) {
    const m = e.in < 0 ? 'Overdue' : monthOf(e.date);
    const g = groups[groups.length - 1];
    if (g && g.label === m) g.rows.push(e); else groups.push({ label: m, rows: [e] });
  }
  const open = (e) => {
    if (e.source === 'family' && e.kind === 'event') { const row = items.find(i => i.id === e.id); if (row) setEditing(row); return; }
    dispatch({ type: 'nav', to: e.to });
  };

  return (
    (<div className="col" style={{ gap: 16 }}>
      <ErrorBanner error={error} />
      <PageHead title={tx('Next up')} sub={tx(
        'Family dates, renewals, bills, goal deadlines and statutory dates in one list.'
      )}
        action={
          <div className="row" style={{ gap: 6 }}>
            <div className="seg-tabs" role="group" aria-label={tx('Horizon')}>
              {[30, 90, 365].map(d => <button key={d} className={`seg-tab${days === d ? ' active' : ''}`} aria-pressed={days === d} onClick={() => setDays(d)}>{d === 365 ? tx('1 year') : tx('{0} days', [d])}</button>)}
            </div>
            {canEdit && <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>{tx('+ Event')}</button>}
          </div>
        } />
      {items === null && !error && <Empty>{tx('Loading…')}</Empty>}
      {items && events.length === 0 && <Empty>{tx(
        'Nothing dated in this window. Add a birthday, school term or family day with “+ Event”.'
      )}</Empty>}
      {groups.map(g => (
        <div key={g.label} className="card" style={{ padding: '6px 16px' }}>
          <div className="muted" style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, padding: '10px 0 4px', color: g.label === 'Overdue' ? 'var(--down)' : undefined }}>{tx(g.label)}</div>
          {g.rows.map(e => (
            <button key={`${e.source}-${e.id}-${e.date}`} className="btn-unstyled row" onClick={() => open(e)}
                    style={{ width: '100%', gap: 12, padding: '9px 0', borderTop: '1px solid var(--line-soft)', textAlign: 'left', cursor: 'pointer', alignItems: 'center' }}>
              <span className="muted num" style={{ minWidth: 110, fontSize: 12 }}>{fmtDay(e.date)}</span>
              <span style={{ flex: 1, fontSize: 13 }}>{tx(e.title)}{e.meta && <span className="muted" style={{ fontSize: 11 }}> · {e.meta}</span>}</span>
              <span className={`pill ${KIND_STYLE[e.kind] || 'pill-soft'}`} style={{ fontSize: 10 }}>{e.kind}</span>
              <Due days={e.in} />
            </button>
          ))}
        </div>
      ))}
      <FeedCard portfolioId={portfolioId} canEdit={canEdit} showToast={showToast} />
      {editing && (
        <ItemEditor kind="event" initial={editing === 'new' ? undefined : editing}
                    onSave={save} onDelete={remove} onClose={() => setEditing(null)} />
      )}
    </div>)
  );
}

/** Subscribe-URL management. The token is the secret; rotating it invalidates the old URL. */
function FeedCard({ portfolioId, canEdit, showToast }) {
  const [token, setToken] = useState(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => { let on = true; getCalendarToken(portfolioId).then(t => on && setToken(t)).catch(() => on && setToken(null)); return () => { on = false; }; }, [portfolioId]);
  const url = calendarFeedUrl(token);
  const run = async (fn, msg) => { setBusy(true); try { const t = await fn(); setToken(t ?? null); showToast?.(msg, 'success'); } catch (e) { showToast?.(e.message, 'error'); } finally { setBusy(false); } };

  if (!canEdit) return null;
  return (
    (<div className="card" style={{ padding: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 13 }}>{tx('Subscribe in Google or Apple Calendar')}</div>
      <div className="muted" style={{ fontSize: 11, lineHeight: 1.5, marginTop: 2 }}>
        {tx(
          'A read-only feed of this list. Anyone with the link can read your family dates, so treat it like a password: paste it into your calendar app only, and rotate it if it leaks.'
        )}
      </div>
      {token === undefined ? <Empty>{tx('Checking…')}</Empty> : token ? (
        <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <code className="md-code" style={{ fontSize: 11, wordBreak: 'break-all', flex: 1, minWidth: 220 }}>{url}</code>
          <button className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(url).then(() => showToast?.(tx('Feed link copied'), 'success'))}>{tx('Copy')}</button>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(() => rotateCalendarToken(portfolioId), 'Feed link rotated — update your calendar app')}>{tx('Rotate')}</button>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(async () => { await deleteCalendarToken(portfolioId); return null; }, 'Feed disabled')}>{tx('Disable')}</button>
        </div>
      ) : (
        <button className="btn btn-sm" style={{ marginTop: 10 }} disabled={busy} onClick={() => run(() => rotateCalendarToken(portfolioId), 'Feed created')}>{tx('Create feed link')}</button>
      )}
    </div>)
  );
}
