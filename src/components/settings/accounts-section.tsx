import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAccounts, useCreateAccount } from '../../data/budget-lines';
import { colors, spacing, typography } from '../../theme/tokens';
import type { Enums } from '../../types/database';
import { SecondaryButton } from '../secondary-button';
import { SegmentedControl } from '../segmented-control';
import { TextField } from '../text-field';
import { errorText } from './form';
import { SectionFrame } from './section-frame';

type AccountType = Enums<'account_type'>;
type Currency = Enums<'currency_code'>;

const TYPE_LABEL: Record<AccountType, string> = {
  bank: 'Bank',
  credit: 'Credit',
  cash: 'Cash',
};

type AccountsSectionProps = {
  locked: boolean;
  onSaved: () => void;
};

export function AccountsSection({ locked, onSaved }: AccountsSectionProps) {
  const accounts = useAccounts();
  const create = useCreateAccount();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [currency, setCurrency] = useState<Currency>('CAD');
  const [error, setError] = useState<string | null>(null);
  const visible = (accounts.data ?? []).filter((account) => !account.archived);

  async function add() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter an account name');
      return;
    }
    setError(null);
    try {
      await create.mutateAsync({ name: trimmed, type, currency });
      setName('');
      setAdding(false);
      onSaved();
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <SectionFrame title="Accounts" error={error}>
      {visible.map((account) => (
        <View key={account.id} style={styles.row}>
          <Text style={styles.name}>{account.name}</Text>
          <Text style={styles.meta}>
            {TYPE_LABEL[account.type]} · {account.currency}
          </Text>
        </View>
      ))}
      {locked ? null : adding ? (
        <View style={styles.form}>
          <TextField label="Name" value={name} onChangeText={setName} />
          <SegmentedControl
            accessibilityLabel="Account type"
            options={[
              { value: 'bank', label: 'Bank' },
              { value: 'credit', label: 'Credit' },
              { value: 'cash', label: 'Cash' },
            ]}
            value={type}
            onChange={setType}
          />
          <SegmentedControl
            accessibilityLabel="Currency"
            options={[
              { value: 'CAD', label: 'CAD' },
              { value: 'NGN', label: 'NGN' },
              { value: 'USD', label: 'USD' },
              { value: 'GBP', label: 'GBP' },
            ]}
            value={currency}
            onChange={setCurrency}
          />
          <SecondaryButton title="Add account" loading={create.isPending} onPress={() => void add()} />
        </View>
      ) : (
        <SecondaryButton title="Add account" onPress={() => setAdding(true)} />
      )}
    </SectionFrame>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 44,
    justifyContent: 'center',
    gap: spacing[4],
  },
  name: {
    fontFamily: typography.family[600],
    fontSize: typography.size[15],
    color: colors.ink,
  },
  meta: {
    fontFamily: typography.family[400],
    fontSize: typography.size[13],
    color: colors.muted,
  },
  form: {
    gap: spacing[12],
  },
});
