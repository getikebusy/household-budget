import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import type { Enums, Tables, TablesUpdate } from '../types/database';
import { useSession } from './auth';
import { primaryOnlyError, primaryOnlyIfEmpty } from './errors';
import { useMyMembership } from './household';
import { ensureBudgetMonth } from './summary';

export type BudgetLineWithCategory = Tables<'budget_lines'> & {
  categories: Tables<'categories'> | null;
};

export function useCategories() {
  const { session } = useSession();

  return useQuery({
    queryKey: ['categories', session?.user.id ?? null],
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order');
      if (error) {
        throw error;
      }
      return data ?? [];
    },
  });
}

export function useAccounts() {
  const { session } = useSession();

  return useQuery({
    queryKey: ['accounts', session?.user.id ?? null],
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error } = await supabase.from('accounts').select('*').order('name');
      if (error) {
        throw error;
      }
      return data ?? [];
    },
  });
}

export function useBudgetLines(month: string) {
  const { session } = useSession();
  const userId = session?.user.id ?? null;

  return useQuery({
    queryKey: ['budget-lines', month, userId],
    enabled: Boolean(userId && month),
    queryFn: async (): Promise<BudgetLineWithCategory[]> => {
      await ensureBudgetMonth(month);
      const { data, error } = await supabase
        .from('budget_lines')
        .select('*, categories(*)')
        .eq('month', month)
        .eq('user_id', userId ?? '');
      if (error) {
        throw error;
      }
      return (data ?? []) as BudgetLineWithCategory[];
    },
  });
}

export function useUpdateBudgetLine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: { id: string } & Pick<TablesUpdate<'budget_lines'>, 'split_pct' | 'fixed_amount_cad'>) => {
      const { data, error } = await supabase
        .from('budget_lines')
        .update(patch)
        .eq('id', id)
        .select('*, categories(*)')
        .maybeSingle();
      if (error) {
        throw error;
      }
      if (!data) {
        throw new Error('Budget line was not updated');
      }
      return data as BudgetLineWithCategory;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['budget-lines'] });
      await queryClient.invalidateQueries({ queryKey: ['month-summary'] });
    },
  });
}

type NewCategory = {
  name: string;
  kind: Enums<'category_kind'>;
  bucket: Enums<'budget_bucket'> | null;
  defaultSplit: number | null;
  sortOrder: number;
};

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const membership = useMyMembership();

  return useMutation({
    mutationFn: async (input: NewCategory) => {
      const householdId = membership.data?.household_id;
      if (!householdId) {
        throw new Error('Join a household first');
      }
      const { data, error } = await supabase
        .from('categories')
        .insert({
          household_id: householdId,
          name: input.name,
          kind: input.kind,
          bucket: input.kind === 'income' ? null : input.bucket,
          default_split: input.kind === 'income' ? null : input.defaultSplit,
          sort_order: input.sortOrder,
        })
        .select('*')
        .single();
      if (error) {
        throw primaryOnlyError(error);
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & TablesUpdate<'categories'>) => {
      const { data, error } = await supabase
        .from('categories')
        .update(patch)
        .eq('id', id)
        .select('*')
        .maybeSingle();
      if (error) {
        throw primaryOnlyError(error);
      }
      if (!data) {
        throw primaryOnlyIfEmpty();
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      await queryClient.invalidateQueries({ queryKey: ['month-summary'] });
    },
  });
}

type NewAccount = {
  name: string;
  type: Enums<'account_type'>;
  currency: Enums<'currency_code'>;
};

export function useCreateAccount() {
  const queryClient = useQueryClient();
  const membership = useMyMembership();

  return useMutation({
    mutationFn: async (input: NewAccount) => {
      const householdId = membership.data?.household_id;
      if (!householdId) {
        throw new Error('Join a household first');
      }
      const { data, error } = await supabase
        .from('accounts')
        .insert({
          household_id: householdId,
          name: input.name,
          type: input.type,
          currency: input.currency,
        })
        .select('*')
        .single();
      if (error) {
        throw primaryOnlyError(error);
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}
