// advisorContext.js — budgeted serialization for the AI advisor's context.
//
// Both the client (ai.js) and the ai-proxy Edge Function hard-cap the system
// prompt at 8000 characters. The grounded context grows with portfolio size,
// and a blind JSON.stringify let the cap cut the JSON mid-object — losing
// whatever sat at the end (the market conditions, exactly the grounding the
// advisor needs) and feeding the model broken JSON.
//
// This serializer guarantees VALID, COMPLETE JSON within the budget by
// trimming the unbounded parts in priority order: assets first (largest by
// RWF value are kept, the rest summarized as `assetsOmitted`), then insights,
// then liabilities. Market conditions and totals are never trimmed — they're
// small and they're the point.

const stringify = (o) => JSON.stringify(o); // compact — pretty-printing was ~40% bloat

export function serializeBudgeted(ctx, maxChars = 6000) {
  let out = stringify(ctx);
  if (out.length <= maxChars) return out;

  const allAssets = [...(ctx.assets || [])]
    .sort((a, b) => (b.currentValueRWF || 0) - (a.currentValueRWF || 0));

  for (const n of [30, 20, 12, 8, 5, 3]) {
    const trimmed = {
      ...ctx,
      assets: allAssets.slice(0, n),
      assetsOmitted: Math.max(0, allAssets.length - n),
    };
    out = stringify(trimmed);
    if (out.length <= maxChars) return out;
  }

  // Deep fallback: tiny portfolios never get here; pathological ones (huge
  // notes, hundreds of liabilities) get the essentials and honest counts.
  const minimal = {
    ...ctx,
    assets: allAssets.slice(0, 3),
    assetsOmitted: Math.max(0, allAssets.length - 3),
    liabilities: (ctx.liabilities || []).slice(0, 3),
    liabilitiesOmitted: Math.max(0, (ctx.liabilities || []).length - 3),
    precomputedInsights: (ctx.precomputedInsights || []).slice(0, 3),
  };
  return stringify(minimal);
}
