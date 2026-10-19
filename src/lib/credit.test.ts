/// <reference types="jest" />

import {
  accountAgeMonths,
  accountsNeedingAttention,
  barShare,
  creditUtilisation,
  daysUntil,
  hardInquiriesLast12Months,
  inquiryHealth,
  nextStatementDate,
  oldestOpenAccountMonths,
  onTimePaymentRate,
  paymentHealth,
  soonestStatement,
  utilisationBand,
} from './credit';

function ymd(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

describe('nextStatementDate', () => {
  it('clamps a 31st onto short months, including a leap-year February', () => {
    expect(ymd(nextStatementDate(31, new Date(2026, 1, 1)))).toBe('2026-02-28');
    expect(ymd(nextStatementDate(31, new Date(2024, 1, 1)))).toBe('2024-02-29');
    expect(ymd(nextStatementDate(31, new Date(2026, 3, 1)))).toBe('2026-04-30');
  });

  it('stays in the current month through the statement day, then rolls forward', () => {
    expect(ymd(nextStatementDate(15, new Date(2026, 9, 10)))).toBe('2026-10-15');
    expect(ymd(nextStatementDate(19, new Date(2026, 9, 19)))).toBe('2026-10-19');
    expect(ymd(nextStatementDate(15, new Date(2026, 9, 16)))).toBe('2026-11-15');
  });

  it('rolls a passed month-end statement into the next month', () => {
    expect(ymd(nextStatementDate(31, new Date(2026, 0, 31)))).toBe('2026-01-31');
    expect(ymd(nextStatementDate(31, new Date(2026, 1, 28)))).toBe('2026-02-28');
    expect(ymd(nextStatementDate(31, new Date(2026, 2, 1)))).toBe('2026-03-31');
  });
});

describe('creditUtilisation', () => {
  const card = {
    type: 'card' as const,
    current_balance: 350,
    credit_limit: 1000,
    closed_on: null,
    name: 'Newcomer',
    statement_day: 20,
  };

  it('uses open cards and lines only', () => {
    expect(
      creditUtilisation([
        card,
        { type: 'line', current_balance: 0, credit_limit: 500, closed_on: null },
        { type: 'loan', current_balance: 9000, credit_limit: 10000, closed_on: null },
        { type: 'card', current_balance: 400, credit_limit: 400, closed_on: '2026-01-01' },
      ]),
    ).toBeCloseTo(350 / 1500);
  });

  it('returns null when an open card has no limit', () => {
    expect(creditUtilisation([{ type: 'card', current_balance: 10, credit_limit: 0, closed_on: null }])).toBeNull();
  });

  it('rolls a passed statement day into a shorter next month', () => {
    expect(ymd(nextStatementDate(30, new Date(2026, 0, 31)))).toBe('2026-02-28');
  });

  it('returns null when there is no revolving limit', () => {
    expect(creditUtilisation([])).toBeNull();
    expect(creditUtilisation([{ type: 'loan', current_balance: 100, credit_limit: 1000, closed_on: null }])).toBeNull();
  });

  it('marks 35% above a 30% ceiling and counts that account once', () => {
    expect(creditUtilisation([card])).toBeCloseTo(0.35);
    expect(utilisationBand(0.35, 0.1, 0.3)).toBe('Above ceiling');
    expect(utilisationBand(0.1, 0.1, 0.3)).toBe('Ideal');
    expect(utilisationBand(0.3, 0.1, 0.3)).toBe('Within ceiling');
    expect(accountsNeedingAttention([card], 0.3, 3, new Date(2026, 9, 1))).toEqual([
      { name: 'Newcomer', reasons: ['utilisation'] },
    ]);
  });
});

describe('credit health', () => {
  it('rates on-time payments against a 100% target', () => {
    expect(onTimePaymentRate([{ payments_due: 0, paid_on_time: 0 }])).toBeNull();
    expect(paymentHealth(null)).toBeNull();
    expect(onTimePaymentRate([
      { payments_due: 4, paid_on_time: 4 },
      { payments_due: 6, paid_on_time: 5 },
    ])).toBeCloseTo(0.9);
    expect(paymentHealth(1)).toBe('On target');
    expect(paymentHealth(0.9)).toBe('Below target');
  });

  it('sums hard inquiries from the last 12 months', () => {
    const today = new Date(2026, 9, 19);
    expect(
      hardInquiriesLast12Months(
        [
          { month: '2025-10-01', hard_inquiries: 4 },
          { month: '2025-11-01', hard_inquiries: 1 },
          { month: '2026-10-01', hard_inquiries: 2 },
        ],
        today,
      ),
    ).toBe(3);
    expect(inquiryHealth(2, 2)).toBe('Within max');
    expect(inquiryHealth(3, 2)).toBe('Above max');
  });

  it('measures the oldest open account in whole months', () => {
    expect(accountAgeMonths('2025-01-15', new Date(2026, 9, 19))).toBe(21);
    expect(accountAgeMonths('2025-01-31', new Date(2026, 9, 19))).toBe(20);
    expect(
      oldestOpenAccountMonths(
        [
          { opened_on: '2025-06-01', closed_on: null },
          { opened_on: '2020-01-01', closed_on: '2024-01-01' },
          { opened_on: null, closed_on: null },
        ],
        new Date(2026, 9, 19),
      ),
    ).toBe(16);
  });

  it('flags a statement that falls inside the alert window', () => {
    expect(
      accountsNeedingAttention(
        [
          {
            name: 'Visa',
            type: 'card',
            current_balance: 50,
            credit_limit: 1000,
            closed_on: null,
            statement_day: 4,
          },
        ],
        0.3,
        3,
        new Date(2026, 9, 1),
      ),
    ).toEqual([{ name: 'Visa', reasons: ['statement'] }]);
  });

  it('ignores closed accounts and loans, and can flag both reasons', () => {
    const today = new Date(2026, 9, 1);
    expect(
      accountsNeedingAttention(
        [
          {
            name: 'Closed',
            type: 'card',
            current_balance: 900,
            credit_limit: 1000,
            closed_on: '2026-01-01',
            statement_day: 2,
          },
          {
            name: 'Loan',
            type: 'loan',
            current_balance: 900,
            credit_limit: 1000,
            closed_on: null,
            statement_day: 20,
          },
          {
            name: 'Quiet',
            type: 'card',
            current_balance: 10,
            credit_limit: 0,
            closed_on: null,
            statement_day: null,
          },
        ],
        0.3,
        3,
        today,
      ),
    ).toEqual([]);
    expect(
      accountsNeedingAttention(
        [
          {
            name: 'Both',
            type: 'line',
            current_balance: 400,
            credit_limit: 1000,
            closed_on: null,
            statement_day: 2,
          },
        ],
        0.3,
        3,
        today,
      ),
    ).toEqual([{ name: 'Both', reasons: ['utilisation', 'statement'] }]);
  });

  it('picks the soonest open statement and places the utilisation bar', () => {
    const today = new Date(2026, 9, 1);
    expect(soonestStatement([])).toBeNull();
    const soonest = soonestStatement(
      [
        { name: 'Later', statement_day: 20, closed_on: null },
        { name: 'Closed', statement_day: 2, closed_on: '2026-01-01' },
        { name: 'Unset', statement_day: null, closed_on: null },
        { name: 'Soon', statement_day: 4, closed_on: null },
      ],
      today,
    );
    expect(soonest?.name).toBe('Soon');
    expect(ymd(soonest?.date ?? today)).toBe('2026-10-04');
    expect(soonest?.days).toBe(daysUntil(new Date(2026, 9, 4), today));
    expect(barShare(0.25)).toBe(0.5);
    expect(barShare(1)).toBe(1);
    expect(barShare(-1)).toBe(0);
    expect(barShare(0.2, 0)).toBe(0);
  });

  it('covers inquiry windows, a future open date, and no open accounts', () => {
    const today = new Date(2026, 9, 19);
    expect(
      hardInquiriesLast12Months(
        [
          { month: '2027-01-01', hard_inquiries: 9 },
          { month: '2026', hard_inquiries: 0 },
        ],
        today,
      ),
    ).toBe(0);
    expect(accountAgeMonths('2027-01-31', today)).toBe(0);
    expect(accountAgeMonths('2020-01-01')).toBeGreaterThan(0);
    expect(oldestOpenAccountMonths([])).toBeNull();
    expect(nextStatementDate(15)).toBeInstanceOf(Date);
    expect(daysUntil(new Date())).toBe(0);
    expect(hardInquiriesLast12Months([])).toBe(0);
    expect(accountsNeedingAttention([], 0.3, 3)).toEqual([]);
  });
});
