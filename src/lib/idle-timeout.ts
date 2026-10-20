import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

export const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

const STORAGE_KEY = 'last-activity-at';
const CHECK_INTERVAL_MS = 30 * 1000;
// Activity fires constantly (mouse moves, scrolls). Persist at most this often.
const PERSIST_THROTTLE_MS = 15 * 1000;
const WEB_ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll', 'mousemove'] as const;

let lastActivityAt = Date.now();
let lastPersistedAt = 0;
let signedOutForIdle = false;

export function recordActivity(now = Date.now(), force = false) {
  lastActivityAt = now;
  if (force || now - lastPersistedAt >= PERSIST_THROTTLE_MS) {
    lastPersistedAt = now;
    void AsyncStorage.setItem(STORAGE_KEY, String(now));
  }
}

export async function clearActivity(): Promise<void> {
  lastPersistedAt = 0;
  await AsyncStorage.removeItem(STORAGE_KEY);
}

// True after an idle sign-out until the next signed-in session, so the sign-in screen can explain why.
export function wasSignedOutForIdle(): boolean {
  return signedOutForIdle;
}

// Another tab may have seen activity more recently, so check storage before signing out.
async function latestActivity(): Promise<number> {
  const stored = Number(await AsyncStorage.getItem(STORAGE_KEY));
  return Number.isFinite(stored) && stored > lastActivityAt ? stored : lastActivityAt;
}

export function useIdleSignOut(enabled: boolean, signedInAt: string | undefined, onIdle: () => Promise<void>) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let signingOut = false;
    signedOutForIdle = false;

    async function check() {
      if (cancelled || signingOut) {
        return;
      }
      const latest = await latestActivity();
      if (cancelled || Date.now() - latest < IDLE_TIMEOUT_MS) {
        return;
      }
      signingOut = true;
      signedOutForIdle = true;
      await onIdle();
    }

    void (async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (cancelled) {
        return;
      }
      const storedAt = Number(stored) || 0;
      const signInAt = signedInAt ? Date.parse(signedInAt) : 0;
      if (stored == null || storedAt < signInAt) {
        // Fresh sign-in, or activity left over from an earlier session: the idle clock starts now.
        recordActivity(Date.now(), true);
        return;
      }
      lastActivityAt = Math.max(lastActivityAt, storedAt);
      await check();
    })();

    const interval = setInterval(() => void check(), CHECK_INTERVAL_MS);

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void check();
      }
    });

    const onWebActivity = () => recordActivity();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void check();
      }
    };
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      for (const name of WEB_ACTIVITY_EVENTS) {
        document.addEventListener(name, onWebActivity, { passive: true, capture: true });
      }
      document.addEventListener('visibilitychange', onVisibility);
    }

    return () => {
      cancelled = true;
      clearInterval(interval);
      appState.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        for (const name of WEB_ACTIVITY_EVENTS) {
          document.removeEventListener(name, onWebActivity, { capture: true });
        }
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [enabled, signedInAt, onIdle]);
}
