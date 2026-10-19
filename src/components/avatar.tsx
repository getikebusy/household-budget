import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '../theme/tokens';

type AvatarTone = 'primary' | 'partner' | 'joint';

type AvatarProps = {
  name: string;
  tone: AvatarTone;
};

const tones: Record<AvatarTone, { backgroundColor: string; color: string }> = {
  primary: { backgroundColor: colors.accent, color: colors.surface },
  partner: { backgroundColor: colors.investment, color: colors.surface },
  joint: { backgroundColor: colors.emergency, color: colors.surface },
};

export function Avatar({ name, tone }: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const palette = tones[tone];

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name}
      style={[styles.circle, { backgroundColor: palette.backgroundColor }]}>
      <Text style={[styles.letter, { color: palette.color }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontFamily: typography.family[700],
    fontSize: typography.size[17],
  },
});
