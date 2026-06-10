// markdown.js — markdown-lite rendering for AI replies, shared by every chat
// surface so the same response renders identically everywhere. Lived inside
// the old Advisor chat page; extracted when the page became the Advice Center
// and the floating advisor became the sole conversation surface.

export function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Escape a string for safe use in a RegExp body. */
export function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Render a markdown-lite assistant reply into HTML, with the user's own
 * asset names highlighted so it's visually obvious when the model is
 * grounding its answer in *their* portfolio (e.g. "your Bugesera plot").
 *
 * @param {string} s         The raw assistant reply
 * @param {string[]} names   Asset names to highlight (longest-first matching)
 */
export function renderMD(s, names = []) {
  let out = escapeHTML(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');

  const sorted = [...names]
    .filter(n => n && n.length >= 3)
    .sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    const esc = escapeRegExp(escapeHTML(name));
    out = out.replace(
      new RegExp(`(?<![A-Za-z0-9])${esc}(?![A-Za-z0-9])`, 'gi'),
      (m) => `<span class="md-asset-ref" title="One of your assets">${m}</span>`
    );
  }
  return out;
}
