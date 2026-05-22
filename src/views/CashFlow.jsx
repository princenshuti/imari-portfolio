import { useState, useMemo } from 'react';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, CURRENCIES, toBase, fmtBase, fmt, id } from '../data.js';
import { Field, inputStyle } from '../components/Field.jsx';

const ALL_CATS = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

const EMPTY_CF = {
  type: 'income', category: 'salary', amount: '', currency: 'RWF',
  date: new Date().toISOString().slice(0, 10),
  recurring: 'monthly', notes: '',
};

const RECURRING = ['once', 'monthly', 'quarterly', 'annually'];

function CFEditor({ entry, onSave, onCancel }) {
  const isNew = !entry.id;
  const [e, setE] = useState({ ...EMPTY_CF, ...entry, id: entry.id || id() });
  const u = (k, v) => setE(s => ({ ...s, [k]: v }));
  const cats = e.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div onClick={onCancel} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20,
    }}>
      <div onClick={ev => ev.stopPropagation()} className="card" style={{
        width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto',
        padding: 28, background: 'var(--paper)', boxShadow: 'var(--shadow-pop)',
      }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 20 }}>
          <div className="font-serif" style={{ fontSize: 22 }}>{isNew ? 'Add entry' : 'Edit entry'}</div>
          <button onClick={onCancel} style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bg-2)', border: 0, cursor: 'pointer' }}>×</button>
        </div>

        {/* Type toggle */}
        <div className="row" style={{ gap: 8, marginBottom: 18 }}>
          {['income', 'expense'].map(t => (
            <button key={t} onClick={() => { u('type', t); u('category', t === 'income' ? 'salary' : 'loan-repay'); }}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 'var(--r-md)', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                background: e.type === t ? (t === 'income' ? 'var(--up-soft)' : 'var(--down-soft)') : 'var(--bg-2)',
                color: e.type === t ? (t === 'income' ? 'var(--up)' : 'var(--down)') : 'var(--ink-3)',
                border: e.type === t ? `1.5px solid ${t === 'income' ? 'var(--up)' : 'var(--down)'}` : '1.5px solid transparent',
              }}>
              {t === 'income' ? '▲ Income' : '▼ Expense'}
            </button>
          ))}
        </div>

        {/* Category */}
        <Field label="Category">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {cats.map(c => (
              <div key={c.id} onClick={() => u('category', c.id)} style={{
                padding: '7px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 500,
                background: c.id === e.category ? 'var(--brand-soft)' : 'var(--bg-2)',
                color: c.id === e.category ? 'var(--brand)' : 'var(--ink-2)',
                border: c.id === e.category ? '1px solid var(--brand)' : '1px solid transparent',
              }}>{c.label}</div>
            ))}
          </div>
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
          <Field label="Amount">
            <input type="number" value={e.amount} onChange={ev => u('amount', ev.target.value)} placeholder="0" style={inputStyle} />
          </Field>
          <Field label="Currency">
            <select value={e.currency} onChange={ev => u('currency', ev.target.value)} style={inputStyle}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
            </select>
          </Field>
          <Field label="Date">
            <input type="date" value={e.date} onChange={ev => u('date', ev.target.value)} style={inputStyle} />
          </Field>
          <Field label="Frequency">
            <select value={e.recurring} onChange={ev => u('recurring', ev.target.value)} style={inputStyle}>
              {RECURRING.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Notes" top={14}>
          <input value={e.notes} onChange={ev => u('notes', ev.target.value)} placeholder="optional" style={inputStyle} />
        </Field>

        <div className="row" style={{ gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} className="btn btn-ghost">Cancel</button>
          <button onClick={() => onSave({ ...e, amount: +e.amount || 0 })} className="btn btn-primary" disabled={!e.amount}>
            {isNew ? 'Add entry' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Expand recurring entries into monthly amounts for a given month. */
function monthlyAmount(entry) {
  const a = toBase(entry.amount, entry.currency || 'RWF');
  switch (entry.recurring) {
    case 'monthly':    return a;
    case 'quarterly':  return a / 3;
    case 'annually':   return a / 12;
    default:           return a;
  }
}

export default function CashFlowView({ state, dispatch }) {
  const { cashflows = [], profile } = state;
  const [editing, setEditing] = useState(null);
  const [monthOffset, setMonthOffset] = useState(0); // 0 = this month, -1 = last month, etc.

  const refDate = new Date();
  refDate.setMonth(refDate.getMonth() + monthOffset);
  const refYear  = refDate.getFullYear();
  const refMonth = refDate.getMonth();
  const monthLabel = refDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const { incomes, expenses, totInc, totExp } = useMemo(() => {
    const incomes  = [], expenses = [];
    let totInc = 0, totExp = 0;
    cashflows.forEach(cf => {
      const entryDate = new Date(cf.date);
      const inMonth =
        cf.recurring !== 'once'
          ? entryDate <= new Date(refYear, refMonth + 1, 0) // started before end of month
          : entryDate.getFullYear() === refYear && entryDate.getMonth() === refMonth;
      if (!inMonth) return;
      const ma = monthlyAmount(cf);
      if (cf.type === 'income') { incomes.push({ ...cf, _monthly: ma }); totInc += ma; }
      else { expenses.push({ ...cf, _monthly: ma }); totExp += ma; }
    });
    return { incomes, expenses, totInc, totExp };
  }, [cashflows, refYear, refMonth]);

  const netFlow = totInc - totExp;
  const savingsRate = totInc > 0 ? (netFlow / totInc) * 100 : 0;

  // Last 6 months bar data
  const barData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
      const y = d.getFullYear(), m = d.getMonth();
      let inc = 0, exp = 0;
      cashflows.forEach(cf => {
        const ed = new Date(cf.date);
        const applies = cf.recurring !== 'once'
          ? ed <= new Date(y, m + 1, 0)
          : ed.getFullYear() === y && ed.getMonth() === m;
        if (!applies) return;
        const ma = monthlyAmount(cf);
        if (cf.type === 'income') inc += ma;
        else exp += ma;
      });
      return { label: d.toLocaleDateString('en-GB', { month: 'short' }), inc, exp, net: inc - exp };
    });
  }, [cashflows]);

  const barMax = Math.max(...barData.map(b => Math.max(b.inc, b.exp)), 1);

  const cfGroup = (items) => {
    const out = {};
    items.forEach(cf => {
      const cat = ALL_CATS.find(c => c.id === cf.category) || ALL_CATS[ALL_CATS.length - 1];
      if (!out[cat.label]) out[cat.label] = { label: cat.label, color: cat.color, items: [], total: 0 };
      out[cat.label].items.push(cf);
      out[cat.label].total += cf._monthly;
    });
    return Object.values(out).sort((a, b) => b.total - a.total);
  };

  return (
    <div style={{ padding: 28, background: 'var(--bg)', minHeight: 'calc(100vh - 70px)' }}>

      {/* ── KPI strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 22 }}>
        {[
          { label: 'Monthly income', value: fmtBase(totInc, profile.displayCurrency, { compact: true }), color: 'var(--up)', bg: 'var(--up-soft)' },
          { label: 'Monthly expenses', value: fmtBase(totExp, profile.displayCurrency, { compact: true }), color: 'var(--down)', bg: 'var(--down-soft)' },
          { label: 'Net cash flow', value: `${netFlow >= 0 ? '+' : ''}${fmtBase(netFlow, profile.displayCurrency, { compact: true })}`, color: netFlow >= 0 ? 'var(--up)' : 'var(--down)', bg: netFlow >= 0 ? 'var(--up-soft)' : 'var(--down-soft)' },
          { label: 'Savings rate', value: `${savingsRate.toFixed(1)}%`, color: savingsRate >= 20 ? 'var(--up)' : savingsRate > 0 ? 'var(--gold)' : 'var(--down)', bg: 'var(--paper)' },
        ].map((c, i) => (
          <div key={i} style={{ padding: '14px 18px', borderRadius: 'var(--r-md)', background: c.bg, border: '0.5px solid var(--line)' }}>
            <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
            <div className="num" style={{ fontSize: 22, fontWeight: 700, color: c.color, letterSpacing: '-0.02em' }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* ── 6-month bar chart ── */}
      {cashflows.length > 0 && (
        <div className="card" style={{ padding: '18px 22px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>6-Month Cash Flow</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 80 }}>
            {barData.map((b, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', display: 'flex', gap: 3, alignItems: 'flex-end', height: 60 }}>
                  <div style={{ flex: 1, background: 'var(--up)', borderRadius: '3px 3px 0 0', height: `${(b.inc / barMax) * 100}%`, minHeight: 2, opacity: 0.7 }} title={`Income: ${b.inc.toLocaleString()}`} />
                  <div style={{ flex: 1, background: 'var(--down)', borderRadius: '3px 3px 0 0', height: `${(b.exp / barMax) * 100}%`, minHeight: 2, opacity: 0.7 }} title={`Expense: ${b.exp.toLocaleString()}`} />
                </div>
                <div style={{ fontSize: 9, color: 'var(--ink-4)' }}>{b.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            {[{ color: 'var(--up)', label: 'Income' }, { color: 'var(--down)', label: 'Expense' }].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, background: l.color, borderRadius: 2, opacity: 0.7 }} />
                <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Month navigator + Add ── */}
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="row" style={{ gap: 8 }}>
          <button onClick={() => setMonthOffset(m => m - 1)} className="btn btn-ghost" style={{ padding: '7px 14px' }}>‹ Prev</button>
          <div style={{ padding: '7px 14px', borderRadius: 'var(--r-md)', background: 'var(--paper)', border: '1px solid var(--line)', fontSize: 13, fontWeight: 600 }}>
            {monthLabel}
          </div>
          <button onClick={() => setMonthOffset(m => m + 1)} disabled={monthOffset >= 0} className="btn btn-ghost" style={{ padding: '7px 14px' }}>Next ›</button>
        </div>
        <button onClick={() => setEditing({})} className="btn btn-primary">＋ Add entry</button>
      </div>

      {/* ── Income section ── */}
      {incomes.length > 0 && (
        <div className="card" style={{ padding: 0, marginBottom: 14 }}>
          <div className="row" style={{ padding: '14px 20px', justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--up)' }} />
              <div className="font-serif" style={{ fontSize: 16 }}>Income</div>
              <span className="pill pill-soft">{incomes.length}</span>
            </div>
            <div className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--up)' }}>
              + {fmtBase(totInc, profile.displayCurrency, { compact: true })}
            </div>
          </div>
          <div className="hr" />
          {cfGroup(incomes).map((g, gi) => (
            <div key={g.label}>
              {gi > 0 && <div className="hr" style={{ margin: '0 20px' }} />}
              {g.items.map((cf, i) => {
                const cat = ALL_CATS.find(c => c.id === cf.category);
                return (
                  <div key={cf.id}>
                    {i > 0 && <div className="hr" style={{ margin: '0 20px' }} />}
                    <div className="row" style={{ padding: '12px 20px', justifyContent: 'space-between' }}>
                      <div className="col" style={{ gap: 2 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{cat?.label || cf.category}</div>
                        <div className="muted" style={{ fontSize: 11 }}>{cf.notes || cf.recurring} · {cf.date}</div>
                      </div>
                      <div className="row" style={{ gap: 12, alignItems: 'center' }}>
                        <div className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--up)' }}>
                          +{fmt(cf.amount, cf.currency, { compact: true })}
                        </div>
                        <button onClick={() => setEditing(cf)} style={{ padding: '4px 8px', fontSize: 11, borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => dispatch({ type: 'deleteCashflow', id: cf.id })} style={{ padding: '4px 8px', fontSize: 11, borderRadius: 6, border: '1px solid var(--down-soft)', background: 'transparent', color: 'var(--down)', cursor: 'pointer' }}>×</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* ── Expense section ── */}
      {expenses.length > 0 && (
        <div className="card" style={{ padding: 0, marginBottom: 14 }}>
          <div className="row" style={{ padding: '14px 20px', justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--down)' }} />
              <div className="font-serif" style={{ fontSize: 16 }}>Expenses</div>
              <span className="pill pill-soft">{expenses.length}</span>
            </div>
            <div className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--down)' }}>
              − {fmtBase(totExp, profile.displayCurrency, { compact: true })}
            </div>
          </div>
          <div className="hr" />
          {cfGroup(expenses).map((g, gi) => (
            <div key={g.label}>
              {gi > 0 && <div className="hr" style={{ margin: '0 20px' }} />}
              {g.items.map((cf, i) => {
                const cat = ALL_CATS.find(c => c.id === cf.category);
                return (
                  <div key={cf.id}>
                    {i > 0 && <div className="hr" style={{ margin: '0 20px' }} />}
                    <div className="row" style={{ padding: '12px 20px', justifyContent: 'space-between' }}>
                      <div className="col" style={{ gap: 2 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{cat?.label || cf.category}</div>
                        <div className="muted" style={{ fontSize: 11 }}>{cf.notes || cf.recurring} · {cf.date}</div>
                      </div>
                      <div className="row" style={{ gap: 12, alignItems: 'center' }}>
                        <div className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--down)' }}>
                          −{fmt(cf.amount, cf.currency, { compact: true })}
                        </div>
                        <button onClick={() => setEditing(cf)} style={{ padding: '4px 8px', fontSize: 11, borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => dispatch({ type: 'deleteCashflow', id: cf.id })} style={{ padding: '4px 8px', fontSize: 11, borderRadius: 6, border: '1px solid var(--down-soft)', background: 'transparent', color: 'var(--down)', cursor: 'pointer' }}>×</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {cashflows.length === 0 && (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💸</div>
          <div className="font-serif" style={{ fontSize: 22, marginBottom: 8 }}>Track your cash flow</div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 20 }}>
            Log income streams and expenses to see your monthly savings rate and 6-month flow chart.
          </div>
          <button onClick={() => setEditing({})} className="btn btn-primary">＋ Add first entry</button>
        </div>
      )}

      {editing !== null && (
        <CFEditor
          entry={editing}
          onSave={e => { dispatch({ type: 'upsertCashflow', entry: e }); setEditing(null); }}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}
