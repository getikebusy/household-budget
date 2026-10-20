import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAccounts, useCategories } from '../data/budget-lines';
import { useMembers, useMyMembership } from '../data/household';
import { rateForCurrency, useFxQuotes, useSettings } from '../data/settings';
import type { TransactionInput } from '../data/transactions';
import { toCad } from '../lib/budget';
import { formatCAD } from '../lib/money';
import { colors, radius, spacing, typography } from '../theme/tokens';
import type { Enums, Tables } from '../types/database';
import { PrimaryButton } from './primary-button';
import { SegmentedControl } from './segmented-control';
import { TextField } from './text-field';

type EntryType = 'expense' | 'income';
type Currency = Enums<'currency_code'>;
type Scope = Enums<'txn_scope'>;

type TransactionFormProps = {
  title: string;
  initial?: Tables<'transactions'> | null;
  submitting?: boolean;
  onSubmit: (input: TransactionInput) => Promise<void>;
  onDelete?: () => void;
  deleting?: boolean;
};

function todayISO(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function errorText(error: unknown) {
  return error instanceof Error && error.message ? error.message : 'Something went wrong';
}

export function TransactionForm({
  title,
  initial,
  submitting = false,
  onSubmit,
  onDelete,
  deleting = false,
}: TransactionFormProps) {
  const membership = useMyMembership();
  const members = useMembers();
  const categories = useCategories();
  const accounts = useAccounts();
  const settings = useSettings();
  const quotes = useFxQuotes();
  const myName = membership.data?.display_name ?? 'Me';
  const primary = members.data?.find((member) => member.role === 'primary');
  const partner = members.data?.find((member) => member.role === 'partner');
  const partnerName = partner?.display_name ?? 'your partner';

  const [type, setType] = useState<EntryType>(initial?.type === 'income' ? 'income' : 'expense');
  const [amountText, setAmountText] = useState(initial ? String(initial.amount) : '');
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? 'CAD');
  const rate = rateForCurrency(currency, quotes.data, settings.data?.fx_override_ngn_per_cad);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [scope, setScope] = useState<Scope>(initial?.scope ?? 'personal');
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? '');
  const [accountId, setAccountId] = useState(initial?.account_id ?? '');
  const [occurredOn, setOccurredOn] = useState(initial?.occurred_on ?? todayISO());
  const [error, setError] = useState<string | null>(null);

  const amount = Number(amountText);
  const amountOk = Number.isFinite(amount) && amount > 0;
  const cadAmount =
    currency === 'CAD'
      ? amountOk
        ? toCad(amount, 'CAD', 1)
        : 0
      : rate && amountOk
        ? toCad(amount, currency, rate)
        : 0;
  const ownerLabel = scope === 'joint' ? 'Joint' : myName;
  const visibleCategories = (categories.data ?? []).filter((category) => {
    if (category.archived) {
      return false;
    }
    return type === 'income' ? category.kind === 'income' : category.kind !== 'income';
  });
  const visibleAccounts = (accounts.data ?? []).filter((account) => !account.archived);
  const primaryShare = primary?.joint_share ?? 0.5;
  const partnerShare = partner?.joint_share ?? 1 - primaryShare;
  const primaryPercent = Math.round(primaryShare * 100);
  const partnerPercent = Math.round(partnerShare * 100);

  function chooseType(next: EntryType) {
    setType(next);
    setCategoryId('');
  }

  async function save() {
    if (!amountOk) {
      setError('Enter an amount greater than zero');
      return;
    }
    if (!categoryId) {
      setError('Choose a category');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) {
      setError('Enter the date as YYYY-MM-DD');
      return;
    }
    if (currency !== 'CAD' && !(rate && rate > 0)) {
      setError(`No ${currency} exchange rate yet. Wait for the daily rate, or set a naira override in Settings.`);
      return;
    }
    setError(null);
    try {
      await onSubmit({
        amount,
        currency,
        category_id: categoryId,
        description: description.trim(),
        scope,
        type,
        occurred_on: occurredOn,
        account_id: accountId || null,
        fx_ngn_per_cad: currency === 'CAD' ? null : rate,
      });
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={styles.close}>
          <Text style={styles.closeLabel}>Close</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.typeRow}>
          <View style={styles.typeControl}>
            <SegmentedControl
              accessibilityLabel="Transaction type"
              options={[
                { value: 'expense', label: 'Expense' },
                { value: 'income', label: 'Income' },
              ]}
              value={type}
              onChange={chooseType}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More transaction types, coming later"
            accessibilityState={{ disabled: true }}
            disabled
            style={styles.more}>
            <Text style={styles.moreLabel}>More</Text>
          </Pressable>
        </View>

        <View style={styles.amountRow}>
          <TextInput
            accessibilityLabel="Amount"
            value={amountText}
            onChangeText={(value) => setAmountText(value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
            inputMode="decimal"
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.muted}
            style={styles.amount}
          />
          <View style={styles.currencies}>
            {(['CAD', 'NGN', 'USD', 'GBP'] as const).map((option) => {
              const selected = currency === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityLabel={option}
                  accessibilityState={{ selected }}
                  onPress={() => setCurrency(option)}
                  style={[styles.currency, selected ? styles.currencySelected : null]}>
                  <Text style={[styles.currencyLabel, selected ? styles.currencyLabelSelected : null]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        {currency === 'CAD' ? null : (
          <Text style={styles.hint}>
            {rate
              ? `≈ ${formatCAD(amountOk ? cadAmount : 0)} at ${rate.toLocaleString('en-CA', { maximumFractionDigits: 4 })} ${currency} per CAD`
              : `No live ${currency} rate yet. Canadian dollars are the base currency.`}
          </Text>
        )}

        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          maxLength={80}
          placeholder="Optional"
        />

        <Text style={styles.question}>Whose is it?</Text>
        <View style={styles.scopeRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={myName}
            accessibilityState={{ selected: scope === 'personal' }}
            onPress={() => setScope('personal')}
            style={[styles.scope, scope === 'personal' ? styles.scopeSelected : null]}>
            <Text style={styles.scopeLabel}>{myName}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Joint"
            accessibilityState={{ selected: scope === 'joint' }}
            onPress={() => setScope('joint')}
            style={[styles.scope, scope === 'joint' ? styles.scopeSelected : null]}>
            <Text style={styles.scopeLabel}>Joint</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>
          {scope === 'joint'
            ? `Split ${primaryPercent}/${partnerPercent}: ${primary?.display_name ?? 'Primary'} ${formatCAD(cadAmount * primaryShare)}, ${partner?.display_name ?? 'Partner'} ${formatCAD(cadAmount * partnerShare)}`
            : `Counts only toward your budget. ${partnerName} sees the amount and category, not the description.`}
        </Text>

        <Text style={styles.question}>Category</Text>
        <View style={styles.chips}>
          {visibleCategories.map((category) => {
            const selected = category.id === categoryId;
            return (
              <Pressable
                key={category.id}
                accessibilityRole="button"
                accessibilityLabel={category.name}
                accessibilityState={{ selected }}
                onPress={() => setCategoryId(category.id)}
                style={[styles.chip, selected ? styles.chipSelected : null]}>
                <Text style={[styles.chipLabel, selected ? styles.chipLabelSelected : null]}>{category.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.question}>Account</Text>
        <View style={styles.chips}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="No account"
            accessibilityState={{ selected: accountId === '' }}
            onPress={() => setAccountId('')}
            style={[styles.chip, accountId === '' ? styles.chipSelected : null]}>
            <Text style={[styles.chipLabel, accountId === '' ? styles.chipLabelSelected : null]}>None</Text>
          </Pressable>
          {visibleAccounts.map((account) => {
            const selected = account.id === accountId;
            return (
              <Pressable
                key={account.id}
                accessibilityRole="button"
                accessibilityLabel={account.name}
                accessibilityState={{ selected }}
                onPress={() => setAccountId(account.id)}
                style={[styles.chip, selected ? styles.chipSelected : null]}>
                <Text style={[styles.chipLabel, selected ? styles.chipLabelSelected : null]}>{account.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <TextField label="Date" value={occurredOn} onChangeText={setOccurredOn} placeholder="YYYY-MM-DD" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton
          title={`Save ${formatCAD(cadAmount)} · ${ownerLabel}`}
          loading={submitting}
          disabled={!amountOk}
          onPress={() => void save()}
        />
        {onDelete ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete transaction"
            disabled={deleting}
            onPress={onDelete}
            style={styles.delete}>
            <Text style={styles.deleteLabel}>{deleting ? 'Deleting…' : 'Delete'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
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
  body: {
    padding: spacing[20],
    gap: spacing[12],
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  typeControl: {
    flex: 1,
  },
  more: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing[8],
    opacity: 0.5,
  },
  moreLabel: {
    fontFamily: typography.family[600],
    fontSize: typography.size[14],
    color: colors.muted,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  amount: {
    flex: 1,
    minHeight: 56,
    fontFamily: typography.family[800],
    fontSize: typography.size[34],
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  currencies: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[8],
  },
  currency: {
    minWidth: 52,
    minHeight: 44,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[8],
  },
  currencySelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  currencyLabel: {
    fontFamily: typography.family[700],
    fontSize: typography.size[13],
    color: colors.ink,
  },
  currencyLabelSelected: {
    color: colors.surface,
  },
  question: {
    fontFamily: typography.family[700],
    fontSize: typography.size[15],
    color: colors.ink,
  },
  hint: {
    fontFamily: typography.family[400],
    fontSize: typography.size[13],
    color: colors.muted,
  },
  scopeRow: {
    flexDirection: 'row',
    gap: spacing[8],
  },
  scope: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[12],
    backgroundColor: colors.surface,
  },
  scopeSelected: {
    backgroundColor: colors.okBg,
    borderColor: colors.accent,
  },
  scopeLabel: {
    fontFamily: typography.family[700],
    fontSize: typography.size[15],
    color: colors.ink,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[8],
  },
  chip: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[12],
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipLabel: {
    fontFamily: typography.family[600],
    fontSize: typography.size[14],
    color: colors.ink,
  },
  chipLabelSelected: {
    color: colors.surface,
  },
  error: {
    fontFamily: typography.family[400],
    fontSize: typography.size[12],
    color: colors.danger,
  },
  footer: {
    padding: spacing[20],
    gap: spacing[8],
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  delete: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteLabel: {
    fontFamily: typography.family[700],
    fontSize: typography.size[15],
    color: colors.danger,
  },
});
