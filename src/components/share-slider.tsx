import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

import { colors, radius, spacing, typography } from '../theme/tokens';

type ShareSliderProps = {
  value: number;
  onChange: (value: number) => void;
  primaryName: string;
  partnerName: string;
  disabled?: boolean;
};

function stepValue(ratio: number) {
  const percent = Math.min(1, Math.max(0, ratio)) * 100;
  return Math.min(100, Math.max(0, Math.round(percent / 5) * 5));
}

export function ShareSlider({
  value,
  onChange,
  primaryName,
  partnerName,
  disabled = false,
}: ShareSliderProps) {
  const width = useRef(1);

  function setFromEvent(event: GestureResponderEvent) {
    if (disabled) {
      return;
    }
    onChange(stepValue(event.nativeEvent.locationX / width.current));
  }

  function nudge(delta: number) {
    if (disabled) {
      return;
    }
    onChange(Math.min(100, Math.max(0, value + delta)));
  }

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel="Primary share of joint costs"
      accessibilityValue={{ min: 0, max: 100, now: value, text: `${primaryName} ${value}%` }}
      accessibilityState={{ disabled }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment') {
          nudge(5);
        }
        if (event.nativeEvent.actionName === 'decrement') {
          nudge(-5);
        }
      }}>
      <View style={styles.labels}>
        <Text style={styles.label}>
          {primaryName} {value}%
        </Text>
        <Text style={[styles.label, styles.labelEnd]}>
          {partnerName} {100 - value}%
        </Text>
      </View>
      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Decrease primary share"
          disabled={disabled || value === 0}
          onPress={() => nudge(-5)}
          style={[styles.step, disabled || value === 0 ? styles.stepDisabled : null]}>
          <Text style={styles.stepLabel}>−</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={`${primaryName} ${value} percent`}
          disabled={disabled}
          onLayout={(event) => {
            width.current = event.nativeEvent.layout.width || 1;
          }}
          onPress={setFromEvent}
          style={styles.track}>
          <View style={[styles.fill, { width: `${value}%` }]} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Increase primary share"
          disabled={disabled || value === 100}
          onPress={() => nudge(5)}
          style={[styles.step, disabled || value === 100 ? styles.stepDisabled : null]}>
          <Text style={styles.stepLabel}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[8],
  },
  label: {
    flex: 1,
    fontFamily: typography.family[600],
    fontSize: typography.size[13],
    color: colors.ink,
  },
  labelEnd: {
    textAlign: 'right',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  step: {
    width: 44,
    height: 44,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  stepLabel: {
    fontFamily: typography.family[700],
    fontSize: typography.size[20],
    color: colors.ink,
  },
  stepDisabled: {
    opacity: 0.4,
  },
  track: {
    flex: 1,
    height: 44,
    borderRadius: radius.input,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
});
