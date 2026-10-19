import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useMyPrivate, useUpdateProfile } from '../../data/profile';
import { colors, spacing, typography } from '../../theme/tokens';
import { Avatar } from '../avatar';
import { Chip } from '../chip';
import { MoneyField } from '../money-field';
import { TextField } from '../text-field';
import { errorText, moneyToInput, parseMoney } from './form';
import { SectionFrame } from './section-frame';
import { useServerState } from './use-server-state';

type ProfileSectionProps = {
  displayName: string;
  role: 'primary' | 'partner';
  partnerName: string;
  onSaved: () => void;
};

export function ProfileSection({ displayName, role, partnerName, onSaved }: ProfileSectionProps) {
  const mine = useMyPrivate();
  const update = useUpdateProfile();
  const takeHome = mine.data?.take_home_cad ?? 0;
  const [name, setName] = useServerState(displayName);
  const [pay, setPay] = useServerState(moneyToInput(takeHome));
  const [error, setError] = useState<string | null>(null);
  const nameDirty = name.trim() !== displayName;
  const payAmount = parseMoney(pay);
  const payDirty = payAmount !== Math.round(takeHome * 100) / 100;
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
    setError(null);
    try {
      await update.mutateAsync({ displayName: trimmed, takeHomeCad: payAmount });
      onSaved();
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
      <MoneyField label="Monthly take-home" prefix="$" value={pay} onChangeText={setPay} />
      <Text style={styles.help}>Private to you. {partnerName} only sees it inside Household totals.</Text>
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
  help: {
    fontFamily: typography.family[400],
    fontSize: typography.size[13],
    color: colors.muted,
  },
});
