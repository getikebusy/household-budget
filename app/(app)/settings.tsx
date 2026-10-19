import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { AccountsSection } from '../../src/components/settings/accounts-section';
import { BudgetRuleSection } from '../../src/components/settings/budget-rule-section';
import { CategoriesSection } from '../../src/components/settings/categories-section';
import { CreditTargetsSection } from '../../src/components/settings/credit-targets-section';
import { ExchangeSection } from '../../src/components/settings/exchange-section';
import { JointSection } from '../../src/components/settings/joint-section';
import { MembersSection } from '../../src/components/settings/members-section';
import { ProfileSection } from '../../src/components/settings/profile-section';
import { LoadingScreen } from '../../src/components/loading-screen';
import { LockedNotice } from '../../src/components/locked-notice';
import { SecondaryButton } from '../../src/components/secondary-button';
import { ToastBanner } from '../../src/components/toast-banner';
import { signOut } from '../../src/data/auth';
import { useMembers, useMyMembership } from '../../src/data/household';
import { useMyPrivate } from '../../src/data/profile';
import { useSettings } from '../../src/data/settings';
import { colors, spacing, typography } from '../../src/theme/tokens';

const WIDE = 900;

export default function SettingsScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const membership = useMyMembership();
  const members = useMembers();
  const settings = useSettings();
  const mine = useMyPrivate();
  const [toast, setToast] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showSaved(message = 'Saved') {
    setToast(message);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => setToast(null), 2500);
  }

  if (membership.isPending || members.isPending || settings.isPending || mine.isPending) {
    return <LoadingScreen />;
  }

  if (!membership.data || !settings.data) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>Household settings are not available yet.</Text>
      </View>
    );
  }

  const isPrimary = membership.data.role === 'primary';
  const partnerName =
    members.data?.find((member) => member.role === 'partner')?.display_name ?? 'your partner';
  const primaryName =
    members.data?.find((member) => member.role === 'primary')?.display_name ?? 'the primary account';

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.scroll, wide ? styles.scrollWide : null]}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Settings</Text>
        {isPrimary ? null : (
          <LockedNotice text={`Household settings are managed by ${primaryName}.`} />
        )}
        <View style={wide ? styles.grid : styles.stack}>
          <View style={wide ? styles.cell : styles.stackItem}>
            <ProfileSection
              displayName={membership.data.display_name}
              role={membership.data.role}
              partnerName={partnerName}
              onSaved={showSaved}
            />
          </View>
          <View style={wide ? styles.cell : styles.stackItem}>
            <MembersSection members={members.data ?? []} isPrimary={isPrimary} onSaved={showSaved} />
          </View>
          <View style={wide ? styles.cell : styles.stackItem}>
            <JointSection
              settings={settings.data}
              members={members.data ?? []}
              locked={!isPrimary}
              onSaved={showSaved}
            />
          </View>
          <View style={wide ? styles.cell : styles.stackItem}>
            <BudgetRuleSection settings={settings.data} locked={!isPrimary} onSaved={showSaved} />
          </View>
          <View style={wide ? styles.cell : styles.stackItem}>
            <ExchangeSection settings={settings.data} locked={!isPrimary} onSaved={showSaved} />
          </View>
          <View style={wide ? styles.cell : styles.stackItem}>
            <CreditTargetsSection settings={settings.data} locked={!isPrimary} onSaved={showSaved} />
          </View>
          <View style={wide ? styles.span : styles.stackItem}>
            <CategoriesSection locked={!isPrimary} onSaved={showSaved} />
          </View>
          <View style={wide ? styles.cell : styles.stackItem}>
            <AccountsSection locked={!isPrimary} onSaved={() => showSaved('Account added')} />
          </View>
        </View>
        <View style={styles.signOut}>
          <SecondaryButton
            title="Sign out"
            loading={signingOut}
            onPress={() => {
              setSigningOut(true);
              void signOut().finally(() => setSigningOut(false));
            }}
          />
        </View>
      </ScrollView>
      <ToastBanner message={toast} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    padding: spacing[20],
    gap: spacing[16],
  },
  scrollWide: {
    width: '100%',
    maxWidth: 1160,
    alignSelf: 'center',
    paddingVertical: spacing[28],
    paddingHorizontal: spacing[32],
  },
  heading: {
    fontFamily: typography.family[800],
    fontSize: typography.size[26],
    color: colors.ink,
  },
  stack: {
    gap: spacing[16],
  },
  stackItem: {
    width: '100%',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[16],
    alignItems: 'stretch',
  },
  cell: {
    flexGrow: 1,
    flexBasis: 340,
    minWidth: 340,
  },
  span: {
    flexGrow: 1,
    flexBasis: '100%',
    minWidth: '100%',
  },
  signOut: {
    maxWidth: 340,
    alignSelf: 'flex-start',
    width: '100%',
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[24],
    backgroundColor: colors.bg,
  },
  missingText: {
    fontFamily: typography.family[500],
    fontSize: typography.size[15],
    color: colors.muted,
    textAlign: 'center',
  },
});
