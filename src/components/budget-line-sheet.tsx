import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useUpdateBudgetLine, type BudgetLineWithCategory } from '../data/budget-lines';
import { useToast } from '../data/toast';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { MoneyField } from './money-field';
import { PrimaryButton } from './primary-button';
import { SegmentedControl } from './segmented-control';
import { TextField } from './text-field';

type BudgetLineSheetProps = {
  categoryName: string;
  rent: boolean;
  line: BudgetLineWithCategory | null;
  onClose: () => void;
};

type Mode = 'percent' | 'fixed';

function moneyToInput(amount: number) {
  return amount.toFixed(2).replace(/\.00$/, '');
}

function parseMoney(text: string) {
  const value = Number(text.replace(/,/g, '').trim());
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.round(value * 100) / 100;
}

export function BudgetLineSheet({ categoryName, rent, line, onClose }: BudgetLineSheetProps) {
  const update = useUpdateBudgetLine();
  const showToast = useToast((state) => state.show);
  const initialMode: Mode = line?.fixed_amount_cad != null ? 'fixed' : 'percent';
  const [mode, setMode] = useState<Mode>(initialMode);
  const [percent, setPercent] = useState(
    line?.split_pct == null ? '' : String(Math.round(line.split_pct * 100)),
  );
  const [fixed, setFixed] = useState(line?.fixed_amount_cad == null ? '' : moneyToInput(line.fixed_amount_cad));
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!line) {
      return;
    }
    if (mode === 'percent') {
      if (!/^\d+$/.test(percent.trim()) || Number(percent) > 100) {
        setError('Enter a whole percentage from 0 to 100');
        return;
      }
      setError(null);
      await update.mutateAsync({
        id: line.id,
        split_pct: Number(percent) / 100,
        fixed_amount_cad: null,
      });
    } else {
      const amount = parseMoney(fixed);
      if (amount == null) {
        setError('Enter a fixed amount');
        return;
      }
      setError(null);
      await update.mutateAsync({
        id: line.id,
        split_pct: null,
        fixed_amount_cad: amount,
      });
    }
    showToast('Budget line saved');
    onClose();
  }

  return (
    <View style={styles.overlay}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.backdrop} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{categoryName}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
            <Text style={styles.closeLabel}>Close</Text>
          </Pressable>
        </View>
        {rent ? <Text style={styles.note}>Set by household rent</Text> : null}
        {!rent && !line ? <Text style={styles.note}>This category has no budget line yet.</Text> : null}
        {!rent && line ? (
          <View style={styles.form}>
            <SegmentedControl
              accessibilityLabel="How this category is budgeted"
              options={[
                { value: 'percent', label: '% of my take-home' },
                { value: 'fixed', label: 'Fixed amount' },
              ]}
              value={mode}
              onChange={setMode}
            />
            {mode === 'percent' ? (
              <TextField label="% of my take-home" value={percent} onChangeText={setPercent} keyboardType="number-pad" />
            ) : (
              <MoneyField label="Fixed amount" prefix="$" value={fixed} onChangeText={setFixed} />
            )}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <PrimaryButton
              title="Save"
              loading={update.isPending}
              onPress={() => {
                void save().catch((caught: unknown) => {
                  setError(caught instanceof Error ? caught.message : 'Something went wrong');
                });
              }}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.ink,
    opacity: 0.4,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: spacing[20],
    gap: spacing[16],
    maxHeight: '80%',
  },
  header: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[12],
  },
  title: {
    flex: 1,
    fontFamily: typography.family[800],
    fontSize: typography.size[20],
    color: colors.ink,
  },
  close: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing[8],
  },
  closeLabel: {
    fontFamily: typography.family[600],
    fontSize: typography.size[14],
    color: colors.accent,
  },
  note: {
    fontFamily: typography.family[500],
    fontSize: typography.size[15],
    color: colors.ink,
  },
  form: {
    gap: spacing[12],
  },
  error: {
    fontFamily: typography.family[400],
    fontSize: typography.size[12],
    color: colors.danger,
  },
});
