/**
 * Onboarding — first-run wizard for users with 0 assets.
 *
 * Shown after NamePrompt resolves but before the main Dashboard if the user
 * has nothing in their portfolio yet. Offers Rwanda-specific template assets
 * as one-click adds, a "load sample portfolio" escape hatch for users who
 * want to explore the product with real-looking data, and a "skip — I'll add
 * later" option that drops the user on the empty Dashboard with guidance.
 *
 * Each template renders an AssetEditor pre-filled with the chosen kind so
 * the user reviews/customises the values before saving — we don't silently
 * create assets they didn't intend.
 */
import { useState } from 'react';
import { id, fmt } from '../data.js';
import AssetEditor from '../components/AssetEditor.jsx';
import { useT } from '../contexts/I18nContext.jsx';

// Each template seeds the AssetEditor with sensible Rwanda defaults. Values are
// suggestions — the user adjusts before saving.
const TEMPLATES = [
  {
    id: 'bk-savings',  group: 'Cash & savings', glyph: '⌬', color: 'var(--sky)',
    title: 'Bank of Kigali savings', subtitle: 'BK · RWF · 5% yield',
    seed: { kind: 'savings', name: 'Bank of Kigali savings', bank: 'Bank of Kigali (BK)', currency: 'RWF', yieldPct: 5, purchasePrice: 500_000 },
  },
  {
    id: 'mtn-momo',    group: 'Cash & savings', glyph: '○',  color: 'var(--sky)',
    title: 'MTN MoMo wallet', subtitle: 'Mobile money · RWF',
    seed: { kind: 'momo-cash', name: 'MTN MoMo balance', wallet: 'MTN MoMo', currency: 'RWF', purchasePrice: 100_000 },
  },
  {
    id: 'usd-cash',    group: 'Cash & savings', glyph: '○', color: 'var(--gold)',
    title: 'USD cash / I&M USD', subtitle: 'Hold foreign currency',
    seed: { kind: 'momo-cash', name: 'USD cash', wallet: 'USD held', currency: 'USD', purchasePrice: 500 },
  },
  {
    id: 'kigali-plot', group: 'Real estate',    glyph: '▢',  color: 'var(--brand)',
    title: 'Kigali plot / land', subtitle: 'Set neighbourhood + size',
    seed: { kind: 'realestate-land', name: 'Plot in Kigali', currency: 'RWF', purchasePrice: 15_000_000, neighbourhood: 'Kibagabaga' },
  },
  {
    id: 'house',       group: 'Real estate',    glyph: '◐',  color: 'var(--brand)',
    title: 'House / apartment', subtitle: 'Primary residence or rental',
    seed: { kind: 'realestate-house', name: 'My house', currency: 'RWF', purchasePrice: 80_000_000, neighbourhood: 'Kacyiru' },
  },
  {
    id: 'vehicle',     group: 'Vehicles',       glyph: '⏵',  color: 'var(--clay)',
    title: 'Vehicle', subtitle: 'Personal or business',
    seed: { kind: 'vehicle', name: 'Toyota Rav4', model: 'Toyota Rav4', currency: 'RWF', purchasePrice: 18_000_000 },
  },
  {
    id: 'livestock',   group: 'Livestock',      glyph: '⊛',  color: 'var(--clay)',
    title: 'Livestock', subtitle: 'Cattle, goats, poultry',
    seed: { kind: 'livestock', name: 'Cattle', count: 5, currency: 'RWF', purchasePrice: 2_500_000 },
  },
  {
    id: 't-bond',      group: 'Fixed income',   glyph: '§',  color: 'var(--gold)',
    title: 'Treasury bond', subtitle: 'BNR 5-yr · ~12.5%',
    seed: { kind: 'bond', name: '5-yr T-bond', currency: 'RWF', purchasePrice: 500_000, yieldPct: 12.5, maturity: new Date(Date.now() + 5 * 365 * 86400000).toISOString().slice(0, 10) },
  },
  {
    id: 'rse-share',   group: 'Stocks',         glyph: '↑',  color: 'var(--brand)',
    title: 'RSE listed share', subtitle: 'BK, MTNR, BLR, others',
    seed: { kind: 'rse-equity', name: 'Bank of Kigali shares', ticker: 'BOK', shares: 200, lastPrice: 320, currency: 'RWF', purchasePrice: 56_000 },
  },
];

export default function Onboarding({ profile, dispatch, showToast, onComplete }) {
  const { t } = useT();
  const [editing, setEditing] = useState(null);

  const addedCount = 0; // tracked implicitly via parent state; we just rely on user clicking Done

  const launchTemplate = (tpl) => {
    setEditing({ ...tpl.seed, id: id(), purchaseDate: new Date().toISOString().slice(0, 10) });
  };

  const handleSave = (asset) => {
    dispatch({ type: 'upsertAsset', asset });
    setEditing(null);
    showToast?.(`Added "${asset.name}" to your portfolio.`, 'success');
  };

  const loadSample = () => {
    dispatch({ type: 'reset' });
    showToast?.('Loaded sample portfolio. Edit or replace anything from the Assets page.', 'success');
    onComplete?.();
  };

  const firstName = (profile?.name || '').split(' ')[0] || 'there';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'var(--bg)',
        overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '40px 20px',
      }}
    >
      <div style={{ maxWidth: 880, width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div aria-hidden="true" style={{
            width: 56, height: 56, borderRadius: 14, background: 'var(--brand)', color: 'var(--brand-ink)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Instrument Serif, serif', fontSize: 32, marginBottom: 16,
          }}>●</div>
          <h1 className="font-serif" style={{ fontSize: 38, lineHeight: 1.1, letterSpacing: '-0.02em', margin: '0 0 10px' }}>
            {t('onboarding.welcome', { name: firstName })}
          </h1>
          <p className="muted" style={{ fontSize: 15, lineHeight: 1.5, maxWidth: 520, margin: '0 auto' }}>
            {t('onboarding.sub')}
          </p>
        </div>

        {/* Templates grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
        }}>
          {TEMPLATES.map(tpl => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => launchTemplate(tpl)}
              className="card hover-lift"
              style={{
                padding: 18,
                textAlign: 'left',
                background: 'var(--paper)',
                border: '0.5px solid var(--line)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex', alignItems: 'flex-start', gap: 12,
              }}
            >
              <div aria-hidden="true" style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'color-mix(in srgb, ' + tpl.color + ' 14%, transparent)',
                color: tpl.color,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, lineHeight: 1, flexShrink: 0,
              }}>{tpl.glyph}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>
                  {tpl.title}
                </div>
                <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.4 }}>
                  {tpl.subtitle}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer actions */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
          padding: '20px 0', borderTop: '1px solid var(--line)',
        }}>
          <button
            type="button"
            onClick={loadSample}
            className="btn btn-ghost"
          >
            {t('onboarding.cta_sample')}
          </button>
          <button
            type="button"
            onClick={onComplete}
            className="btn btn-primary"
          >
            {t('onboarding.cta_skip')}
          </button>
        </div>

        <div className="muted" style={{ textAlign: 'center', fontSize: 11, marginTop: -8 }}>
          {t('onboarding.privacy')}
        </div>
      </div>

      {editing && (
        <AssetEditor
          asset={editing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
          showToast={showToast}
        />
      )}
    </div>
  );
}
