import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { QueryClientProvider } from '@tanstack/react-query';
import { Redirect, Stack, useGlobalSearchParams, usePathname, useSegments, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LoadingScreen } from '../src/components/loading-screen';
import { PrimaryButton } from '../src/components/primary-button';
import {
  SessionProvider,
  clearLocalSession,
  isAwaitingLoginCode,
  isRecoveringPassword,
  useMyHousehold,
  useSession,
  useSessionVerified,
} from '../src/data/auth';
import { usePendingInviteToken, savePendingInviteToken } from '../src/lib/pending-invite';
import { queryClient } from '../src/lib/query-client';
import { colors, spacing, typography } from '../src/theme/tokens';

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
  const search = useGlobalSearchParams<{ invite?: string | string[] }>();
  const inviteFromQuery = Array.isArray(search.invite) ? search.invite[0] : search.invite;
  const root = String(segments[0] ?? '');
  const isInvite = pathname.startsWith('/invite/');
  const pendingInvite = usePendingInviteToken(`${session?.user.id ?? ''}:${pathname}:${inviteFromQuery ?? ''}`);
  const inviteToken = inviteFromQuery || pendingInvite.token;

  useEffect(() => {
    if (inviteFromQuery) {
      void savePendingInviteToken(inviteFromQuery);
    }
  }, [inviteFromQuery]);
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
      (session && verifiedQuery.data && (householdQuery.isPending || (householdQuery.isFetching && !householdQuery.data))) ||
      (session && verifiedQuery.data === true && !householdQuery.data && pendingInvite.isLoading))
  ) {
    return <LoadingScreen />;
  }

  if (session && verifiedQuery.data === true && householdQuery.isError) {
    return (
      <View style={styles.blocked}>
        <Text style={styles.blockedTitle}>Could not load your household.</Text>
        <PrimaryButton title="Try again" onPress={() => void householdQuery.refetch()} />
      </View>
    );
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
    if (inviteToken) {
      const invitePath = `/invite/${inviteToken}` as const;
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

const styles = StyleSheet.create({
  blocked: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[16],
    padding: spacing[24],
  },
  blockedTitle: {
    fontFamily: typography.family[600],
    fontSize: typography.size[15],
    color: colors.ink,
    textAlign: 'center',
  },
});
