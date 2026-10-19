export function errorText(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Something went wrong';
}

export function moneyToInput(amount: number): string {
  return amount.toFixed(2).replace(/\.00$/, '');
}

export function parseMoney(text: string): number | null {
  const value = Number(text.replace(/,/g, '').trim());
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.round(value * 100) / 100;
}

export function fractionToWhole(fraction: number): string {
  return String(Math.round(fraction * 100));
}

export function parseWholePercent(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) {
    return null;
  }
  const whole = Number(text);
  if (whole > 100) {
    return null;
  }
  return whole;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.round(Math.max(0, now - Date.parse(iso)) / 60000);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
