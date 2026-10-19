import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { QueryClientProvider } from '@tanstack/react-query';
import { Redirect, Stack, usePathname, useSegments, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { LoadingScreen } from '../src/components/loading-screen';
import {
  SessionProvider,
  clearLocalSession,
  isAwaitingLoginCode,
  isRecoveringPassword,
  useMyHousehold,
  useSession,
  useSessionVerified,
} from '../src/data/auth';
import { usePendingInviteToken } from '../src/lib/pending-invite';
import { queryClient } from '../src/lib/query-client';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return <LoadingScreen />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
    </QueryClientProvider>
  );
}

function RootNavigator() {
  const { session, isLoading } = useSession();
  const verifiedQuery = useSessionVerified();
  const householdQuery = useMyHousehold(verifiedQuery.data === true);
  const pathname = usePathname();
  const segments = useSegments();
  const root = String(segments[0] ?? '');
  const isInvite = pathname.startsWith('/invite/');
  const pendingInvite = usePendingInviteToken(`${session?.user.id ?? ''}:${pathname}`);
  const staleUnverified =
    Boolean(session) &&
    !isLoading &&
    !verifiedQuery.isPending &&
    verifiedQuery.data !== true &&
    !isAwaitingLoginCode() &&
    !isRecoveringPassword();

  useEffect(() => {
    if (staleUnverified) {
      void clearLocalSession();
    }
  }, [staleUnverified]);

  if (
    !isRecoveringPassword() &&
    (isLoading ||
      (session && verifiedQuery.isPending) ||
      (session && verifiedQuery.data && householdQuery.isPending) ||
      (session && verifiedQuery.data === true && !householdQuery.data && pendingInvite.isLoading))
  ) {
    return <LoadingScreen />;
  }

  let redirect:
    | '/sign-in'
    | '/verify'
    | '/forgot-password'
    | '/create-household'
    | '/'
    | `/invite/${string}`
    | null = null;

  if (isRecoveringPassword()) {
    if (pathname !== '/forgot-password') {
      redirect = '/forgot-password';
    }
  } else if (!session) {
    const onAuthScreen =
      pathname === '/sign-in' || pathname === '/sign-up' || pathname === '/forgot-password';
    if (!isInvite && !onAuthScreen) {
      redirect = '/sign-in';
    }
  } else if (verifiedQuery.data !== true) {
    if (isAwaitingLoginCode()) {
      if (pathname !== '/verify') {
        redirect = '/verify';
      }
    } else if (pathname !== '/sign-in' && pathname !== '/sign-up' && !isInvite) {
      redirect = '/sign-in';
    }
  } else if (!householdQuery.data) {
    if (pendingInvite.token) {
      const invitePath = `/invite/${pendingInvite.token}` as const;
      if (pathname !== invitePath) {
        redirect = invitePath;
      }
    } else if (!isInvite && root !== '(onboarding)') {
      redirect = '/create-household';
    }
  } else if (householdQuery.data && (root === '(auth)' || root === '(onboarding)' || isInvite)) {
    redirect = '/';
  }

  return (
    <>
      {redirect ? <Redirect href={redirect as Href} /> : null}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="invite/[token]" />
      </Stack>
    </>
  );
}
