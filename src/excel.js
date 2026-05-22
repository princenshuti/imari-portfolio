import * as XLSX from 'xlsx';
import { CLASSES, CURRENCIES, id } from './data.js';

// All possible asset fields, in the order they appear in the template
const COLUMNS = [
  { key: 'kind',          label: 'kind',          required: true,  hint: 'Asset class code — see "Classes" sheet' },
  { key: 'name',          label: 'name',          required: true,  hint: 'Display name (e.g. "Plot in Kabuga")' },
  { key: 'currency',      label: 'currency',      required: true,  hint: 'RWF, USD, EUR, or KES' },
  { key: 'purchasePrice', label: 'purchasePrice', required: true,  hint: 'Number in the chosen currency' },
  { key: 'purchaseDate',  label: 'purchaseDate',  required: true,  hint: 'YYYY-MM-DD' },
  { key: 'currentValue',  label: 'currentValue',  required: false, hint: 'Leave blank to use Imari\'s suggestion' },
  { key: 'notes',         label: 'notes',         required: false, hint: 'Free text' },
  // Class-specific
  { key: 'neighbourhood', label: 'neighbourhood', required: false, hint: 'Real estate only' },
  { key: 'upi',           label: 'upi',           required: false, hint: 'Real estate — Unique Parcel Identifier (e.g. 1/01/01/01/0001). Used to match rows on re-import.' },
  { key: 'model',         label: 'model',         required: false, hint: 'Vehicle only (e.g. "Toyota Rav4 2018")' },
  { key: 'chassis',       label: 'chassis',       required: false, hint: 'Vehicle — chassis / VIN number. Used to match rows on re-import.' },
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
const DATE_FIELDS = new Set(['purchaseDate', 'maturity', 'dueDate']);

const SAMPLE_ROWS = [
  { kind: 'realestate-land', name: 'Plot in Kabuga',       currency: 'RWF', purchasePrice: 150000000, purchaseDate: '2022-06-15', currentValue: '', neighbourhood: 'Kabuga', upi: '1/01/01/01/0001' },
  { kind: 'rse-equity',      name: 'Bank of Kigali shares',currency: 'RWF', purchasePrice: 56000,     purchaseDate: '2023-03-10', ticker: 'BOK',  shares: 200, lastPrice: 320 },
  { kind: 'vehicle',         name: 'Toyota Rav4',          currency: 'RWF', purchasePrice: 18000000,  purchaseDate: '2021-09-01', model: 'Toyota Rav4 2018', chassis: 'JTMBD33V585012345' },
  { kind: 'crypto',          name: 'Bitcoin',              currency: 'USD', purchasePrice: 1750,      purchaseDate: '2023-11-15', ticker: 'BTC', units: 0.05, lastPrice: 68240 },
  { kind: 'savings',         name: 'BK savings account',   currency: 'RWF', purchasePrice: 1200000,   purchaseDate: '2023-08-12', bank: 'Bank of Kigali', yieldPct: 5 },
];

function excelDateToISO(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return String(value);
    return `${d.y.toString().padStart(4, '0')}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parsed = new Date(s);
  if (!isNaN(parsed)) return parsed.toISOString().slice(0, 10);
  return s;
}

export function downloadAssetTemplate() {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Assets (header row + sample rows + 20 blank rows for users to fill)
  const headerRow = COLUMNS.map(c => c.label);
  const sampleData = SAMPLE_ROWS.map(r => COLUMNS.map(c => r[c.key] ?? ''));
  const blankRows = Array.from({ length: 20 }, () => COLUMNS.map(() => ''));
  const aoa = [headerRow, ...sampleData, ...blankRows];
  const assetsSheet = XLSX.utils.aoa_to_sheet(aoa);

  // Set column widths
  assetsSheet['!cols'] = COLUMNS.map(c => ({ wch: Math.max(c.label.length + 2, 14) }));

  // Freeze the header row
  assetsSheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  assetsSheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s:{r:0,c:0}, e:{r:0, c:COLUMNS.length-1}}) };

  XLSX.utils.book_append_sheet(wb, assetsSheet, 'Assets');

  // Sheet 2: Field reference
  const fieldsAoa = [
    ['Field', 'Required?', 'Description'],
    ...COLUMNS.map(c => [c.label, c.required ? 'Yes' : 'No', c.hint]),
  ];
  const fieldsSheet = XLSX.utils.aoa_to_sheet(fieldsAoa);
  fieldsSheet['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, fieldsSheet, 'Field reference');

  // Sheet 3: Asset class codes
  const classesAoa = [
    ['kind code', 'Label', 'Group', 'Class-specific fields', 'Valuation rule'],
    ...CLASSES.map(c => [c.kind, c.label, c.group, c.fields.join(', '), c.note]),
  ];
  const classesSheet = XLSX.utils.aoa_to_sheet(classesAoa);
  classesSheet['!cols'] = [{ wch: 18 }, { wch: 24 }, { wch: 16 }, { wch: 28 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, classesSheet, 'Classes');

  // Sheet 4: Currencies
  const currenciesAoa = [
    ['Currency code', 'Symbol', 'Label'],
    ...CURRENCIES.map(c => [c.code, c.symbol, c.label]),
  ];
  const currenciesSheet = XLSX.utils.aoa_to_sheet(currenciesAoa);
  currenciesSheet['!cols'] = [{ wch: 16 }, { wch: 10 }, { wch: 26 }];
  XLSX.utils.book_append_sheet(wb, currenciesSheet, 'Currencies');

  // Sheet 5: Instructions
  const instructions = [
    ['Imari Portfolio — bulk asset import template'],
    [''],
    ['1. Fill in one row per asset on the "Assets" sheet.'],
    ['2. The first 5 rows are example data — replace or delete them as you like.'],
    ['3. Required columns: kind, name, currency, purchasePrice, purchaseDate.'],
    ['4. "kind" must match one of the codes on the "Classes" sheet.'],
    ['5. "currency" must be one of: RWF, USD, EUR, KES.'],
    ['6. Dates can be either YYYY-MM-DD or proper Excel dates — both work.'],
    ['7. Class-specific columns (ticker, shares, neighbourhood, etc.) are optional unless your asset class uses them.'],
    ['8. Leave "currentValue" blank to let Imari suggest it from the valuation rule.'],
    [''],
    ['Save the file and upload it via Assets → Import Excel in the app.'],
    [''],
    ['Need a fresh template? Click "Download template" again in the app.'],
  ];
  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);
  instructionsSheet['!cols'] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, instructionsSheet, 'Instructions');

  // Reorder sheets so Instructions is first
  wb.SheetNames = ['Instructions', 'Assets', 'Field reference', 'Classes', 'Currencies'];

  XLSX.writeFile(wb, `imari-asset-template-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// Given a parsed (imported) asset and the current portfolio asset list,
// return the existing asset if a natural key matches, otherwise null.
// Priority: UPI (real estate) → chassis (vehicle) → ticker+kind (equities/crypto)
export function findExistingByNaturalKey(parsed, existingAssets) {
  if (parsed.upi) return existingAssets.find(a => a.upi === parsed.upi) || null;
  if (parsed.chassis) return existingAssets.find(a => a.chassis === parsed.chassis) || null;
  if (parsed.ticker) return existingAssets.find(a => a.ticker === parsed.ticker && a.kind === parsed.kind) || null;
  return null;
}

export function parseAssetExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const sheetName = wb.SheetNames.find(n => n.toLowerCase() === 'assets') || wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        if (!sheet) throw new Error('No "Assets" sheet found in the workbook.');

        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });
        const validKinds = new Set(CLASSES.map(c => c.kind));
        const validCurrencies = new Set(CURRENCIES.map(c => c.code));

        const assets = [];
        const errors = [];

        rows.forEach((row, idx) => {
          const lineNo = idx + 2; // header is row 1, data starts at row 2

          // Skip fully empty rows
          const hasAny = COLUMNS.some(c => row[c.label] !== '' && row[c.label] != null);
          if (!hasAny) return;

          const asset = { id: id() };
          let rowError = null;

          for (const col of COLUMNS) {
            let v = row[col.label];
            if (v === '' || v == null) {
              if (col.required) {
                rowError = `Row ${lineNo}: missing required field "${col.label}".`;
                break;
              }
              continue;
            }
            if (NUMERIC_FIELDS.has(col.key)) {
              const n = Number(v);
              if (isNaN(n)) {
                rowError = `Row ${lineNo}: "${col.label}" must be a number, got "${v}".`;
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
            errors.push(`Row ${lineNo}: unknown kind "${asset.kind}". See the Classes sheet for valid codes.`);
            return;
          }
          if (!validCurrencies.has(asset.currency)) {
            errors.push(`Row ${lineNo}: unknown currency "${asset.currency}". Use RWF, USD, EUR, or KES.`);
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
