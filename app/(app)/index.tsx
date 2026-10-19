import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '../../src/components/primary-button';
import { signOut } from '../../src/data/auth';
import { colors, spacing, typography } from '../../src/theme/tokens';

export default function AppHomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Household Budget</Text>
      <Text style={styles.subtitle}>You are signed in.</Text>
      <PrimaryButton title="Sign out" onPress={() => void signOut()} />
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
});
