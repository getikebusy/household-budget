import type { Enums } from '../types/database';

export type BudgetBucket = Enums<'budget_bucket'>;
export type BucketStatus = 'Within limit' | 'Over limit' | 'On target' | 'Below target';

export function bucketStatus(
  bucket: BudgetBucket,
  plannedShare: number,
  target: number,
): BucketStatus {
  if (bucket === 'needs') {
    return plannedShare <= target ? 'Within limit' : 'Over limit';
  }
  return plannedShare >= target ? 'On target' : 'Below target';
}

export function toCad(amount: number, currency: Enums<'currency_code'>, rate: number): number {
  if (currency === 'CAD') {
    return roundMoney(amount);
  }
  if (!(rate > 0)) {
    throw new Error('Exchange rate must be greater than zero');
  }
  return roundMoney(amount / rate);
}

function roundMoney(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
