import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { InfoTip } from './InfoTip';
import { colors, radius, spacing, typography } from '../theme/tokens';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  info?: string;
};

export function TextField({ label, error, info, style, accessibilityLabel, editable = true, ...rest }: TextFieldProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {info ? <InfoTip field={label} text={info} /> : null}
      </View>
      <TextInput
        {...rest}
        editable={editable}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: editable === false }}
        placeholderTextColor={colors.muted}
        style={[styles.input, editable === false ? styles.locked : null, error ? styles.inputError : null, style]}
      />
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
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  label: {
    flexShrink: 1,
    fontFamily: typography.family[600],
    fontSize: typography.size[13],
    color: colors.ink,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: spacing[12],
    fontFamily: typography.family[400],
    fontSize: typography.size[15],
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  inputError: {
    borderColor: colors.danger,
  },
  locked: {
    backgroundColor: colors.bg,
    color: colors.muted,
  },
  error: {
    fontFamily: typography.family[400],
    fontSize: typography.size[12],
    color: colors.danger,
  },
});
