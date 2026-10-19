import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme/tokens';

type ToastBannerProps = {
  message: string | null;
};

export function ToastBanner({ message }: ToastBannerProps) {
  if (!message) {
    return null;
  }

  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.toast}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing[20],
    right: spacing[20],
    bottom: spacing[16],
    minHeight: 44,
    borderRadius: radius.input,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[16],
  },
  text: {
    fontFamily: typography.family[600],
    fontSize: typography.size[14],
    color: colors.surface,
  },
});
