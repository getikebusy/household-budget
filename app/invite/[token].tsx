import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../src/theme/tokens';

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Household invite</Text>
      <Text style={styles.subtitle}>Invite acceptance comes next.</Text>
      {token ? <Text style={styles.token}>{token}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[24],
    gap: spacing[16],
  },
  title: {
    fontFamily: typography.family[800],
    fontSize: typography.size[26],
    color: colors.ink,
  },
  subtitle: {
    fontFamily: typography.family[400],
    fontSize: typography.size[15],
    color: colors.muted,
  },
  token: {
    fontFamily: typography.family[400],
    fontSize: typography.size[12],
    color: colors.muted,
  },
});
