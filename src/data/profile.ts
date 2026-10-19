import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import type { Tables } from '../types/database';
import { useSession } from './auth';

export function useMyPrivate() {
  const { session } = useSession();

  return useQuery({
    queryKey: ['member-private', session?.user.id ?? null],
    enabled: Boolean(session),
    queryFn: async (): Promise<Tables<'member_private'> | null> => {
      if (!session) {
        return null;
      }
      const { data, error } = await supabase
        .from('member_private')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return data;
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { displayName: string; takeHomeCad: number }) => {
      const { error } = await supabase.rpc('update_my_profile', {
        p_display_name: input.displayName,
        p_take_home_cad: input.takeHomeCad,
      });
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['member-private'] });
      await queryClient.invalidateQueries({ queryKey: ['my-membership'] });
      await queryClient.invalidateQueries({ queryKey: ['members'] });
      await queryClient.invalidateQueries({ queryKey: ['month-summary'] });
    },
  });
}
