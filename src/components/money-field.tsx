import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radius, spacing, typography } from '../theme/tokens';

type MoneyPrefix = '$' | '₦';

type MoneyFieldProps = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  prefix: MoneyPrefix;
  error?: string;
};

export function MoneyField({
  label,
  value,
  onChangeText,
  prefix,
  error,
  style,
  accessibilityLabel,
  editable = true,
  ...rest
}: MoneyFieldProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, editable === false ? styles.fieldLocked : null, error ? styles.fieldError : null]}>
        <Text style={styles.prefix} accessibilityElementsHidden importantForAccessibility="no">
          {prefix}
        </Text>
        <TextInput
          {...rest}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholderTextColor={colors.muted}
          editable={editable}
          accessibilityLabel={accessibilityLabel ?? `${label}, ${prefix}`}
          accessibilityState={{ disabled: editable === false }}
          style={[styles.input, editable === false ? styles.inputLocked : null, style]}
        />
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing[8],
  },
  label: {
    fontFamily: typography.family[600],
    fontSize: typography.size[13],
    color: colors.ink,
  },
  field: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing[12],
    gap: spacing[8],
  },
  fieldError: {
    borderColor: colors.danger,
  },
  fieldLocked: {
    backgroundColor: colors.bg,
  },
  inputLocked: {
    color: colors.muted,
  },
  prefix: {
    fontFamily: typography.family[600],
    fontSize: typography.size[15],
    color: colors.muted,
  },
  input: {
    flex: 1,
    minHeight: 44,
    fontFamily: typography.family[400],
    fontSize: typography.size[15],
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  error: {
    fontFamily: typography.family[400],
    fontSize: typography.size[12],
    color: colors.danger,
  },
});
