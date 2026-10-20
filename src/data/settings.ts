import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import type { Tables, TablesUpdate } from '../types/database';
import { invokeFunction, useSession } from './auth';
import { primaryOnlyError, primaryOnlyIfEmpty } from './errors';
import { useMyMembership } from './household';

export type HouseholdSettings = Tables<'household_settings'>;
export type FxRate = Tables<'fx_rates'>;

export type FxQuote = 'NGN' | 'USD' | 'GBP';
export type FxQuoteMap = Partial<Record<FxQuote, FxRate>>;

export function effectiveRate(
  settings: Pick<HouseholdSettings, 'fx_override_ngn_per_cad'> | null | undefined,
  latest: Pick<FxRate, 'rate'> | null | undefined,
): number | null {
  return settings?.fx_override_ngn_per_cad ?? latest?.rate ?? null;
}

export function rateForCurrency(
  currency: 'CAD' | FxQuote,
  quotes: FxQuoteMap | undefined,
  ngnOverride: number | null | undefined,
): number | null {
  if (currency === 'CAD') {
    return 1;
  }
  if (currency === 'NGN') {
    return ngnOverride ?? quotes?.NGN?.rate ?? null;
  }
  return quotes?.[currency]?.rate ?? null;
}

export function useSettings() {
  const { session } = useSession();

  return useQuery({
    queryKey: ['settings', session?.user.id ?? null],
    enabled: Boolean(session),
    queryFn: async (): Promise<HouseholdSettings | null> => {
      const { data, error } = await supabase.from('household_settings').select('*').maybeSingle();
      if (error) {
        throw error;
      }
      return data;
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const membership = useMyMembership();

  return useMutation({
    mutationFn: async (patch: TablesUpdate<'household_settings'>) => {
      const householdId = membership.data?.household_id;
      if (!householdId) {
        throw new Error('Join a household first');
      }
      const { data, error } = await supabase
        .from('household_settings')
        .update(patch)
        .eq('household_id', householdId)
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
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      await queryClient.invalidateQueries({ queryKey: ['month-summary'] });
    },
  });
}

export function useSetJointShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (primaryShare: number) => {
      const { error } = await supabase.rpc('set_joint_share', { p_primary_share: primaryShare });
      if (error) {
        throw primaryOnlyError(error);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['members'] });
      await queryClient.invalidateQueries({ queryKey: ['my-membership'] });
      await queryClient.invalidateQueries({ queryKey: ['month-summary'] });
    },
  });
}

export function useSetPartnerName() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (displayName: string) => {
      const { error } = await supabase.rpc('set_partner_display_name', {
        p_display_name: displayName,
      });
      if (error) {
        throw primaryOnlyError(error);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['members'] });
      await queryClient.invalidateQueries({ queryKey: ['my-membership'] });
    },
  });
}

export function useFxQuotes() {
  const { session } = useSession();

  return useQuery({
    queryKey: ['fx-rates'],
    enabled: Boolean(session),
    queryFn: async (): Promise<FxQuoteMap> => {
      const { data, error } = await supabase
        .from('fx_rates')
        .select('*')
        .eq('base', 'CAD')
        .in('quote', ['NGN', 'USD', 'GBP'])
        .order('fetched_at', { ascending: false })
        .limit(30);
      if (error) {
        throw error;
      }
      const latest: FxQuoteMap = {};
      for (const row of data ?? []) {
        if ((row.quote === 'NGN' || row.quote === 'USD' || row.quote === 'GBP') && !latest[row.quote]) {
          latest[row.quote] = row;
        }
      }
      return latest;
    },
  });
}

export type FxSyncResult = { ok: true; skipped: boolean };

export function useSyncFxRates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => invokeFunction<FxSyncResult>('fx-sync'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['fx-rates'] });
    },
  });
}
