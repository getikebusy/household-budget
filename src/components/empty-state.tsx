import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../theme/tokens';

type EmptyStateProps = {
  title: string;
  body: string;
  action?: ReactNode;
};

export function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing[24],
    paddingHorizontal: spacing[16],
    gap: spacing[8],
  },
  title: {
    fontFamily: typography.family[700],
    fontSize: typography.size[17],
    color: colors.ink,
    textAlign: 'center',
  },
  body: {
    fontFamily: typography.family[400],
    fontSize: typography.size[14],
    color: colors.muted,
    textAlign: 'center',
  },
  action: {
    marginTop: spacing[8],
    alignSelf: 'stretch',
  },
});
