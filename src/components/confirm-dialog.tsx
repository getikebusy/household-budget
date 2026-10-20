import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme/tokens';
import { SecondaryButton } from './secondary-button';

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          disabled={loading}
          onPress={onCancel}
          style={styles.dismiss}
        />
        <View accessibilityLabel={title} style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <SecondaryButton title={cancelLabel} disabled={loading} onPress={onCancel} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              disabled={loading}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.dangerButton,
                pressed && !loading ? styles.dangerPressed : null,
                loading ? styles.disabled : null,
              ]}>
              <Text style={styles.dangerLabel}>{loading ? 'Please wait…' : confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[20],
  },
  dismiss: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.ink,
    opacity: 0.45,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing[20],
    gap: spacing[12],
    zIndex: 1,
  },
  title: {
    fontFamily: typography.family[800],
    fontSize: typography.size[20],
    color: colors.ink,
  },
  message: {
    fontFamily: typography.family[400],
    fontSize: typography.size[15],
    color: colors.muted,
  },
  actions: {
    gap: spacing[8],
  },
  dangerButton: {
    minHeight: 44,
    backgroundColor: colors.danger,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[16],
  },
  dangerPressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  dangerLabel: {
    fontFamily: typography.family[700],
    fontSize: typography.size[15],
    color: colors.surface,
  },
});
