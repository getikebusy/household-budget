import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { toCad } from '../lib/budget';
import { supabase } from '../lib/supabase';
import type { Enums, TablesInsert, TablesUpdate } from '../types/database';
import { useSession } from './auth';
import { useMyMembership } from './household';

export type TransactionInput = {
  amount: number;
  currency: Enums<'currency_code'>;
  category_id: string;
  description?: string;
  scope: Enums<'txn_scope'>;
  type: Enums<'txn_type'>;
  occurred_on: string;
  account_id?: string | null;
  fx_ngn_per_cad?: number | null;
};

function amountCad(input: Pick<TransactionInput, 'amount' | 'currency' | 'fx_ngn_per_cad'>) {
  if (input.currency === 'NGN') {
    return toCad(input.amount, 'NGN', input.fx_ngn_per_cad ?? 0);
  }
  return toCad(input.amount, 'CAD', 1);
}

function transactionColumns(
  input: TransactionInput,
  householdId: string,
  userId: string,
): TablesInsert<'transactions'> {
  return {
    household_id: householdId,
    created_by: userId,
    amount: input.amount,
    amount_cad: amountCad(input),
    currency: input.currency,
    fx_ngn_per_cad: input.currency === 'NGN' ? (input.fx_ngn_per_cad ?? null) : null,
    category_id: input.category_id,
    description: input.description ?? '',
    scope: input.scope,
    type: input.type,
    occurred_on: input.occurred_on,
    account_id: input.account_id ?? null,
  };
}

async function refreshActivity(queryClient: ReturnType<typeof useQueryClient>) {
  await queryClient.invalidateQueries({ queryKey: ['month-summary'] });
  await queryClient.invalidateQueries({ queryKey: ['feed'] });
  await queryClient.invalidateQueries({ queryKey: ['transaction'] });
}

export function useTransaction(id: string | undefined) {
  const { session } = useSession();

  return useQuery({
    queryKey: ['transaction', id ?? null],
    enabled: Boolean(session && id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', id ?? '')
        .maybeSingle();
      if (error) {
        throw error;
      }
      return data;
    },
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  const membership = useMyMembership();

  return useMutation({
    mutationFn: async (input: TransactionInput) => {
      const householdId = membership.data?.household_id;
      const userId = membership.data?.user_id;
      if (!householdId || !userId) {
        throw new Error('Join a household first');
      }
      const { data, error } = await supabase
        .from('transactions')
        .insert(transactionColumns(input, householdId, userId))
        .select('*')
        .single();
      if (error) {
        throw error;
      }
      return data;
    },
    onSuccess: async () => {
      await refreshActivity(queryClient);
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: TransactionInput & { id: string }) => {
      const patch: TablesUpdate<'transactions'> = {
        amount: input.amount,
        amount_cad: amountCad(input),
        currency: input.currency,
        fx_ngn_per_cad: input.currency === 'NGN' ? (input.fx_ngn_per_cad ?? null) : null,
        category_id: input.category_id,
        description: input.description ?? '',
        scope: input.scope,
        type: input.type,
        occurred_on: input.occurred_on,
        account_id: input.account_id ?? null,
      };
      const { data, error } = await supabase
        .from('transactions')
        .update(patch)
        .eq('id', id)
        .select('*')
        .maybeSingle();
      if (error) {
        throw error;
      }
      if (!data) {
        throw new Error('Transaction was not updated');
      }
      return data;
    },
    onSuccess: async () => {
      await refreshActivity(queryClient);
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await refreshActivity(queryClient);
    },
  });
}
