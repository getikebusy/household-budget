import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'pending-invite-token';

let memoryToken: string | null | undefined = undefined;

export async function savePendingInviteToken(token: string): Promise<void> {
  memoryToken = token;
  await AsyncStorage.setItem(STORAGE_KEY, token);
}

export async function clearPendingInviteToken(): Promise<void> {
  memoryToken = null;
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function getPendingInviteToken(): Promise<string | null> {
  if (memoryToken !== undefined) {
    return memoryToken;
  }
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  memoryToken = stored;
  return stored;
}

export function usePendingInviteToken(refreshKey?: string) {
  const [token, setToken] = useState<string | null | undefined>(memoryToken);

  useEffect(() => {
    let cancelled = false;
    void getPendingInviteToken().then((value) => {
      if (!cancelled) {
        setToken(value);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return { token: token ?? null, isLoading: token === undefined };
}
