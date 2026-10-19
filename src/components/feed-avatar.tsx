import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '../theme/tokens';
import { Avatar } from './avatar';

type FeedAvatarProps = {
  scope: 'personal' | 'joint';
  name: string;
  mine: boolean;
};

export function FeedAvatar({ scope, name, mine }: FeedAvatarProps) {
  if (scope === 'joint') {
    return (
      <View accessibilityRole="image" accessibilityLabel="Joint" style={styles.joint}>
        <Text style={styles.letter}>J</Text>
      </View>
    );
  }

  return <Avatar name={name} tone={mine ? 'primary' : 'partner'} />;
}

const styles = StyleSheet.create({
  joint: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
  },
  letter: {
    fontFamily: typography.family[700],
    fontSize: typography.size[17],
    color: colors.surface,
  },
});
