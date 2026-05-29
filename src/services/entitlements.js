// entitlements.js — §10 feature gating. The free core is ALWAYS available; only
// paid extras check this. Entitlements are set server-side by the billing
// webhook (service role) — never by the client — so a user can't self-grant.
export const TIERS = { FREE: 'free', DIASPORA: 'diaspora' };

export const FEATURES = {
  HIGHER_INVITE_CAP: 'higher_invite_cap',
  AUTO_REPORTS: 'auto_reports',
  DOC_VAULT: 'doc_vault',
  TRUSTEE: 'trustee',
  MULTI_CURRENCY: 'multi_currency',
};

export function isEntitled(entitlements, feature) {
  if (!entitlements) return false;
  if (entitlements.tier === TIERS.DIASPORA) return true;
  return Array.isArray(entitlements.features) && entitlements.features.includes(feature);
}
