import { describe, it, expect } from 'vitest';
import { parseMomoSms, momoToCashflowDraft } from './index.js';

describe('MoMo SMS parser', () => {
  it('parses an MTN received message', () => {
    const r = parseMomoSms('You have received 5,000 RWF from JOHN DOE (250788123456). New balance: 12,000 RWF. Fee: 0 RWF.');
    expect(r).toMatchObject({ provider: 'MTN MoMo', direction: 'in', amount: 5000, balanceAfter: 12000, fee: 0 });
    expect(r.counterparty).toMatch(/JOHN DOE/);
  });

  it('parses an MTN sent/payment message with a fee', () => {
    const r = parseMomoSms('You have sent 10,000 RWF to KABEZA SHOP. New balance: 2,000 RWF. Fee: 100 RWF.');
    expect(r).toMatchObject({ provider: 'MTN MoMo', direction: 'out', amount: 10000, fee: 100 });
  });

  it('parses an MTN withdrawal', () => {
    const r = parseMomoSms('You have withdrawn 20,000 RWF from agent. New balance: 5,000 RWF.');
    expect(r).toMatchObject({ direction: 'out', amount: 20000, counterparty: 'Cash withdrawal' });
  });

  it('parses an Airtel received message (currency-first, sender-routed)', () => {
    const r = parseMomoSms('You have received RWF 3,000 from MARIE. Bal: RWF 8,000.', 'AirtelMoney');
    expect(r).toMatchObject({ provider: 'Airtel Money', direction: 'in', amount: 3000, balanceAfter: 8000 });
  });

  it('returns null for a non-MoMo message', () => {
    expect(parseMomoSms('Your OTP is 458211. Do not share it.')).toBeNull();
    expect(parseMomoSms('')).toBeNull();
  });

  it('maps a parsed SMS to a momo-auto cashflow draft', () => {
    const draft = momoToCashflowDraft(parseMomoSms('You have received 5,000 RWF from JOHN. New balance: 12,000 RWF.'), { date: '2026-05-01' });
    expect(draft).toMatchObject({ type: 'income', amount: 5000, source: 'momo-auto', date: '2026-05-01' });
  });
});
