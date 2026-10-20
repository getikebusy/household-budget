import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useDisplayCurrency, useSetDisplayCurrency } from '../../data/display-currency';
import { useMyPrivate, useUpdateProfile } from '../../data/profile';
import type { CurrencyCode } from '../../lib/money';
import { colors, spacing, typography } from '../../theme/tokens';
import { Avatar } from '../avatar';
import { Chip } from '../chip';
import { MoneyField } from '../money-field';
import { SegmentedControl } from '../segmented-control';
import { TextField } from '../text-field';
import { errorText, moneyToInput, parseMoney } from './form';
import { SectionFrame } from './section-frame';
import { useServerState } from './use-server-state';

type ProfileSectionProps = {
  displayName: string;
  role: 'primary' | 'partner';
  partnerName: string;
  onSaved: (message?: string) => void;
};

export function ProfileSection({ displayName, role, partnerName, onSaved }: ProfileSectionProps) {
  const mine = useMyPrivate();
  const update = useUpdateProfile();
  const display = useDisplayCurrency();
  const setDisplayCurrency = useSetDisplayCurrency();
  const takeHome = mine.data?.take_home_cad ?? 0;
  const [name, setName] = useServerState(displayName);
  const [entryCurrency, setEntryCurrency] = useState<CurrencyCode | null>(null);
  const payCurrency = entryCurrency != null && display.available.includes(entryCurrency) ? entryCurrency : display.currency;
  // Stored in CAD; shown converted into whichever currency the field is set to.
  const serverPay = moneyToInput(Math.round(takeHome * (display.rateFor(payCurrency) ?? 1) * 100) / 100);
  // Null until the user types, so a currency switch re-converts the saved amount instead of a draft.
  const [payDraft, setPayDraft] = useState<string | null>(null);
  const pay = payDraft ?? serverPay;
  const [error, setError] = useState<string | null>(null);
  const nameDirty = name.trim() !== displayName;
  const payAmount = parseMoney(pay);
  const payDirty = payDraft != null && payAmount !== parseMoney(serverPay);
  const dirty = nameDirty || payDirty;

  async function save() {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 30) {
      setError('Enter a display name of 30 characters or fewer');
      return;
    }
    if (payAmount == null) {
      setError('Enter a take-home amount');
      return;
    }
    // Locked at entry: convert once at today's rate. An untouched amount keeps its exact CAD value.
    const takeHomeCad = payDirty ? display.toCad(payAmount, payCurrency) : takeHome;
    if (takeHomeCad == null) {
      setError(`No ${payCurrency} rate yet. Choose another currency.`);
      return;
    }
    setError(null);
    try {
      await update.mutateAsync({ displayName: trimmed, takeHomeCad });
      setPayDraft(null);
      onSaved();
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  async function changeDisplayCurrency(currency: CurrencyCode) {
    setError(null);
    try {
      await setDisplayCurrency.mutateAsync(currency);
      onSaved(`Showing amounts in ${currency}`);
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <SectionFrame title="Your profile" dirty={dirty} saving={update.isPending} onSave={() => void save()} error={error}>
      <View style={styles.identity}>
        <Avatar name={displayName} tone={role === 'primary' ? 'primary' : 'partner'} />
        <View style={styles.identityText}>
          <Text style={styles.name}>{displayName}</Text>
          <Chip tone={role === 'primary' ? 'ok' : 'neutral'} label={role === 'primary' ? 'Primary' : 'Partner'} />
        </View>
      </View>
      <TextField label="Display name" value={name} onChangeText={setName} maxLength={30} />
      <MoneyField
        label="Monthly take-home"
        prefix="$"
        value={pay}
        onChangeText={setPayDraft}
        currency={{ value: payCurrency, options: display.available, onChange: setEntryCurrency }}
      />
      <Text style={styles.help}>
        Private to you. {partnerName} only sees it inside Household totals.
        {payCurrency === 'CAD' ? '' : ' Saved in CAD at today\'s rate.'}
      </Text>
      <View style={styles.displayCurrency}>
        <Text style={styles.label}>Show amounts in</Text>
        <SegmentedControl
          accessibilityLabel="Display currency"
          options={display.available.map((code) => ({ value: code, label: code }))}
          value={display.currency}
          onChange={(code) => void changeDisplayCurrency(code)}
        />
        <Text style={styles.help}>Only changes what you see. Household records stay in CAD.</Text>
      </View>
    </SectionFrame>
  );
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
  },
  identityText: {
    flex: 1,
    gap: spacing[4],
  },
  name: {
    fontFamily: typography.family[700],
    fontSize: typography.size[17],
    color: colors.ink,
  },
  displayCurrency: {
    gap: spacing[8],
  },
  label: {
    fontFamily: typography.family[600],
    fontSize: typography.size[13],
    color: colors.ink,
  },
  help: {
    fontFamily: typography.family[400],
    fontSize: typography.size[13],
    color: colors.muted,
  },
});
