import { useQuery } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import type { Enums, Json } from '../types/database';
import { useSession } from './auth';
import type { BudgetView } from './view';

export type MonthSummaryCategory = {
  id: string;
  name: string;
  bucket: Enums<'budget_bucket'> | null;
  sort_order: number;
  planned: number;
  spent: number;
};

export type MonthSummaryBucket = {
  planned: number;
  spent: number;
};

export type MonthSummary = {
  month: string;
  view: BudgetView;
  budgeted_income: number;
  actual_income: number;
  targets: {
    needs: number;
    investment: number;
    emergency: number;
  };
  categories: MonthSummaryCategory[];
  buckets: Partial<Record<Enums<'budget_bucket'>, MonthSummaryBucket>>;
};

const ensuredMonths = new Set<string>();

export async function ensureBudgetMonth(month: string) {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id ?? 'signed-out';
  const key = `${userId}:${month}`;
  if (ensuredMonths.has(key)) {
    return;
  }
  const { error } = await supabase.rpc('ensure_budget_month', { p_month: month });
  if (error) {
    throw error;
  }
  ensuredMonths.add(key);
}

function asMonthSummary(value: Json): MonthSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Month summary was empty');
  }
  return value as MonthSummary;
}

export function useMonthSummary(month: string, view: BudgetView) {
  const { session } = useSession();

  return useQuery({
    queryKey: ['month-summary', month, view],
    enabled: Boolean(session && month && view),
    queryFn: async (): Promise<MonthSummary> => {
      await ensureBudgetMonth(month);
      const { data, error } = await supabase.rpc('get_month_summary', {
        p_month: month,
        p_view: view,
      });
      if (error) {
        throw error;
      }
      return asMonthSummary(data);
    },
  });
}

export function useFeed(month: string, view: BudgetView, limit = 20) {
  const { session } = useSession();

  return useQuery({
    queryKey: ['feed', month, view, limit],
    enabled: Boolean(session && month && view),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_feed', {
        p_month: month,
        p_view: view,
        p_limit: limit,
      });
      if (error) {
        throw error;
      }
      return data ?? [];
    },
  });
}
