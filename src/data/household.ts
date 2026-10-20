import { useQuery } from '@tanstack/react-query';

import { queryClient } from '../lib/query-client';
import { supabase } from '../lib/supabase';
import { AuthFlowError, invokeFunction, useSession } from './auth';

export type HouseholdMember = {
  display_name: string;
  role: 'primary' | 'partner';
  joint_share: number;
};

export type MyMembership = {
  user_id: string;
  household_id: string;
  display_name: string;
  role: 'primary' | 'partner';
  joint_share: number;
  created_at: string;
  households: { name: string } | null;
};

export function useMyMembership() {
  const { session } = useSession();

  return useQuery({
    queryKey: ['my-membership', session?.user.id ?? null],
    queryFn: async (): Promise<MyMembership | null> => {
      if (!session) {
        return null;
      }
      const { data, error } = await supabase
        .from('household_members')
        .select(
          'user_id, household_id, display_name, role, joint_share, created_at, households ( name )',
        )
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return data as MyMembership | null;
    },
    enabled: Boolean(session),
  });
}

export function usePendingInvite(enabled: boolean) {
  const { session } = useSession();

  return useQuery({
    queryKey: ['invites', session?.user.id ?? null],
    enabled: Boolean(session) && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invites')
        .select('id, email, expires_at, accepted_at, created_at')
        .is('accepted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return data;
    },
  });
}

export function useMembers() {
  const { session } = useSession();

  return useQuery({
    queryKey: ['members', session?.user.id ?? null],
    queryFn: async (): Promise<HouseholdMember[]> => {
      const { data, error } = await supabase
        .from('household_members')
        .select('display_name, role, joint_share')
        .order('role');
      if (error) {
        throw error;
      }
      return data ?? [];
    },
    enabled: Boolean(session),
  });
}

export async function createHousehold(params: {
  displayName: string;
  takeHomeCad: number;
  rentTotalCad: number;
  householdName: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_household', {
    p_display_name: params.displayName,
    p_take_home_cad: params.takeHomeCad,
    p_rent_total_cad: params.rentTotalCad,
    p_household_name: params.householdName,
  });
  if (error) {
    throw error;
  }
  await queryClient.invalidateQueries();
  return data;
}

export async function sendInvite(email: string): Promise<{ sent: boolean }> {
  return invokeFunction('send-invite', { email });
}

export async function acceptInvite(params: {
  token: string;
  displayName: string;
  takeHomeCad: number;
}): Promise<string> {
  const { data, error } = await supabase.rpc('accept_invite', {
    p_token: params.token,
    p_display_name: params.displayName,
    p_take_home_cad: params.takeHomeCad,
  });
  if (error) {
    throw new AuthFlowError(error.message);
  }
  await queryClient.invalidateQueries();
  return data;
}

export async function removePartner(): Promise<void> {
  const { error } = await supabase.rpc('remove_partner');
  if (error) {
    throw error;
  }
  await queryClient.invalidateQueries();
}

export async function cancelInvite(): Promise<void> {
  const { error } = await supabase.rpc('cancel_invite');
  if (error) {
    throw error;
  }
  await queryClient.invalidateQueries({ queryKey: ['invites'] });
}
