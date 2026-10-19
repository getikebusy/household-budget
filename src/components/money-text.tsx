import { StyleSheet, Text } from 'react-native';

import { formatCAD, formatCADWhole } from '../lib/money';
import { colors, typography } from '../theme/tokens';

type MoneyTextProps = {
  value: number;
  size: keyof typeof typography.size;
  weight: keyof typeof typography.family;
  whole?: boolean;
};

export function MoneyText({ value, size, weight, whole = false }: MoneyTextProps) {
  const text = whole ? formatCADWhole(value) : formatCAD(value);

  return (
    <Text
      accessibilityLabel={text}
      style={[
        styles.amount,
        {
          fontSize: typography.size[size],
          fontFamily: typography.family[weight],
          color: value < 0 ? colors.danger : colors.ink,
        },
      ]}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  amount: {
    fontVariant: ['tabular-nums'],
  },
});
