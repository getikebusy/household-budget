import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '../theme/tokens';

export function LoadingScreen() {
  return (
    <View style={styles.container} accessibilityLabel="Loading">
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
