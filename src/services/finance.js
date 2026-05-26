/**
 * finance.js — closed-form loan formulas.
 *
 * All inputs use the conventions in the Liability model:
 *   principal       = outstanding balance (RWF)
 *   annualRatePct   = stated annual interest rate as a %, e.g. 17.5
 *   termMonths      = remaining months to fully amortise
 *
 * Keep this module dependency-free — pure math, easy to unit-test.
 */

/** Monthly payment for a fully-amortising loan (standard PMT formula). */
export function monthlyPayment(principal, annualRatePct, termMonths) {
  const P = Number(principal) || 0;
  const r = (Number(annualRatePct) || 0) / 100 / 12;
  const n = Number(termMonths) || 0;
  if (P <= 0 || n <= 0) return 0;
  if (r === 0) return P / n;
  return (P * r) / (1 - Math.pow(1 + r, -n));
}

/** Total interest paid across the life of the loan. */
export function totalInterest(principal, annualRatePct, termMonths) {
  const pmt = monthlyPayment(principal, annualRatePct, termMonths);
  return Math.max(0, pmt * termMonths - (Number(principal) || 0));
}

/**
 * Effective annual rate from a nominal monthly compounding rate.
 * EAR = (1 + r/12)^12 - 1
 */
export function effectiveAPR(annualRatePct) {
  const r = (Number(annualRatePct) || 0) / 100 / 12;
  if (r === 0) return 0;
  return (Math.pow(1 + r, 12) - 1) * 100;
}

/**
 * Months until payoff given an extra-payment-per-month assumption.
 * Returns null if the payment isn't enough to cover interest (loan never amortises).
 */
export function monthsToPayoff(principal, annualRatePct, monthlyPmt) {
  const P = Number(principal) || 0;
  const r = (Number(annualRatePct) || 0) / 100 / 12;
  const M = Number(monthlyPmt) || 0;
  if (P <= 0) return 0;
  if (r === 0) return M > 0 ? Math.ceil(P / M) : null;
  if (M <= P * r) return null; // payment doesn't cover interest
  // n = -log(1 - r*P/M) / log(1+r)
  return Math.ceil(-Math.log(1 - (r * P) / M) / Math.log(1 + r));
}

/**
 * Generate amortisation rows. Returns at most `maxRows` (caller decides
 * how many to display — e.g. first 6 + total summary).
 */
export function amortizationRows(principal, annualRatePct, termMonths, extraPerMonth = 0, maxRows = Infinity) {
  const P0 = Number(principal) || 0;
  const r = (Number(annualRatePct) || 0) / 100 / 12;
  const basePmt = monthlyPayment(P0, annualRatePct, termMonths);
  const pmt = basePmt + (Number(extraPerMonth) || 0);
  let balance = P0;
  const rows = [];
  let m = 0;
  while (balance > 0.01 && m < termMonths * 2 && m < maxRows + termMonths) {
    m += 1;
    const interest = balance * r;
    let principalPart = pmt - interest;
    if (principalPart > balance) principalPart = balance; // final payment
    balance -= principalPart;
    if (rows.length < maxRows) {
      rows.push({
        month: m,
        payment: principalPart + interest,
        interest,
        principal: principalPart,
        balance: Math.max(0, balance),
      });
    }
    if (balance <= 0.01) break;
  }
  return rows;
}
