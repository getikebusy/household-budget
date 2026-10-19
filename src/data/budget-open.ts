import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import type { BudgetBucket } from '../lib/budget';

const STORAGE_KEY = 'budget-bucket-open';

export type BucketOpenState = Record<BudgetBucket, boolean>;

const DEFAULT_OPEN: BucketOpenState = {
  needs: true,
  investment: true,
  emergency: true,
};

export function useBucketOpen() {
  const [open, setOpen] = useState<BucketOpenState>(DEFAULT_OPEN);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (cancelled || !raw) {
        return;
      }
      try {
        const parsed = JSON.parse(raw) as Partial<BucketOpenState>;
        setOpen((current) => ({
          needs: parsed.needs ?? current.needs,
          investment: parsed.investment ?? current.investment,
          emergency: parsed.emergency ?? current.emergency,
        }));
      } catch {
        // Keep the sections open when the stored value is unreadable.
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function setBucketOpen(bucket: BudgetBucket, next: boolean) {
    setOpen((current) => {
      const updated = { ...current, [bucket]: next };
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }

  return { open, setBucketOpen };
}
