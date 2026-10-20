import { useQuery } from '@tanstack/react-query';
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
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

type SessionValue = { session: Session | null; isLoading: boolean };

const SessionContext = createContext<SessionValue | null>(null);

let awaitingLoginCode = false;
let recoveringPassword = false;

export function beginLoginVerification() {
  awaitingLoginCode = true;
}

export function cancelLoginVerification() {
  awaitingLoginCode = false;
}

export function isAwaitingLoginCode() {
  return awaitingLoginCode;
}

export function beginPasswordRecovery() {
  recoveringPassword = true;
}

export function cancelPasswordRecovery() {
  recoveringPassword = false;
}

export function isRecoveringPassword() {
  return recoveringPassword;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) {
        return;
      }
      if (!data.session) {
        setSession(null);
        return;
      }
      const { error } = await supabase.auth.getUser();
      if (cancelled) {
        return;
      }
      if (error) {
        cancelLoginVerification();
        await supabase.auth.signOut();
        if (!cancelled) {
          setSession(null);
        }
        return;
      }
      setSession(data.session);
    })();

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY' && !isRecoveringPassword()) {
        void supabase.auth.signOut();
        setSession(null);
        return;
      }
      setSession(next);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ session: session ?? null, isLoading: session === undefined }),
    [session],
  );

  return createElement(SessionContext.Provider, { value }, children);
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return ctx;
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
    enabled: Boolean(session) && !isRecoveringPassword(),
  });
}

export function useMyHousehold(enabled: boolean) {
  const { session } = useSession();

  return useQuery({
    queryKey: ['my-household', session?.user.id ?? null],
    queryFn: async () => {
      if (!session) {
        return null;
      }
      // Household read policy returns every member. maybeSingle without this
      // filter errors once a partner has joined, and the app treats that as
      // "no household".
      const { data, error } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', session.user.id)
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

export async function invokeFunction<T>(name: string, body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, body ? { body } : undefined);
  if (!error) {
    return data as T;
  }
  const payload = await readFunctionError(error);
  throw new AuthFlowError(payload?.error ?? error.message, payload);
}

export function appOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://household-budget-alpha-seven.vercel.app';
}

export async function requestPasswordReset(email: string): Promise<void> {
  beginPasswordRecovery();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appOrigin()}/forgot-password`,
  });
}

export async function completePasswordReset(params: {
  email: string;
  token: string;
  password: string;
}): Promise<void> {
  beginPasswordRecovery();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    email: params.email,
    token: params.token,
    type: 'recovery',
  });
  if (verifyError) {
    throw new AuthFlowError('That code is invalid or has expired.');
  }
  const { error: updateError } = await supabase.auth.updateUser({ password: params.password });
  if (updateError) {
    throw updateError;
  }
  await signOut();
}

export async function abandonPasswordRecovery(): Promise<void> {
  cancelPasswordRecovery();
  await supabase.auth.signOut();
  queryClient.clear();
}

export async function sendLoginCode(): Promise<{ sent?: boolean; alreadyVerified?: boolean }> {
  beginLoginVerification();
  try {
    const result = await invokeFunction<{ sent?: boolean; alreadyVerified?: boolean }>('send-login-otp');
    if (result.alreadyVerified) {
      cancelLoginVerification();
    }
    return result;
  } catch (error) {
    const payload = (error as AuthFlowError).payload;
    if (payload?.error !== 'wait' && payload?.error !== 'too_many') {
      cancelLoginVerification();
    }
    throw error;
  }
}

export async function verifyLoginCode(code: string): Promise<{ verified: boolean }> {
  const result = await invokeFunction<{ verified: boolean }>('verify-login-otp', { code });
  cancelLoginVerification();
  return result;
}

export async function clearLocalSession(): Promise<void> {
  cancelLoginVerification();
  cancelPasswordRecovery();
  await supabase.auth.signOut();
  queryClient.clear();
}

export async function signOut(): Promise<void> {
  try {
    await invokeFunction('end-session');
  } catch {
    // Always clear the local session even if the Edge Function fails.
  }
  await clearLocalSession();
}

export const passwordSchemaMessage =
  'Use at least 10 characters, including a letter and a number.';
