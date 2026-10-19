import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useUpsertCreditLog } from '../data/credit';
import { formatMonthTitle } from '../data/month';
import { useToast } from '../data/toast';
import type { Tables } from '../types/database';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { PrimaryButton } from './primary-button';
import { TextField } from './text-field';

type CreditScoreSheetProps = {
  month: string;
  existing: Tables<'credit_score_logs'> | null;
  utilisation: number | null;
  onClose: () => void;
};

function scoreInput(value: number | null | undefined) {
  return value == null ? '' : String(value);
}

function parseScore(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  if (!/^\d+$/.test(trimmed)) {
    return undefined;
  }
  const value = Number(trimmed);
  if (value < 300 || value > 900) {
    return undefined;
  }
  return value;
}

function parseCount(text: string) {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  return Number(trimmed);
}

export function CreditScoreSheet({ month, existing, utilisation, onClose }: CreditScoreSheetProps) {
  const saveLog = useUpsertCreditLog();
  const showToast = useToast((state) => state.show);
  const [equifax, setEquifax] = useState(scoreInput(existing?.equifax));
  const [transunion, setTransunion] = useState(scoreInput(existing?.transunion));
  const [paymentsDue, setPaymentsDue] = useState(String(existing?.payments_due ?? 0));
  const [paidOnTime, setPaidOnTime] = useState(String(existing?.paid_on_time ?? 0));
  const [inquiries, setInquiries] = useState(String(existing?.hard_inquiries ?? 0));
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const equifaxScore = parseScore(equifax);
    const transunionScore = parseScore(transunion);
    const due = parseCount(paymentsDue);
    const paid = parseCount(paidOnTime);
    const hard = parseCount(inquiries);
    if (equifaxScore === undefined || transunionScore === undefined) {
      setError('Scores are whole numbers from 300 to 900, or left blank');
      return;
    }
    if (due == null || paid == null || hard == null) {
      setError('Payments and inquiries are whole numbers');
      return;
    }
    if (paid > due) {
      setError('Paid on time cannot be more than payments due');
      return;
    }
    setError(null);
    await saveLog.mutateAsync({
      month,
      equifax: equifaxScore,
      transunion: transunionScore,
      payments_due: due,
      paid_on_time: paid,
      hard_inquiries: hard,
      notes: notes.trim() || null,
      utilisation_at_statement: utilisation,
    });
    showToast('Scores saved');
    onClose();
  }

  return (
    <View style={styles.overlay}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.backdrop} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{formatMonthTitle(month)} scores</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
            <Text style={styles.closeLabel}>Close</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <TextField label="Equifax" value={equifax} onChangeText={setEquifax} keyboardType="number-pad" />
          <TextField label="TransUnion" value={transunion} onChangeText={setTransunion} keyboardType="number-pad" />
          <TextField label="Payments due" value={paymentsDue} onChangeText={setPaymentsDue} keyboardType="number-pad" />
          <TextField label="Paid on time" value={paidOnTime} onChangeText={setPaidOnTime} keyboardType="number-pad" />
          <TextField label="Hard inquiries" value={inquiries} onChangeText={setInquiries} keyboardType="number-pad" />
          <TextField label="Notes" value={notes} onChangeText={setNotes} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton
            title="Save scores"
            loading={saveLog.isPending}
            onPress={() => {
              void save().catch((caught: unknown) => {
                setError(caught instanceof Error ? caught.message : 'Something went wrong');
              });
            }}
          />
        </ScrollView>
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
    gap: spacing[12],
    maxHeight: '88%',
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
  form: {
    gap: spacing[12],
    paddingBottom: spacing[12],
  },
  error: {
    fontFamily: typography.family[400],
    fontSize: typography.size[12],
    color: colors.danger,
  },
});
