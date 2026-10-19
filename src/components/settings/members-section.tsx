import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { sendInvite, usePendingInvite, type HouseholdMember } from '../../data/household';
import { useSetPartnerName } from '../../data/settings';
import { colors, spacing, typography } from '../../theme/tokens';
import { Avatar } from '../avatar';
import { Chip } from '../chip';
import { PrimaryButton } from '../primary-button';
import { TextField } from '../text-field';
import { errorText } from './form';
import { SectionFrame } from './section-frame';
import { useServerState } from './use-server-state';

type MembersSectionProps = {
  members: HouseholdMember[];
  isPrimary: boolean;
  onSaved: (message?: string) => void;
};

export function MembersSection({ members, isPrimary, onSaved }: MembersSectionProps) {
  const partner = members.find((member) => member.role === 'partner');
  const rename = useSetPartnerName();
  const pending = usePendingInvite(isPrimary && !partner);
  const queryClient = useQueryClient();
  const [partnerName, setPartnerName] = useServerState(partner?.display_name ?? '');
  const pendingEmail = pending.data?.email ?? '';
  const [email, setEmail] = useServerState(pendingEmail);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const nameDirty = Boolean(partner) && partnerName.trim() !== partner?.display_name;
  const inviteTitle =
    pendingEmail && email.trim().toLowerCase() === pendingEmail ? 'Resend invite' : 'Invite partner';

  async function saveName() {
    const trimmed = partnerName.trim();
    if (!trimmed || trimmed.length > 30) {
      setError('Enter a name of 30 characters or fewer');
      return;
    }
    setError(null);
    try {
      await rename.mutateAsync(trimmed);
      onSaved();
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  async function invite() {
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError('Enter a valid email address');
      return;
    }
    setError(null);
    setSending(true);
    try {
      await sendInvite(address);
      await queryClient.invalidateQueries({ queryKey: ['invites'] });
      onSaved(inviteTitle === 'Resend invite' ? 'Invite resent' : 'Invite sent');
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setSending(false);
    }
  }

  return (
    <SectionFrame
      title="Household members"
      dirty={nameDirty}
      saving={rename.isPending}
      onSave={() => void saveName()}
      error={error}>
      {[...members].sort((a, b) => (a.role === b.role ? 0 : a.role === 'primary' ? -1 : 1)).map((member) => (
        <View key={member.role} style={styles.row}>
          <Avatar name={member.display_name} tone={member.role === 'primary' ? 'primary' : 'partner'} />
          <View style={styles.text}>
            <Text style={styles.name}>{member.display_name}</Text>
            <Chip tone={member.role === 'primary' ? 'ok' : 'neutral'} label={member.role === 'primary' ? 'Primary' : 'Partner'} />
            {member.role === 'partner' ? <Text style={styles.meta}>Joined by invite</Text> : null}
          </View>
        </View>
      ))}
      {isPrimary && partner ? (
        <TextField label="Partner display name" value={partnerName} onChangeText={setPartnerName} maxLength={30} />
      ) : null}
      {isPrimary && !partner ? (
        <View style={styles.invite}>
          <TextField
            label="Partner email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          {pendingEmail ? <Text style={styles.meta}>An invite is waiting for {pendingEmail}.</Text> : null}
          <PrimaryButton title={inviteTitle} loading={sending} disabled={!email.trim()} onPress={() => void invite()} />
        </View>
      ) : null}
    </SectionFrame>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    minHeight: 44,
  },
  text: {
    flex: 1,
    gap: spacing[4],
  },
  name: {
    fontFamily: typography.family[700],
    fontSize: typography.size[15],
    color: colors.ink,
  },
  meta: {
    fontFamily: typography.family[400],
    fontSize: typography.size[13],
    color: colors.muted,
  },
  invite: {
    gap: spacing[12],
  },
});
