import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/tokens';

type TransactionComposerProps = {
  children: ReactNode;
};

export function TransactionComposer({ children }: TransactionComposerProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= 900;

  if (wide) {
    return (
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => router.back()}
          style={styles.backdrop}
        />
        <View style={[styles.panel, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.modal, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.ink,
    opacity: 0.4,
  },
  panel: {
    width: 440,
    maxWidth: '100%',
    height: '100%',
    backgroundColor: colors.surface,
  },
  modal: {
    flex: 1,
    backgroundColor: colors.surface,
  },
});
