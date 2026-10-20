import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { colors, radius, spacing, typography } from '../theme/tokens';

type LockedNoticeProps = {
  text: string;
};

export function LockedNotice({ text }: LockedNoticeProps) {
  return (
    <View accessibilityRole="text" accessibilityLabel={text} style={styles.band}>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
        <Rect
          x={5}
          y={11}
          width={14}
          height={9}
          rx={2}
          stroke={colors.muted}
          strokeWidth={1.8}
        />
        <Path
          d="M8 11V8a4 4 0 0 1 8 0v3"
          stroke={colors.muted}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </Svg>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    backgroundColor: colors.bg,
    borderRadius: radius.input,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
  },
  text: {
    flex: 1,
    fontFamily: typography.family[500],
    fontSize: typography.size[14],
    color: colors.muted,
  },
});
