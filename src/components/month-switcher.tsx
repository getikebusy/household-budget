import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useMonth, formatMonthTitle } from '../data/month';
import { colors, spacing, typography } from '../theme/tokens';

export function MonthSwitcher() {
  const month = useMonth((state) => state.month);
  const next = useMonth((state) => state.next);
  const previous = useMonth((state) => state.previous);
  const label = formatMonthTitle(month);

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous month"
        onPress={previous}
        style={styles.step}>
        <Text style={styles.chevron}>‹</Text>
      </Pressable>
      <Text accessibilityRole="header" style={styles.label}>
        {label}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={next} style={styles.step}>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  step: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    fontFamily: typography.family[600],
    fontSize: typography.size[26],
    color: colors.ink,
  },
  label: {
    minWidth: 160,
    textAlign: 'center',
    fontFamily: typography.family[700],
    fontSize: typography.size[17],
    color: colors.ink,
  },
});
