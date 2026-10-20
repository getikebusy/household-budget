import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useCreateCreditAccount, useUpdateCreditAccount } from '../data/credit';
import { useToast } from '../data/toast';
import type { Enums, Tables } from '../types/database';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { InfoTip } from './InfoTip';
import { MoneyField } from './money-field';
import { PrimaryButton } from './primary-button';
import { SegmentedControl } from './segmented-control';
import { TextField } from './text-field';

type CreditType = Enums<'credit_type'>;

type CreditAccountSheetProps = {
  account: Tables<'credit_accounts'> | null;
  onClose: () => void;
};

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

function parseDay(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  if (!/^\d+$/.test(trimmed)) {
    return undefined;
  }
  const day = Number(trimmed);
  if (day < 1 || day > 31) {
    return undefined;
  }
  return day;
}

function dayError(text: string) {
  if (!text.trim()) {
    return null;
  }
  return parseDay(text) == null ? 'Enter a day between 1 and 31' : null;
}

function todayIso() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear()}-${month}-${day}`;
}

function openedError(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return 'Use YYYY-MM-DD';
  }
  const [year, month, day] = trimmed.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return 'Use YYYY-MM-DD';
  }
  if (trimmed > todayIso()) {
    return 'Opened on cannot be in the future';
  }
  return null;
}

function digitsOnly(text: string) {
  return text.replace(/\D/g, '').slice(0, 2);
}

const LIMIT_TIP = 'The most you can borrow on this account, as shown in your bank app.';
const BALANCE_TIP = 'What you owe right now. Update it before your statement day to track utilisation.';
const STATEMENT_TIP =
  'The day of the month your billing cycle closes and your statement is issued. The balance on this day is usually what\'s reported to Equifax and TransUnion, so pay it down beforehand to keep utilisation low. Find it on your statement or in your bank app.';
const DUE_TIP =
  'The day of the month your payment is due. Pay at least the minimum by then to avoid fees and a late payment on your credit report; pay the full statement balance to avoid interest. On credit cards, it\'s usually at least 21 days after the statement day.';
const OPENED_TIP =
  'The date the account was opened. Older accounts lengthen your credit history, so think twice before closing your oldest card.';
const AUTOPAY_TIP =
  'Turn on if your bank automatically pays this account each month. Autopay for at least the minimum protects you from missed payments.';
const PAYMENT_DAY_TIP = 'The day of the month your loan payment is taken or due.';

export function CreditAccountSheet({ account, onClose }: CreditAccountSheetProps) {
  const create = useCreateCreditAccount();
  const update = useUpdateCreditAccount();
  const showToast = useToast((state) => state.show);
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<CreditType>(account?.type ?? 'card');
  const [limit, setLimit] = useState(account ? moneyToInput(account.credit_limit) : '');
  const [balance, setBalance] = useState(account ? moneyToInput(account.current_balance) : '');
  const [statementDay, setStatementDay] = useState(account?.statement_day == null ? '' : String(account.statement_day));
  const [dueDay, setDueDay] = useState(account?.due_day == null ? '' : String(account.due_day));
  const [openedOn, setOpenedOn] = useState(account?.opened_on ?? '');
  const [autopay, setAutopay] = useState(account?.autopay ?? false);
  const [openedTouched, setOpenedTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;
  const isLoan = type === 'loan';
  const statementProblem = isLoan ? null : dayError(statementDay);
  const dueProblem = dayError(dueDay);
  const openedProblem = openedTouched || openedOn.trim().length >= 10 ? openedError(openedOn) : null;

  async function save() {
    const trimmed = name.trim();
    const creditLimit = parseMoney(limit);
    const currentBalance = parseMoney(balance);
    const statement = isLoan ? null : parseDay(statementDay);
    const due = parseDay(dueDay);
    const openedProblemNow = openedError(openedOn);
    setOpenedTouched(true);
    if (!trimmed) {
      setError('Enter a name');
      return;
    }
    if (creditLimit == null || currentBalance == null) {
      setError('Enter a limit and a balance');
      return;
    }
    if ((!isLoan && statement === undefined) || due === undefined || openedProblemNow) {
      setError(null);
      return;
    }
    setError(null);
    const input = {
      name: trimmed,
      type,
      credit_limit: creditLimit,
      current_balance: currentBalance,
      statement_day: statement,
      due_day: due,
      opened_on: openedOn.trim() ? openedOn.trim() : null,
      autopay,
    };
    if (account) {
      await update.mutateAsync({ id: account.id, ...input });
    } else {
      await create.mutateAsync(input);
    }
    showToast(account ? 'Card updated' : 'Card added');
    onClose();
  }

  return (
    <View style={styles.overlay}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.backdrop} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{account ? account.name : 'Add a card'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
            <Text style={styles.closeLabel}>Close</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <TextField label="Name" value={name} onChangeText={setName} />
          <SegmentedControl
            accessibilityLabel="Account type"
            options={[
              { value: 'card', label: 'Card' },
              { value: 'line', label: 'Line' },
              { value: 'loan', label: 'Loan' },
            ]}
            value={type}
            onChange={setType}
          />
          <MoneyField label="Limit" prefix="$" value={limit} onChangeText={setLimit} info={LIMIT_TIP} />
          <MoneyField label="Balance" prefix="$" value={balance} onChangeText={setBalance} info={BALANCE_TIP} />
          {isLoan ? null : (
            <TextField
              label="Statement day"
              value={statementDay}
              onChangeText={(value) => setStatementDay(digitsOnly(value))}
              keyboardType="number-pad"
              inputMode="numeric"
              placeholder="e.g. 15"
              maxLength={2}
              info={STATEMENT_TIP}
              error={statementProblem ?? undefined}
            />
          )}
          <TextField
            label={isLoan ? 'Payment day' : 'Due day'}
            value={dueDay}
            onChangeText={(value) => setDueDay(digitsOnly(value))}
            keyboardType="number-pad"
            inputMode="numeric"
            placeholder="e.g. 15"
            maxLength={2}
            info={isLoan ? PAYMENT_DAY_TIP : DUE_TIP}
            error={dueProblem ?? undefined}
          />
          <TextField
            label="Opened on"
            value={openedOn}
            onChangeText={setOpenedOn}
            onBlur={() => setOpenedTouched(true)}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            info={OPENED_TIP}
            error={openedProblem ?? undefined}
          />
          <View style={styles.autopayRow}>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="Autopay"
              accessibilityState={{ checked: autopay }}
              onPress={() => setAutopay((current) => !current)}
              style={styles.toggle}>
              <Text style={styles.toggleLabel}>{autopay ? 'Autopay on' : 'Autopay off'}</Text>
            </Pressable>
            <InfoTip field="Autopay" text={AUTOPAY_TIP} />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton
            title={account ? 'Save card' : 'Add a card'}
            loading={pending}
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
  autopayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  toggle: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    justifyContent: 'center',
    paddingHorizontal: spacing[12],
  },
  toggleLabel: {
    fontFamily: typography.family[600],
    fontSize: typography.size[15],
    color: colors.ink,
  },
  error: {
    fontFamily: typography.family[400],
    fontSize: typography.size[12],
    color: colors.danger,
  },
});
