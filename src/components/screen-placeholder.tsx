import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../theme/tokens';

type ScreenPlaceholderProps = {
  title: string;
  padded?: boolean;
};

export function ScreenPlaceholder({ title, padded = false }: ScreenPlaceholderProps) {
  const body = (
    <View style={[styles.body, padded ? styles.padded : null]}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );

  if (!padded) {
    return body;
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 1160,
    alignSelf: 'center',
  },
  body: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[24],
  },
  padded: {
    paddingVertical: spacing[28],
    paddingHorizontal: spacing[32],
  },
  title: {
    fontFamily: typography.family[800],
    fontSize: typography.size[26],
    color: colors.ink,
  },
});
