import { StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native';

import { colors, radius } from '../theme/tokens';

type SkeletonProps = {
  height: number;
  width?: DimensionValue;
  style?: ViewStyle;
};

export function Skeleton({ height, width = '100%', style }: SkeletonProps) {
  return <View accessibilityLabel="Loading" style={[styles.block, { height, width }, style]} />;
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.divider,
    borderRadius: radius.input,
  },
});
