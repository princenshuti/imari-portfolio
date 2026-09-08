// FamilyScorecard — the 33-habit weekly checklist with month/year roll-ups,
// ported from the standalone 2026 dashboard. Every tick is one row in
// family_habit_logs, so both members can edit the same week without conflict.
import { useMemo, useRef, useState } from 'react';
import { inputStyle } from '../components/Field.jsx';
import { useFamily, useDebouncedNote } from '../family/useFamily.js';
import { importLegacy } from '../family/cloud.js';
import {
  SECTIONS, MAX_SCORE, NOTE_KEY, MAX_IMPORT_BYTES,
  weekStart, addDays, fromISO, weekScore, sectionScores, rating, streak,
  monthSummary, yearSummary, mapLegacyExport,
} from '../family/habits.js';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const fmtWeek = w => { const a = fromISO(w), b = fromISO(addDays(w, 6)); const f = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); return `${f(a)} – ${f(b)}`; };

export default function FamilyScorecard({ portfolioId, role, showToast }) {
  const fam = useFamily(portfolioId, role);
  const [tab, setTab] = useState('week');
  const [week, setWeek] = useState(() => weekStart(new Date()));
  const [year, setYear] = useState(() => new Date().getFullYear());

  if (!portfolioId) return <div className="card muted" style={{ padding: 20 }}>Sign in to use the family scorecard.</div>;

  return (
    <div className="col" style={{ gap: 16 }}>
      {fam.error && <div className="card" role="alert" style={{ padding: '10px 14px', color: 'var(--down-ink)', background: 'var(--down-soft)' }}>{fam.error}</div>}
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div className="seg-tabs" role="group" aria-label="Scorecard range">
          {[['week', 'Week'], ['month', 'Month'], ['year', 'Year']].map(([k, l]) => (
            <button key={k} className={`seg-tab${tab === k ? ' active' : ''}`} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        {tab === 'week' && (
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-ghost btn-xs" onClick={() => setWeek(w => addDays(w, -7))} aria-label="Previous week">←</button>
            <input type="date" value={week} onChange={e => e.target.value && setWeek(weekStart(e.target.value))} style={{ ...inputStyle, width: 'auto', padding: '6px 10px' }} aria-label="Week of" />
            <button className="btn btn-ghost btn-xs" onClick={() => setWeek(w => addDays(w, 7))} aria-label="Next week">→</button>
            <button className="btn btn-ghost btn-xs" onClick={() => setWeek(weekStart(new Date()))}>Today</button>
          </div>
        )}
        {tab !== 'week' && (
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-ghost btn-xs" onClick={() => setYear(y => y - 1)} aria-label="Previous year">←</button>
            <span className="num" style={{ fontWeight: 600 }}>{year}</span>
            <button className="btn btn-ghost btn-xs" onClick={() => setYear(y => y + 1)} aria-label="Next year">→</button>
          </div>
        )}
      </div>

      {fam.logs === null && !fam.error && <div className="muted" style={{ fontSize: 13 }}>Loading scorecard…</div>}
      {fam.logs && tab === 'week'  && <WeekTab fam={fam} week={week} />}
      {fam.logs && tab === 'month' && <MonthTab logs={fam.logs} year={year} />}
      {fam.logs && tab === 'year'  && <YearTab logs={fam.logs} year={year} />}

      {fam.canEdit && <ImportCard portfolioId={portfolioId} onDone={fam.reload} showToast={showToast} />}
    </div>
  );
}

function WeekTab({ fam, week }) {
  const { logs, canEdit, toggleHabit, notes, saveNote } = fam;
  const done = logs.get(week) || new Set();
  const total = weekScore(logs, week);
  const r = rating(total);
  const secs = sectionScores(logs, week);
  const noteKey = NOTE_KEY.week(week);
  const [draft, update, flush] = useDebouncedNote(notes[noteKey] || '', body => saveNote(noteKey, body));

  return (
    <>
      <div className="card" style={{ padding: 18 }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, alignItems: 'baseline' }}>
          <div>
            <div className="font-serif" style={{ fontSize: 22 }}>{fmtWeek(week)}</div>
            <div className="muted" style={{ fontSize: 12 }}>Streak: {streak(logs, week)} week{streak(logs, week) === 1 ? '' : 's'} at 23+ · {canEdit ? 'ticks save instantly' : 'view only'}</div>
          </div>
          <div className="row" style={{ gap: 12, alignItems: 'baseline' }}>
            <span className="font-serif num" style={{ fontSize: 30, color: r.color }}>{total}<span className="muted" style={{ fontSize: 14 }}>/{MAX_SCORE}</span></span>
            <span className="pill" style={{ background: `${r.color}22`, color: r.color }}>{r.label}</span>
          </div>
        </div>
        <div style={{ height: 8, background: 'var(--bg-2)', borderRadius: 4, marginTop: 12, overflow: 'hidden' }}>
          <div style={{ width: `${(total / MAX_SCORE) * 100}%`, height: '100%', background: r.color, transition: 'width .3s' }} />
        </div>
      </div>

      <div className="dash-grid-2">
        {SECTIONS.map((s, i) => {
          const sc = secs[i];
          const ratio = sc.done / sc.max;
          return (
            <div key={s.id} className="card" style={{ padding: 16, borderTop: `3px solid ${s.color}` }}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.title}</div>
                <span className="pill num" style={{ background: ratio >= .75 ? 'var(--up-soft)' : ratio >= .5 ? 'var(--gold-soft)' : 'var(--down-soft)', color: ratio >= .75 ? 'var(--up-ink)' : ratio >= .5 ? 'var(--gold-ink)' : 'var(--down-ink)' }}>{sc.done}/{sc.max}</span>
              </div>
              {s.habits.map(([id, label]) => (
                <label key={id} className="row" style={{ gap: 10, padding: '5px 0', fontSize: 13, alignItems: 'flex-start', cursor: canEdit ? 'pointer' : 'default' }}>
                  <input type="checkbox" checked={done.has(id)} disabled={!canEdit}
                         onChange={e => toggleHabit(week, id, e.target.checked)} style={{ marginTop: 3, accentColor: s.color }} />
                  <span style={{ flex: 1 }}>{label}</span>
                </label>
              ))}
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: 16 }}>
        <label htmlFor="week-reflection" style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)' }}>Weekly reflection</label>
        <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>Top wins · what slipped · one key adjustment</div>
        <textarea id="week-reflection" value={draft} onChange={e => update(e.target.value)} onBlur={flush} readOnly={!canEdit} maxLength={4000}
                  style={{ ...inputStyle, minHeight: 90, resize: 'vertical', lineHeight: 1.5 }} />
      </div>
    </>
  );
}

function MonthTab({ logs, year }) {
  const [sel, setSel] = useState(null);
  const months = useMemo(() => MONTHS.map((name, m) => ({ name, m, ...monthSummary(logs, year, m) })), [logs, year]);
  const logged = months.filter(x => x.avg != null);
  const best = logged.slice().sort((a, b) => b.avg - a.avg)[0];
  return (
    <>
      <div className="row muted" style={{ gap: 16, fontSize: 12, flexWrap: 'wrap' }}>
        <span>Best month: <b>{best ? best.name : '—'}</b></span>
        <span>Year average: <b className="num">{logged.length ? `${Math.round(logged.reduce((a, b) => a + b.avg, 0) / logged.length)}/${MAX_SCORE}` : '—'}</b></span>
        <span>Weeks logged: <b className="num">{months.reduce((a, b) => a + b.logged, 0)}</b></span>
        <span>Excellent weeks: <b className="num">{months.reduce((a, b) => a + b.excellent, 0)}</b></span>
      </div>
      <div className="dash-kpi-grid">
        {months.map(x => {
          const r = rating(x.avg || 0);
          return (
            <button key={x.m} className="card" onClick={() => setSel(x.m)}
                    style={{ padding: 14, textAlign: 'left', cursor: 'pointer', border: sel === x.m ? '1px solid var(--brand)' : undefined }}>
              <div className="font-serif" style={{ fontSize: 16 }}>{x.name}</div>
              <div className="num" style={{ fontSize: 22, fontWeight: 700, color: x.avg == null ? 'var(--ink-3)' : r.color }}>{x.avg == null ? '—' : `${x.avg}/${MAX_SCORE}`}</div>
              <div className="muted" style={{ fontSize: 11 }}>{x.logged} week{x.logged === 1 ? '' : 's'} logged</div>
            </button>
          );
        })}
      </div>
      {sel != null && (
        <div className="card" style={{ padding: 16 }}>
          <div className="font-serif" style={{ fontSize: 18, marginBottom: 8 }}>{MONTHS[sel]} {year}</div>
          {months[sel].weeks.map(w => {
            const s = logs.has(w) ? weekScore(logs, w) : null;
            const r = rating(s || 0);
            return (
              <div key={w} className="row" style={{ gap: 12, padding: '8px 0', borderBottom: '1px solid var(--line-soft)', fontSize: 13 }}>
                <span className="muted" style={{ minWidth: 120 }}>{fmtWeek(w)}</span>
                <span className="num" style={{ minWidth: 50, fontWeight: 700, color: s == null ? 'var(--ink-3)' : r.color }}>{s == null ? '—' : `${s}/${MAX_SCORE}`}</span>
                <div style={{ flex: 1, height: 6, background: 'var(--bg-2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${((s || 0) / MAX_SCORE) * 100}%`, height: '100%', background: r.color }} />
                </div>
                <span className="muted" style={{ minWidth: 80, fontSize: 12 }}>{s == null ? 'Not logged' : r.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function YearTab({ logs, year }) {
  const y = useMemo(() => yearSummary(logs, year), [logs, year]);
  const heat = useMemo(() => MONTHS.map((n, m) => ({ n, ...monthSummary(logs, year, m) })), [logs, year]);
  return (
    <>
      <div className="row muted" style={{ gap: 16, fontSize: 12, flexWrap: 'wrap' }}>
        <span>Year average: <b className="num">{y.avg == null ? '—' : `${y.avg}/${MAX_SCORE}`}</b></span>
        <span>Strongest area: <b>{y.best ? y.best.title : '—'}</b></span>
        <span>Weeks logged: <b className="num">{y.weeks}</b></span>
      </div>
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Monthly heatmap</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(56px, 1fr))', gap: 8 }}>
          {heat.map(h => {
            const r = rating(h.avg || 0);
            return (
              <div key={h.n} title={h.avg == null ? `${h.n}: no data` : `${h.n}: ${h.avg}/${MAX_SCORE}`}
                   style={{ aspectRatio: '1', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                            background: h.avg == null ? 'var(--bg-2)' : r.color, color: h.avg == null ? 'var(--ink-3)' : '#fff' }}>
                {h.n.slice(0, 3)}
              </div>
            );
          })}
        </div>
      </div>
      <div className="dash-kpi-grid">
        {y.sections.map(s => (
          <div key={s.id} className="card" style={{ padding: 14, borderTop: `3px solid ${s.color}` }}>
            <div className="muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>{s.title}</div>
            <div className="num" style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: s.avg == null ? 'var(--ink-3)' : rating(s.avg, s.max).color }}>
              {s.avg == null ? '—' : `${s.avg.toFixed(1)}/${s.max}`}
            </div>
            <div className="muted" style={{ fontSize: 11 }}>Average per week</div>
          </div>
        ))}
      </div>
    </>
  );
}

function ImportCard({ portfolioId, onDone, showToast }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) { setMsg('File too large (max 1 MB).'); return; }
    setBusy(true); setMsg('');
    try {
      const raw = JSON.parse(await file.text());
      const mapped = mapLegacyExport(raw);
      const n = await importLegacy(portfolioId, mapped);
      setMsg(`Imported ${n.logs} habit ticks and ${n.notes} notes.`);
      showToast?.('Family history imported', 'success');
      onDone?.();
    } catch (err) {
      setMsg(`Import failed: ${err.message || 'invalid file'}`);
    } finally { setBusy(false); }
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Import from the 2026 standalone dashboard</div>
          <div className="muted" style={{ fontSize: 11, lineHeight: 1.5, marginTop: 2 }}>
            In the old dashboard open the browser console and run
            <code className="md-code" style={{ margin: '0 4px' }}>copy(localStorage.getItem('prince_family_2026_dashboard_v1'))</code>
            then paste into a <b>.json</b> file and upload it here. Existing ticks are merged, nothing is deleted.
          </div>
          {msg && <div style={{ fontSize: 12, marginTop: 6 }}>{msg}</div>}
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} style={{ display: 'none' }} />
        <button className="btn btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Importing…' : 'Choose file'}</button>
      </div>
    </div>
  );
}
