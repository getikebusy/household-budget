const MINUS = '−';

function formatGrouped(amount: number, fractionDigits: number) {
  return new Intl.NumberFormat('en-CA', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Math.abs(amount));
}

function withSign(amount: number, body: string) {
  return amount < 0 ? `${MINUS}${body}` : body;
}

export function formatCAD(amount: number) {
  return withSign(amount, `$${formatGrouped(amount, 2)}`);
}

export function formatCADWhole(amount: number) {
  return withSign(amount, `$${formatGrouped(amount, 0)}`);
}

export function formatNGN(amount: number) {
  return withSign(amount, `₦${formatGrouped(amount, 2)}`);
}

export type CurrencyCode = 'CAD' | 'USD' | 'GBP' | 'NGN';

export const CURRENCIES: readonly CurrencyCode[] = ['CAD', 'USD', 'GBP', 'NGN'];

export const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  CAD: '$',
  USD: 'US$',
  GBP: '£',
  NGN: '₦',
};

export function formatMoney(amount: number, currency: CurrencyCode, whole = false) {
  return withSign(amount, `${CURRENCY_SYMBOL[currency]}${formatGrouped(amount, whole ? 0 : 2)}`);
}

export function formatPercent(fraction: number, dp = 1) {
  return `${(fraction * 100).toFixed(dp)}%`;
}
