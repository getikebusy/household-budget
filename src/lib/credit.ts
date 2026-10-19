import type { Enums } from '../types/database';

type UtilisationAccount = {
  type: Enums<'credit_type'>;
  current_balance: number;
  credit_limit: number;
  closed_on: string | null;
};

type StatementAccount = {
  name: string;
  statement_day: number | null;
  closed_on: string | null;
};

export function creditUtilisation(accounts: UtilisationAccount[]): number | null {
  const open = accounts.filter(
    (account) => !account.closed_on && (account.type === 'card' || account.type === 'line'),
  );
  const limit = open.reduce((sum, account) => sum + account.credit_limit, 0);
  if (limit <= 0) {
    return null;
  }
  return open.reduce((sum, account) => sum + account.current_balance, 0) / limit;
}

function dateInMonth(year: number, monthIndex: number, statementDay: number) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(statementDay, lastDay));
}

export function nextStatementDate(statementDay: number, today = new Date()) {
  const year = today.getFullYear();
  const monthIndex = today.getMonth();
  const thisMonth = dateInMonth(year, monthIndex, statementDay);
  const todayStart = new Date(year, monthIndex, today.getDate());
  if (thisMonth >= todayStart) {
    return thisMonth;
  }
  return dateInMonth(year, monthIndex + 1, statementDay);
}

export function daysUntil(date: Date, today = new Date()) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

export function soonestStatement(accounts: StatementAccount[], today = new Date()) {
  const upcoming = accounts
    .filter((account): account is StatementAccount & { statement_day: number } => {
      return account.statement_day != null && !account.closed_on;
    })
    .map((account) => {
      const date = nextStatementDate(account.statement_day, today);
      return { name: account.name, date, days: daysUntil(date, today) };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  return upcoming[0] ?? null;
}

export type UtilisationBand = 'Ideal' | 'Within ceiling' | 'Above ceiling';

export function utilisationBand(utilisation: number, ideal: number, ceiling: number): UtilisationBand {
  if (utilisation <= ideal) {
    return 'Ideal';
  }
  if (utilisation <= ceiling) {
    return 'Within ceiling';
  }
  return 'Above ceiling';
}

/** Position on a bar that runs from 0 to `scale` (default 50%). */
export function barShare(value: number, scale = 0.5) {
  if (scale <= 0) {
    return 0;
  }
  return Math.min(Math.max(value / scale, 0), 1);
}

type PaymentLog = {
  payments_due: number;
  paid_on_time: number;
};

export function onTimePaymentRate(logs: PaymentLog[]): number | null {
  const due = logs.reduce((sum, log) => sum + log.payments_due, 0);
  if (due <= 0) {
    return null;
  }
  return logs.reduce((sum, log) => sum + log.paid_on_time, 0) / due;
}

export type PaymentHealth = 'On target' | 'Below target';

export function paymentHealth(rate: number | null): PaymentHealth | null {
  if (rate == null) {
    return null;
  }
  return rate >= 1 ? 'On target' : 'Below target';
}

type InquiryLog = {
  month: string;
  hard_inquiries: number;
};

export function hardInquiriesLast12Months(logs: InquiryLog[], today = new Date()) {
  const start = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  const end = new Date(today.getFullYear(), today.getMonth(), 1);
  return logs.reduce((sum, log) => {
    const [year, month] = log.month.split('-').map(Number);
    const logged = new Date(year, (month ?? 1) - 1, 1);
    if (logged < start || logged > end) {
      return sum;
    }
    return sum + log.hard_inquiries;
  }, 0);
}

export type InquiryHealth = 'Within max' | 'Above max';

export function inquiryHealth(count: number, max: number): InquiryHealth {
  return count <= max ? 'Within max' : 'Above max';
}

export function accountAgeMonths(openedOn: string, today = new Date()) {
  const [year, month, day] = openedOn.split('-').map(Number);
  let months = (today.getFullYear() - year) * 12 + (today.getMonth() - (month - 1));
  if (today.getDate() < day) {
    months -= 1;
  }
  return Math.max(0, months);
}

type AgedAccount = {
  opened_on: string | null;
  closed_on: string | null;
};

export function oldestOpenAccountMonths(accounts: AgedAccount[], today = new Date()): number | null {
  const ages = accounts
    .filter((account): account is AgedAccount & { opened_on: string } => {
      return !account.closed_on && account.opened_on != null;
    })
    .map((account) => accountAgeMonths(account.opened_on, today));
  if (ages.length === 0) {
    return null;
  }
  return Math.max(...ages);
}

type AttentionAccount = UtilisationAccount & StatementAccount;

export type AttentionReason = 'utilisation' | 'statement';

export function accountsNeedingAttention(
  accounts: AttentionAccount[],
  ceiling: number,
  alertDays: number,
  today = new Date(),
) {
  return accounts.flatMap((account) => {
    if (account.closed_on) {
      return [];
    }
    const reasons: AttentionReason[] = [];
    if ((account.type === 'card' || account.type === 'line') && account.credit_limit > 0) {
      if (account.current_balance / account.credit_limit > ceiling) {
        reasons.push('utilisation');
      }
    }
    if (account.statement_day != null) {
      const date = nextStatementDate(account.statement_day, today);
      if (daysUntil(date, today) <= alertDays) {
        reasons.push('statement');
      }
    }
    return reasons.length > 0 ? [{ name: account.name, reasons }] : [];
  });
}
