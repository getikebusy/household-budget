import { StyleSheet, Text } from 'react-native';

import { colors, spacing, typography } from '../theme/tokens';

type SectionTitleProps = {
  children: string;
};

export function SectionTitle({ children }: SectionTitleProps) {
  return (
    <Text accessibilityRole="header" style={styles.title}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: typography.family[800],
    fontSize: typography.size[13],
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing[8],
  },
});
