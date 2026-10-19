import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, spacing, typography } from '../theme/tokens';

type CollapsibleSectionProps = {
  title: ReactNode;
  accessibilityLabel?: string;
  right?: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
};

export function CollapsibleSection({
  title,
  accessibilityLabel,
  right,
  defaultOpen = false,
  open,
  onOpenChange,
  children,
}: CollapsibleSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = open ?? internalOpen;
  const label = accessibilityLabel ?? (typeof title === 'string' ? title : 'Section');

  function toggle() {
    const next = !isOpen;
    setInternalOpen(next);
    onOpenChange?.(next);
  }

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: isOpen }}
        onPress={toggle}
        style={styles.header}>
        {typeof title === 'string' ? <Text style={styles.title}>{title}</Text> : <View style={styles.titleSlot}>{title}</View>}
        <View style={styles.right}>
          {right}
          <View style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
              <Path
                d="M6 9l6 6 6-6"
                stroke={colors.muted}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </View>
      </Pressable>
      {isOpen ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[12],
  },
  title: {
    flex: 1,
    fontFamily: typography.family[700],
    fontSize: typography.size[15],
    color: colors.ink,
  },
  titleSlot: {
    flex: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  body: {
    paddingBottom: spacing[8],
    gap: spacing[8],
  },
});
