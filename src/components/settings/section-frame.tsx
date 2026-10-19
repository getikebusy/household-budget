import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme/tokens';
import { Card } from '../card';
import { PrimaryButton } from '../primary-button';
import { SectionTitle } from '../section-title';

type SectionFrameProps = {
  title: string;
  children: ReactNode;
  dirty?: boolean;
  saving?: boolean;
  saveDisabled?: boolean;
  onSave?: () => void;
  error?: string | null;
};

export function SectionFrame({
  title,
  children,
  dirty = false,
  saving = false,
  saveDisabled = false,
  onSave,
  error,
}: SectionFrameProps) {
  return (
    <Card style={styles.card}>
      <SectionTitle>{title}</SectionTitle>
      <View style={styles.body}>{children}</View>
      {dirty && onSave ? (
        <PrimaryButton title="Save" loading={saving} disabled={saveDisabled} onPress={onSave} />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    gap: spacing[12],
  },
  body: {
    gap: spacing[12],
  },
  error: {
    fontFamily: typography.family[400],
    fontSize: typography.size[12],
    color: colors.danger,
  },
});
