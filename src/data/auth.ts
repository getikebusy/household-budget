import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { queryClient } from '../lib/query-client';
import { supabase } from '../lib/supabase';

export type FunctionErrorPayload = {
  error?: string;
  attemptsLeft?: number;
  retryAfterSeconds?: number;
};

export class AuthFlowError extends Error {
  payload?: FunctionErrorPayload;

  constructor(message: string, payload?: FunctionErrorPayload) {
    super(message);
    this.name = 'AuthFlowError';
    this.payload = payload;
  }
}

export function useSession(): { session: Session | null; isLoading: boolean } {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setSession(data.session);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  return { session: session ?? null, isLoading: session === undefined };
}

export function useSessionVerified() {
  const { session } = useSession();

  return useQuery({
    queryKey: ['session-verified', session?.access_token ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_session_verified');
      if (error) {
        throw error;
      }
      return data === true;
    },
    enabled: Boolean(session),
  });
}

export function useMyHousehold(enabled: boolean) {
  const { session } = useSession();

  return useQuery({
    queryKey: ['my-household', session?.user.id ?? null],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('household_members')
        .select('household_id')
        .maybeSingle();
      if (error) {
        throw error;
      }
      return data;
    },
    enabled: Boolean(session) && enabled,
  });
}

async function readFunctionError(error: unknown): Promise<FunctionErrorPayload | undefined> {
  const context = (error as { context?: Response }).context;
  if (!context || typeof context.json !== 'function') {
    return undefined;
  }
  try {
    return (await context.json()) as FunctionErrorPayload;
  } catch {
    return undefined;
  }
}

async function invokeFunction<T>(name: string, body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, body ? { body } : undefined);
  if (!error) {
    return data as T;
  }
  const payload = await readFunctionError(error);
  throw new AuthFlowError(payload?.error ?? error.message, payload);
}

export async function sendLoginCode(): Promise<{ sent?: boolean; alreadyVerified?: boolean }> {
  return invokeFunction('send-login-otp');
}

export async function verifyLoginCode(code: string): Promise<{ verified: boolean }> {
  return invokeFunction('verify-login-otp', { code });
}

export async function signOut(): Promise<void> {
  try {
    await invokeFunction('end-session');
  } catch {
    // Always clear the local session even if the Edge Function fails.
  }
  await supabase.auth.signOut();
  queryClient.clear();
}

export const passwordSchemaMessage =
  'Use at least 10 characters, including a letter and a number.';
