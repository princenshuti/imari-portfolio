// severity.js — the single source of truth for severity presentation.
// Three components used to carry their own copies of this map (CostOfAbsence,
// MetricWidget, the Advice Center) and a redesign would have updated some and
// not others. Import from here; never inline a severity→color ternary.

export const SEVERITY_COLOR = {
  critical: 'var(--down)',
  warning:  'var(--gold)',
  info:     'var(--sky)',
  good:     'var(--up)',
};

export const SEVERITY_GLYPH = {
  critical: '⚠',
  warning:  '!',
  info:     'i',
  good:     '✓',
};

export const SEVERITY_LABEL = {
  critical: 'Critical',
  warning:  'Warning',
  info:     'Heads up',
  good:     'On track',
};

export const severityColor = (sev) => SEVERITY_COLOR[sev] || SEVERITY_COLOR.info;
