// Statement-file dispatcher + parsers. The dispatcher must route on file
// CONTENT, not extension — Rwandan bank portals export HTML tables and legacy
// binary files under a .xls name, which previously hit ExcelJS/JSZip and
// surfaced "Can't find end of central directory" to the user.
import { describe, it, expect } from 'vitest';
import { parseFile, parseCSV, parseHTMLTable } from './bankImport.js';

const file = (content, name) => new File([content], name);

const HTML_STATEMENT = `
<html><body>
<table><tr><td>Account holder</td><td>UMUTONI A.</td></tr></table>
<table>
  <tr><th>Date</th><th>Description</th><th>Debit</th><th>Credit</th></tr>
  <tr><td>02/06/2026</td><td>MTN&nbsp;MoMo&nbsp;transfer</td><td>15,000</td><td></td></tr>
  <tr><td>03/06/2026</td><td><b>Salary &amp; allowance</b></td><td></td><td>850,000</td></tr>
  <tr><td></td><td></td><td></td><td></td></tr>
</table>
</body></html>`;

describe('parseFile content sniffing', () => {
  it('parses an HTML table exported under a .xls name', async () => {
    const { headers, rows } = await parseFile(file(HTML_STATEMENT, 'statement.xls'));
    expect(headers).toEqual(['Date', 'Description', 'Debit', 'Credit']);
    expect(rows).toHaveLength(2);
    expect(rows[0].Description).toBe('MTN MoMo transfer');
    expect(rows[1].Description).toBe('Salary & allowance'); // tags stripped, entities decoded
    expect(rows[1].Credit).toBe('850,000');
  });

  it('parses legacy binary .xls (BIFF) via SheetJS', async () => {
    const mod = await import('xlsx');
    const XLSX = mod.default ?? mod;
    const ws = XLSX.utils.aoa_to_sheet([
      ['Bank of Kigali', '', '', ''], // preamble above the header row
      ['Date', 'Description', 'Debit', 'Credit'],
      ['02/06/2026', 'Fuel', 30000, ''],
      ['03/06/2026', 'Salary', '', 850000],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Statement');
    const buf = XLSX.write(wb, { bookType: 'xls', type: 'array' });
    expect(new Uint8Array(buf.slice(0, 2))).toEqual(new Uint8Array([0xD0, 0xCF])); // really OLE2

    const { headers, rows } = await parseFile(file(buf, 'statement.xls'));
    expect(headers).toEqual(['Date', 'Description', 'Debit', 'Credit']);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ Description: 'Fuel', Debit: '30000' });
    expect(rows[1].Credit).toBe('850000');
  });

  it('translates a corrupt .xls instead of leaking a parser error', async () => {
    const ole2 = new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
    await expect(parseFile(file(ole2, 'statement.xls')))
      .rejects.toThrow(/could not be read/);
  });

  it('rejects a PDF with a human message', async () => {
    await expect(parseFile(file('%PDF-1.7 …', 'statement.xls')))
      .rejects.toThrow(/PDF statements aren’t supported/);
  });

  it('translates a damaged zip instead of leaking the JSZip error', async () => {
    const fakeZip = new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0x00, 0x01, 0x02, 0x03]);
    await expect(parseFile(file(fakeZip, 'statement.xlsx')))
      .rejects.toThrow(/looks damaged or incomplete/);
  });

  it('routes a real .xlsx (zip magic) to the Excel parser', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Transactions');
    ws.addRow(['Date', 'Description', 'Amount']);
    ws.addRow(['2026-06-02', 'Airtime', -2000]);
    const buf = await wb.xlsx.writeBuffer();
    const { headers, rows } = await parseFile(file(buf, 'statement.xlsx'));
    expect(headers).toEqual(['Date', 'Description', 'Amount']);
    expect(rows).toHaveLength(1);
    expect(rows[0].Description).toBe('Airtime');
  });

  it('still parses plain CSV through the dispatcher', async () => {
    const csv = 'Date,Description,Amount\n2026-06-02,Groceries,-12000\n';
    const { headers, rows } = await parseFile(file(csv, 'statement.csv'));
    expect(headers).toEqual(['Date', 'Description', 'Amount']);
    expect(rows).toEqual([{ Date: '2026-06-02', Description: 'Groceries', Amount: '-12000' }]);
  });
});

describe('parseHTMLTable', () => {
  it('skips preamble tables without statement headers', () => {
    const { rows } = parseHTMLTable(HTML_STATEMENT);
    expect(rows[0].Date).toBe('02/06/2026'); // not the "Account holder" table
  });

  it('throws a clear error when no table has transaction columns', () => {
    expect(() => parseHTMLTable('<table><tr><td>hello</td></tr></table>'))
      .toThrow(/without a recognisable transaction table/);
  });
});

describe('parseCSV (regression — pre-existing behavior)', () => {
  it('finds the header row below preamble lines', () => {
    // NB: the delimiter is detected from line 1 (long-standing behavior), so
    // the preamble and body must share one — true of real bank exports.
    const text = 'Bank of Kigali,\nAccount:,0001\nDate,Description,Debit,Credit\n02/06/2026,Fuel,30000,\n';
    const { headers, rows } = parseCSV(text);
    expect(headers).toEqual(['Date', 'Description', 'Debit', 'Credit']);
    expect(rows).toHaveLength(1);
  });
});
