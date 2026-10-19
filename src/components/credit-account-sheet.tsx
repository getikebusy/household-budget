import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useCreateCreditAccount, useUpdateCreditAccount } from '../data/credit';
import { useToast } from '../data/toast';
import type { Enums, Tables } from '../types/database';
import { colors, radius, spacing, typography } from '../theme/tokens';
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

function parseDate(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

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
  const [error, setError] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;

  async function save() {
    const trimmed = name.trim();
    const creditLimit = parseMoney(limit);
    const currentBalance = parseMoney(balance);
    const statement = parseDay(statementDay);
    const due = parseDay(dueDay);
    const opened = parseDate(openedOn);
    if (!trimmed) {
      setError('Enter a name');
      return;
    }
    if (creditLimit == null || currentBalance == null) {
      setError('Enter a limit and a balance');
      return;
    }
    if (statement === undefined || due === undefined) {
      setError('Statement and due days are from 1 to 31, or left blank');
      return;
    }
    if (opened === undefined) {
      setError('Opened on uses YYYY-MM-DD');
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
      opened_on: opened,
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
          <MoneyField label="Limit" prefix="$" value={limit} onChangeText={setLimit} />
          <MoneyField label="Balance" prefix="$" value={balance} onChangeText={setBalance} />
          <TextField
            label="Statement day"
            value={statementDay}
            onChangeText={setStatementDay}
            keyboardType="number-pad"
          />
          <TextField label="Due day" value={dueDay} onChangeText={setDueDay} keyboardType="number-pad" />
          <TextField
            label="Opened on"
            value={openedOn}
            onChangeText={setOpenedOn}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Autopay"
            accessibilityState={{ checked: autopay }}
            onPress={() => setAutopay((current) => !current)}
            style={styles.toggle}>
            <Text style={styles.toggleLabel}>{autopay ? 'Autopay on' : 'Autopay off'}</Text>
          </Pressable>
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
  toggle: {
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
