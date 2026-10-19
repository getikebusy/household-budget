import { StyleSheet, Text, View } from 'react-native';

import '../src/lib/supabase';

export default function Index() {
  return (
    <View style={styles.container}>
      <Text>Household Budget</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
