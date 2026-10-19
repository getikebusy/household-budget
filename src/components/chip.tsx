import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../theme/tokens';

type ChipTone = 'ok' | 'bad' | 'warn' | 'neutral';

type ChipProps = {
  tone: ChipTone;
  label: string;
};

const tones: Record<ChipTone, { backgroundColor: string; color: string }> = {
  ok: { backgroundColor: colors.okBg, color: colors.okText },
  bad: { backgroundColor: colors.badBg, color: colors.badText },
  warn: { backgroundColor: colors.warnBg, color: colors.warnText },
  neutral: { backgroundColor: colors.bg, color: colors.muted },
};

export function Chip({ tone, label }: ChipProps) {
  const palette = tones[tone];

  return (
    <View accessibilityRole="text" accessibilityLabel={label} style={[styles.chip, { backgroundColor: palette.backgroundColor }]}>
      <Text style={[styles.label, { color: palette.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[4],
    minHeight: 28,
    justifyContent: 'center',
  },
  label: {
    fontFamily: typography.family[700],
    fontSize: typography.size[12],
  },
});
