import { Stack, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { AppSidebar } from '../../src/components/app-sidebar';
import { BottomTabBar } from '../../src/components/bottom-tab-bar';
import { ToastBanner } from '../../src/components/toast-banner';
import { useToast } from '../../src/data/toast';
import { colors } from '../../src/theme/tokens';

export const unstable_settings = {
  anchor: 'index',
};

const WIDE_BREAKPOINT = 900;

export default function AppGroupLayout() {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const isWide = width >= WIDE_BREAKPOINT;
  const isComposer = pathname.startsWith('/transactions/') && pathname !== '/transactions';
  const toast = useToast((state) => state.message);
  const clearToast = useToast((state) => state.clear);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = setTimeout(clearToast, 2500);
    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  return (
    <View style={[styles.shell, isWide ? styles.shellWide : null]}>
      {isWide ? <AppSidebar /> : null}
      <View style={styles.main}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="budget" />
          <Stack.Screen name="credit" />
          <Stack.Screen name="settings" />
          <Stack.Screen
            name="transactions/new"
            options={{
              presentation: 'transparentModal',
              animation: isWide ? 'slide_from_right' : 'slide_from_bottom',
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
          <Stack.Screen
            name="transactions/[id]"
            options={{
              presentation: 'transparentModal',
              animation: isWide ? 'slide_from_right' : 'slide_from_bottom',
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
        </Stack>
        <ToastBanner message={toast} />
      </View>
      {!isWide && !isComposer ? <BottomTabBar /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  shellWide: {
    flexDirection: 'row',
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
});
