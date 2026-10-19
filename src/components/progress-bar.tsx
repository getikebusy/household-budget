import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '../theme/tokens';

type ProgressBarProps = {
  value: number;
  color: string;
  height?: number;
  accessibilityLabel?: string;
};

export function ProgressBar({
  value,
  color,
  height = 6,
  accessibilityLabel = 'Progress',
}: ProgressBarProps) {
  const over = value > 1;
  const fill = Math.min(Math.max(value, 0), 1);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={[styles.track, { height, borderRadius: height }]}>
      <View
        style={{
          width: `${fill * 100}%`,
          height,
          borderRadius: height,
          backgroundColor: over ? colors.danger : color,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: colors.divider,
    overflow: 'hidden',
    marginVertical: spacing[4],
  },
});
