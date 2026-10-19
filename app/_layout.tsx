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
import { useMyHousehold, useSession, useSessionVerified } from '../src/data/auth';
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
      <RootNavigator />
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

  if (isLoading || (session && verifiedQuery.isPending) || (session && verifiedQuery.data && householdQuery.isPending)) {
    return <LoadingScreen />;
  }

  let redirect: '/sign-in' | '/verify' | '/create-household' | '/' | null = null;

  if (!session) {
    const onAuthScreen =
      pathname === '/sign-in' || pathname === '/sign-up' || pathname === '/forgot-password';
    if (!onAuthScreen) {
      redirect = '/sign-in';
    }
  } else if (!verifiedQuery.data) {
    if (pathname !== '/verify') {
      redirect = '/verify';
    }
  } else if (!householdQuery.data && !isInvite) {
    if (root !== '(onboarding)') {
      redirect = '/create-household';
    }
  } else if (householdQuery.data && (root === '(auth)' || root === '(onboarding)')) {
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
