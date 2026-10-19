import { useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme/tokens';

type CodeInputProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  editable?: boolean;
};

export function CodeInput({ value, onChange, error, editable = true }: CodeInputProps) {
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const digits = value.replace(/\D/g, '').slice(0, 6).split('');

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Six-digit sign-in code"
        onPress={() => inputRef.current?.focus()}
        style={styles.row}>
        {Array.from({ length: 6 }, (_, index) => (
          <View
            key={index}
            style={[styles.box, error ? styles.boxError : null, digits[index] ? styles.boxFilled : null]}>
            <Text style={styles.digit}>{digits[index] ?? ''}</Text>
          </View>
        ))}
        <TextInput
          ref={inputRef}
          value={value.replace(/\D/g, '').slice(0, 6)}
          onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          importantForAutofill="yes"
          maxLength={6}
          editable={editable}
          caretHidden
          autoFocus
          style={styles.hiddenInput}
        />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing[8],
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[8],
  },
  box: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  boxFilled: {
    borderColor: colors.accent,
  },
  boxError: {
    borderColor: colors.danger,
  },
  digit: {
    fontFamily: typography.family[700],
    fontSize: typography.size[20],
    color: colors.ink,
  },
  hiddenInput: {
    ...StyleSheet.absoluteFill,
    opacity: 0,
  },
  error: {
    fontFamily: typography.family[400],
    fontSize: typography.size[12],
    color: colors.danger,
  },
});
