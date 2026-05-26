import { CLASSES, fmt, fmtBase, suggestValue, toBase, yearsBetween } from '../data.js';
import AssetIcon from './AssetIcon.jsx';

export default function AssetRow({ asset, displayCurrency, isSelected, onToggle, onEdit, onDelete }) {
  const cls = CLASSES.find(c => c.kind === asset.kind) || CLASSES[CLASSES.length - 1];
  const suggested = suggestValue(asset);
  const current = asset.currentValue !== '' && asset.currentValue != null ? asset.currentValue : suggested;
  const cost = asset.purchasePrice || 0;
  const gain = current - cost;
  const gainPct = cost ? (gain / cost * 100) : 0;
  const yrs = yearsBetween(asset.purchaseDate, new Date());

  return (
    <div style={{
      display:'grid', gridTemplateColumns:'28px 2.3fr 1fr 1.2fr 1.2fr 0.9fr 80px',
      alignItems:'center', padding: '14px 22px', gap: 12,
      background: isSelected ? 'color-mix(in oklab, var(--down) 6%, transparent)' : 'transparent',
      transition: 'background 0.15s',
    }}>
      <input
        type="checkbox" checked={!!isSelected} onChange={onToggle}
        onClick={e => e.stopPropagation()}
        aria-label={`Select ${asset.name}`}
        style={{ cursor: 'pointer', accentColor: 'var(--down)', margin: 0, width: 18, height: 18 }}
      />
      <div className="row" style={{ gap: 12, minWidth: 0 }}>
        <AssetIcon kind={asset.kind} color={cls.color} size={38} />
        <div className="col" style={{ minWidth: 0, gap: 2 }}>
          <div
            style={{ fontSize: 13.5, fontWeight: 500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}
            title={asset.name}
          >
            {asset.name}
            {/* Fractional-ownership / unvalued asset warning (UX review #21).
                If both cost and value are 0 — typically a fractional-stake
                placeholder — surface a badge prompting the user to enter a
                value so the asset isn't silently absent from net worth. */}
            {cost === 0 && current === 0 && (
              <span
                className="pill"
                title="No value entered — this asset isn't counted in your net worth. Edit to set a value."
                style={{
                  marginLeft: 8, fontSize: 9.5, padding: '1px 7px',
                  background: 'var(--gold-soft)', color: 'var(--gold-ink, var(--gold))',
                  cursor: 'help', verticalAlign: 'middle',
                }}
              >Set value</span>
            )}
          </div>
          <div
            className="muted"
            style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            title={[
              cls.label,
              asset.ticker && asset.ticker,
              asset.shares != null && `${asset.shares.toLocaleString()} sh`,
              asset.units != null && `${asset.units} units`,
              asset.count != null && `${asset.count} head`,
              asset.neighbourhood && asset.neighbourhood,
              asset.upi && `UPI ${asset.upi}`,
              asset.chassis && asset.chassis,
            ].filter(Boolean).join(' · ')}
          >
            {cls.label}
            {asset.ticker && ` · ${asset.ticker}`}
            {asset.shares != null && ` · ${asset.shares.toLocaleString()} sh`}
            {asset.units != null && ` · ${asset.units} units`}
            {asset.count != null && ` · ${asset.count} head`}
            {asset.neighbourhood && ` · ${asset.neighbourhood}`}
            {asset.upi && ` · UPI ${asset.upi}`}
            {asset.chassis && ` · ${asset.chassis}`}
          </div>
        </div>
      </div>

      <div className="col" style={{ gap: 2 }}>
        <div className="num" style={{ fontSize: 12 }}>
          {fmt(cost, asset.currency, { compact: true })}
        </div>
        <div className="muted" style={{ fontSize: 10 }}>{new Date(asset.purchaseDate).toLocaleDateString('en-GB', { month:'short', year:'numeric' })} · {yrs.toFixed(1)}y ago</div>
      </div>

      <div className="col" style={{ gap: 2 }}>
        <div className="num" style={{ fontSize: 13, fontWeight: 500 }}>
          {fmt(current, asset.currency, { compact: true })}
        </div>
        <div
          className="muted"
          style={{ fontSize: 10, cursor: 'help' }}
          title={
            asset.currentValue
              ? 'Your value — the figure you entered for this asset.'
              : `Estimated — Imari's starting suggestion using ${cls.note || 'the default rule'}. Edit the asset to set your own value.`
          }
        >
          {asset.currency} · {asset.currentValue ? 'your value' : 'estimated'}
        </div>
      </div>

      <div className="num" style={{ fontSize: 12.5, color:'var(--ink-2)' }}>
        {fmtBase(toBase(current, asset.currency), displayCurrency, { compact: true })}
      </div>

      <div className="col" style={{ alignItems:'flex-end', gap: 2 }}>
        <div className="num" style={{ fontSize: 12, fontWeight: 600, color: gain >= 0 ? 'var(--up-ink)' : 'var(--down-ink)' }}>
          <span aria-hidden="true">{gain >= 0 ? '▲' : '▼'}</span>{' '}
          {gain >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
        </div>
        <div className="num" style={{ fontSize: 10, color: gain >= 0 ? 'var(--up-ink)' : 'var(--down-ink)' }}>
          {gain >= 0 ? '+' : ''}{fmt(gain, asset.currency, { compact: true })}
        </div>
      </div>

      <div className="row" style={{ gap: 2, justifyContent:'flex-end' }}>
        <button
          type="button"
          onClick={() => onEdit(asset)}
          aria-label={`Edit ${asset.name}`}
          className="btn-icon-sm"
        ><span aria-hidden="true">✎</span></button>
        <button
          type="button"
          onClick={() => onDelete(asset)}
          aria-label={`Delete ${asset.name}`}
          className="btn-icon-sm is-danger"
        ><span aria-hidden="true">×</span></button>
      </div>
    </div>
  );
}
