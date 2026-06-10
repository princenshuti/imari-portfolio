// download.js — shared client-side file-download helpers.

/**
 * Build a CSV from rows (array of arrays), quote-escape every cell, and
 * trigger a browser download. Single home for the blob/anchor dance so
 * exporting views (BalanceSheet, Reports, …) can't drift apart on escaping
 * or cleanup behavior.
 */
export function downloadCSV(rows, filename) {
  const csv = rows
    .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
