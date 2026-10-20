import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { InfoTip } from './InfoTip';
import { CURRENCY_SYMBOL, type CurrencyCode } from '../lib/money';
import { colors, radius, spacing, typography } from '../theme/tokens';

type MoneyPrefix = string;

type CurrencyPicker = {
  value: CurrencyCode;
  options: CurrencyCode[];
  onChange: (currency: CurrencyCode) => void;
};

type MoneyFieldProps = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  prefix: MoneyPrefix;
  error?: string;
  info?: string;
  // Turns the prefix into a currency switcher.
  currency?: CurrencyPicker;
};

export function MoneyField({
  label,
  value,
  onChangeText,
  prefix,
  error,
  info,
  style,
  accessibilityLabel,
  editable = true,
  currency,
  ...rest
}: MoneyFieldProps) {
  const [picking, setPicking] = useState(false);
  const canPick = Boolean(currency) && editable !== false && (currency?.options.length ?? 0) > 1;
  const shownPrefix = currency ? CURRENCY_SYMBOL[currency.value] : prefix;

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {info ? <InfoTip field={label} text={info} /> : null}
      </View>
      <View style={[styles.field, editable === false ? styles.fieldLocked : null, error ? styles.fieldError : null]}>
        {canPick && currency ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Currency ${currency.value}. Change currency`}
            accessibilityState={{ expanded: picking }}
            onPress={() => setPicking((open) => !open)}
            style={styles.currencyButton}>
            <Text style={styles.prefix}>{shownPrefix}</Text>
            <Text style={styles.currencyCode}>{currency.value} ▾</Text>
          </Pressable>
        ) : (
          <Text style={styles.prefix} aria-hidden>
            {shownPrefix}
          </Text>
        )}
        <TextInput
          {...rest}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholderTextColor={colors.muted}
          editable={editable}
          accessibilityLabel={accessibilityLabel ?? `${label}, ${currency?.value ?? shownPrefix}`}
          accessibilityState={{ disabled: editable === false }}
          style={[styles.input, editable === false ? styles.inputLocked : null, style]}
        />
      </View>
      {canPick && currency && picking ? (
        <View accessibilityRole="radiogroup" style={styles.options}>
          {currency.options.map((code) => {
            const selected = code === currency.value;
            return (
              <Pressable
                key={code}
                accessibilityRole="radio"
                accessibilityLabel={code}
                accessibilityState={{ selected }}
                onPress={() => {
                  currency.onChange(code);
                  setPicking(false);
                }}
                style={[styles.option, selected ? styles.optionSelected : null]}>
                <Text style={[styles.optionLabel, selected ? styles.optionLabelSelected : null]}>
                  {CURRENCY_SYMBOL[code]} {code}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
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
  currencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    minHeight: 44,
    paddingRight: spacing[8],
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  currencyCode: {
    fontFamily: typography.family[600],
    fontSize: typography.size[13],
    color: colors.ink,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[8],
  },
  option: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing[12],
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  optionLabel: {
    fontFamily: typography.family[600],
    fontSize: typography.size[13],
    color: colors.ink,
  },
  optionLabelSelected: {
    color: colors.surface,
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
