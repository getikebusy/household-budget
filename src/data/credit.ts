import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import type { Tables, TablesInsert, TablesUpdate } from '../types/database';
import { useSession } from './auth';
import { useMyMembership } from './household';

type CreditAccountWrite = Omit<TablesInsert<'credit_accounts'>, 'user_id' | 'household_id' | 'id'>;
type CreditLogWrite = Omit<TablesInsert<'credit_score_logs'>, 'user_id' | 'id'>;

export function useCreditAccounts() {
  const { session } = useSession();

  return useQuery({
    queryKey: ['credit-accounts', session?.user.id ?? null],
    enabled: Boolean(session),
    queryFn: async (): Promise<Tables<'credit_accounts'>[]> => {
      const { data, error } = await supabase.from('credit_accounts').select('*').order('name');
      if (error) {
        throw error;
      }
      return data ?? [];
    },
  });
}

export function useCreateCreditAccount() {
  const queryClient = useQueryClient();
  const membership = useMyMembership();

  return useMutation({
    mutationFn: async (input: CreditAccountWrite) => {
      const householdId = membership.data?.household_id;
      const userId = membership.data?.user_id;
      if (!householdId || !userId) {
        throw new Error('Join a household first');
      }
      const { data, error } = await supabase
        .from('credit_accounts')
        .insert({ ...input, household_id: householdId, user_id: userId })
        .select('*')
        .single();
      if (error) {
        throw error;
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['credit-accounts'] });
    },
  });
}

export function useUpdateCreditAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...patch }: TablesUpdate<'credit_accounts'> & { id: string }) => {
      const { data, error } = await supabase
        .from('credit_accounts')
        .update(patch)
        .eq('id', id)
        .select('*')
        .maybeSingle();
      if (error) {
        throw error;
      }
      if (!data) {
        throw new Error('Credit account was not updated');
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['credit-accounts'] });
    },
  });
}

export function useDeleteCreditAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('credit_accounts').delete().eq('id', id);
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['credit-accounts'] });
    },
  });
}

export function useCreditLogs() {
  const { session } = useSession();

  return useQuery({
    queryKey: ['credit-logs', session?.user.id ?? null],
    enabled: Boolean(session),
    queryFn: async (): Promise<Tables<'credit_score_logs'>[]> => {
      const { data, error } = await supabase
        .from('credit_score_logs')
        .select('*')
        .order('month', { ascending: false });
      if (error) {
        throw error;
      }
      return data ?? [];
    },
  });
}

export function useCreateCreditLog() {
  const queryClient = useQueryClient();
  const { session } = useSession();

  return useMutation({
    mutationFn: async (input: CreditLogWrite) => {
      const userId = session?.user.id;
      if (!userId) {
        throw new Error('Sign in required');
      }
      const { data, error } = await supabase
        .from('credit_score_logs')
        .insert({ ...input, user_id: userId })
        .select('*')
        .single();
      if (error) {
        throw error;
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['credit-logs'] });
    },
  });
}

export function useUpdateCreditLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...patch }: TablesUpdate<'credit_score_logs'> & { id: string }) => {
      const { data, error } = await supabase
        .from('credit_score_logs')
        .update(patch)
        .eq('id', id)
        .select('*')
        .maybeSingle();
      if (error) {
        throw error;
      }
      if (!data) {
        throw new Error('Credit log was not updated');
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['credit-logs'] });
    },
  });
}

export function useUpsertCreditLog() {
  const queryClient = useQueryClient();
  const { session } = useSession();

  return useMutation({
    mutationFn: async (input: CreditLogWrite) => {
      const userId = session?.user.id;
      if (!userId) {
        throw new Error('Sign in required');
      }
      const { data, error } = await supabase
        .from('credit_score_logs')
        .upsert({ ...input, user_id: userId }, { onConflict: 'user_id,month' })
        .select('*')
        .single();
      if (error) {
        throw error;
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['credit-logs'] });
    },
  });
}

export function useDeleteCreditLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('credit_score_logs').delete().eq('id', id);
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['credit-logs'] });
    },
  });
}
