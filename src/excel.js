// excel.js — all Excel operations use ExcelJS (dynamically imported, loaded only on demand).
// Migrated from SheetJS (xlsx) which had two unpatched High CVEs:
//   • Prototype Pollution (GHSA-4r6h-8v6p-xvw6)
//   • ReDoS (GHSA-5pgg-2g8v-p4x9)
// ExcelJS has no known active CVEs and is actively maintained.

import { CLASSES, CURRENCIES, id } from './data.js';

// All possible asset fields, in the order they appear in the template
const COLUMNS = [
  { key: 'kind',          label: 'kind',          required: true,  hint: 'Asset class code — see "Classes" sheet' },
  { key: 'name',          label: 'name',          required: true,  hint: 'Display name (e.g. "Plot in Kabuga")' },
  { key: 'currency',      label: 'currency',      required: true,  hint: 'RWF, USD, EUR, or KES' },
  { key: 'purchasePrice', label: 'purchasePrice', required: true,  hint: 'Number in the chosen currency' },
  { key: 'purchaseDate',  label: 'purchaseDate',  required: true,  hint: 'YYYY-MM-DD' },
  { key: 'currentValue',  label: 'currentValue',  required: false, hint: "Leave blank to use Imari's suggestion" },
  { key: 'notes',         label: 'notes',         required: false, hint: 'Free text' },
  { key: 'neighbourhood', label: 'neighbourhood', required: false, hint: 'Real estate only' },
  { key: 'upi',           label: 'upi',           required: false, hint: 'Real estate — Unique Parcel Identifier (e.g. 1/01/01/01/0001)' },
  { key: 'model',         label: 'model',         required: false, hint: 'Vehicle only (e.g. "Toyota Rav4 2018")' },
  { key: 'chassis',       label: 'chassis',       required: false, hint: 'Vehicle — chassis / VIN number' },
  { key: 'count',         label: 'count',         required: false, hint: 'Livestock — number of head' },
  { key: 'ticker',        label: 'ticker',        required: false, hint: 'Stocks / crypto (e.g. BOK, BTC)' },
  { key: 'shares',        label: 'shares',        required: false, hint: 'Stocks — number of shares' },
  { key: 'units',         label: 'units',         required: false, hint: 'Crypto — number of units' },
  { key: 'lastPrice',     label: 'lastPrice',     required: false, hint: 'Stocks / crypto — last price per unit' },
  { key: 'yieldPct',      label: 'yieldPct',      required: false, hint: 'Bonds / savings — yield % per year' },
  { key: 'maturity',      label: 'maturity',      required: false, hint: 'Bonds — YYYY-MM-DD' },
  { key: 'bank',          label: 'bank',          required: false, hint: 'Savings — bank name' },
  { key: 'wallet',        label: 'wallet',        required: false, hint: 'Mobile money — wallet name (e.g. "MTN MoMo")' },
  { key: 'grams',         label: 'grams',         required: false, hint: 'Gold — weight in grams' },
  { key: 'stakePct',      label: 'stakePct',      required: false, hint: 'Business — your stake %' },
  { key: 'debtor',        label: 'debtor',        required: false, hint: 'Receivable — debtor name' },
  { key: 'dueDate',       label: 'dueDate',       required: false, hint: 'Receivable — due date YYYY-MM-DD' },
];

const NUMERIC_FIELDS = new Set(['purchasePrice', 'currentValue', 'count', 'shares', 'units', 'lastPrice', 'yieldPct', 'grams', 'stakePct']);
const DATE_FIELDS    = new Set(['purchaseDate', 'maturity', 'dueDate']);

const SAMPLE_ROWS = [
  { kind: 'realestate-land', name: 'Plot in Kabuga',        currency: 'RWF', purchasePrice: 150000000, purchaseDate: '2022-06-15', neighbourhood: 'Kabuga',    upi: '1/01/01/01/0001' },
  { kind: 'rse-equity',      name: 'Bank of Kigali shares', currency: 'RWF', purchasePrice: 56000,     purchaseDate: '2023-03-10', ticker: 'BOK', shares: 200, lastPrice: 320 },
  { kind: 'vehicle',         name: 'Toyota Rav4',           currency: 'RWF', purchasePrice: 18000000,  purchaseDate: '2021-09-01', model: 'Toyota Rav4 2018',  chassis: 'JTMBD33V585012345' },
  { kind: 'crypto',          name: 'Bitcoin',               currency: 'USD', purchasePrice: 1750,      purchaseDate: '2023-11-15', ticker: 'BTC', units: 0.05, lastPrice: 68240 },
  { kind: 'savings',         name: 'BK savings account',    currency: 'RWF', purchasePrice: 1200000,   purchaseDate: '2023-08-12', bank: 'Bank of Kigali',      yieldPct: 5 },
];

// ── Date normalisation ─────────────────────────────────────────────────────────
// ExcelJS returns proper JS Date objects for date cells (unlike SheetJS serial ints).
function excelDateToISO(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '';
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parsed = new Date(s);
  return isNaN(parsed) ? s : parsed.toISOString().slice(0, 10);
}

// ── Cell value normalisation ───────────────────────────────────────────────────
// ExcelJS can return rich-text objects or formula results — unwrap them.
function cellVal(v) {
  if (v == null) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (v.richText)  return v.richText.map(r => r.text || '').join('');
    if (v.result != null) return v.result;   // formula cell
    if (v.text != null)   return String(v.text);
  }
  return v;
}

// ── Trigger browser download of an ArrayBuffer ────────────────────────────────
function downloadBuffer(buffer, filename) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Export: download filled template ──────────────────────────────────────────
export async function downloadAssetTemplate() {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator  = 'Imari by Maxventures';
  wb.created  = new Date();
  wb.modified = new Date();

  const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E8DF' } };
  const HEADER_FONT = { bold: true };

  // ── 1. Instructions sheet (shown first in Excel) ──────────────────────────
  const instrSheet = wb.addWorksheet('Instructions');
  instrSheet.columns = [{ width: 100 }];
  [
    'Imari Portfolio — bulk asset import template',
    '',
    '1. Fill in one row per asset on the "Assets" sheet.',
    '2. The first 5 rows are example data — replace or delete them as you like.',
    '3. Required columns: kind, name, currency, purchasePrice, purchaseDate.',
    '4. "kind" must match one of the codes on the "Classes" sheet.',
    '5. "currency" must be one of: RWF, USD, EUR, KES.',
    '6. Dates can be either YYYY-MM-DD or proper Excel dates — both work.',
    '7. Class-specific columns (ticker, shares, neighbourhood, etc.) are optional unless your asset class uses them.',
    '8. Leave "currentValue" blank to let Imari suggest it from the valuation rule.',
    '',
    'Save the file and upload it via Assets → Import Excel in the app.',
    '',
    'Need a fresh template? Click "Download template" again in the app.',
  ].forEach(line => instrSheet.addRow([line]));
  instrSheet.getRow(1).font = { bold: true, size: 13 };

  // ── 2. Assets sheet ───────────────────────────────────────────────────────
  const assetsSheet = wb.addWorksheet('Assets');
  assetsSheet.columns = COLUMNS.map(c => ({
    header: c.label,
    key:    c.label,
    width:  Math.max(c.label.length + 2, 14),
  }));
  const headerRow = assetsSheet.getRow(1);
  headerRow.font = HEADER_FONT;
  headerRow.fill = HEADER_FILL;
  assetsSheet.views = [{ state: 'frozen', ySplit: 1 }];
  assetsSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to:   { row: 1, column: COLUMNS.length },
  };
  SAMPLE_ROWS.forEach(r => assetsSheet.addRow(COLUMNS.map(c => r[c.key] ?? '')));
  for (let i = 0; i < 20; i++) assetsSheet.addRow(COLUMNS.map(() => ''));

  // ── 3. Field reference sheet ──────────────────────────────────────────────
  const fieldsSheet = wb.addWorksheet('Field reference');
  fieldsSheet.columns = [
    { header: 'Field',       width: 16 },
    { header: 'Required?',   width: 12 },
    { header: 'Description', width: 60 },
  ];
  fieldsSheet.getRow(1).font = HEADER_FONT;
  fieldsSheet.getRow(1).fill = HEADER_FILL;
  COLUMNS.forEach(c => fieldsSheet.addRow([c.label, c.required ? 'Yes' : 'No', c.hint]));

  // ── 4. Classes sheet ──────────────────────────────────────────────────────
  const classesSheet = wb.addWorksheet('Classes');
  classesSheet.columns = [
    { header: 'kind code',             width: 18 },
    { header: 'Label',                 width: 24 },
    { header: 'Group',                 width: 16 },
    { header: 'Class-specific fields', width: 28 },
    { header: 'Valuation rule',        width: 50 },
  ];
  classesSheet.getRow(1).font = HEADER_FONT;
  classesSheet.getRow(1).fill = HEADER_FILL;
  CLASSES.forEach(c => classesSheet.addRow([c.kind, c.label, c.group, c.fields.join(', '), c.note]));

  // ── 5. Currencies sheet ───────────────────────────────────────────────────
  const currSheet = wb.addWorksheet('Currencies');
  currSheet.columns = [
    { header: 'Currency code', width: 16 },
    { header: 'Symbol',        width: 10 },
    { header: 'Label',         width: 26 },
  ];
  currSheet.getRow(1).font = HEADER_FONT;
  currSheet.getRow(1).fill = HEADER_FILL;
  CURRENCIES.forEach(c => currSheet.addRow([c.code, c.symbol, c.label]));

  const buffer = await wb.xlsx.writeBuffer();
  downloadBuffer(buffer, `imari-asset-template-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── Import: parse an uploaded .xlsx file ──────────────────────────────────────
export function findExistingByNaturalKey(parsed, existingAssets) {
  if (parsed.upi)    return existingAssets.find(a => a.upi     === parsed.upi)    || null;
  if (parsed.chassis) return existingAssets.find(a => a.chassis === parsed.chassis) || null;
  if (parsed.ticker) return existingAssets.find(a => a.ticker  === parsed.ticker && a.kind === parsed.kind) || null;
  return null;
}

const MAX_EXCEL_BYTES = 10 * 1024 * 1024; // 10 MB

export function parseAssetExcel(file) {
  if (file.size > MAX_EXCEL_BYTES) {
    return Promise.reject(new Error(`File too large (max ${MAX_EXCEL_BYTES / 1024 / 1024} MB)`));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const ExcelJS = (await import('exceljs')).default;
        const wb = new ExcelJS.Workbook();
        // load() safely parses OOXML — ExcelJS does not eval() content
        await wb.xlsx.load(e.target.result);

        const ws = wb.worksheets.find(s => s.name.toLowerCase() === 'assets') || wb.worksheets[0];
        if (!ws) throw new Error('No "Assets" sheet found in the workbook.');

        // Read headers from row 1
        const headers = [];
        ws.getRow(1).eachCell({ includeEmpty: true }, (cell, colIdx) => {
          headers[colIdx - 1] = String(cellVal(cell.value) || '').trim();
        });

        const validKinds      = new Set(CLASSES.map(c => c.kind));
        const validCurrencies = new Set(CURRENCIES.map(c => c.code));
        const assets = [];
        const errors = [];

        ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
          if (rowNum === 1) return; // skip header

          // Build a header → value map for this row
          const rowData = {};
          headers.forEach((header, i) => {
            rowData[header] = cellVal(row.getCell(i + 1).value);
          });

          // Skip rows that are entirely blank
          const hasAny = COLUMNS.some(c => {
            const v = rowData[c.label];
            return v !== '' && v != null;
          });
          if (!hasAny) return;

          const asset = { id: id() };
          let rowError = null;

          for (const col of COLUMNS) {
            let v = rowData[col.label];
            if (v === '' || v == null) {
              if (col.required) {
                rowError = `Row ${rowNum}: missing required field "${col.label}".`;
                break;
              }
              continue;
            }
            if (NUMERIC_FIELDS.has(col.key)) {
              const n = Number(v);
              if (isNaN(n)) {
                rowError = `Row ${rowNum}: "${col.label}" must be a number, got "${v}".`;
                break;
              }
              v = n;
            } else if (DATE_FIELDS.has(col.key)) {
              v = excelDateToISO(v);
            } else {
              v = String(v).trim();
            }
            asset[col.key] = v;
          }

          if (rowError) { errors.push(rowError); return; }

          if (!validKinds.has(asset.kind)) {
            errors.push(`Row ${rowNum}: unknown kind "${asset.kind}". See the Classes sheet for valid codes.`);
            return;
          }
          if (!validCurrencies.has(asset.currency)) {
            errors.push(`Row ${rowNum}: unknown currency "${asset.currency}". Use RWF, USD, EUR, or KES.`);
            return;
          }
          if (!asset.currentValue) asset.currentValue = '';

          assets.push(asset);
        });

        resolve({ assets, errors });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}
