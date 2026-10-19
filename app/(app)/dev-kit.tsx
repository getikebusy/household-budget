import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Avatar } from '../../src/components/avatar';
import { Card } from '../../src/components/card';
import { Chip } from '../../src/components/chip';
import { CollapsibleSection } from '../../src/components/collapsible-section';
import { EmptyState } from '../../src/components/empty-state';
import { LockedNotice } from '../../src/components/locked-notice';
import { MoneyField } from '../../src/components/money-field';
import { MoneyText } from '../../src/components/money-text';
import { PrimaryButton } from '../../src/components/primary-button';
import { ProgressBar } from '../../src/components/progress-bar';
import { SecondaryButton } from '../../src/components/secondary-button';
import { SectionTitle } from '../../src/components/section-title';
import { SegmentedControl } from '../../src/components/segmented-control';
import { TextField } from '../../src/components/text-field';
import { colors, spacing, typography } from '../../src/theme/tokens';

const VIEW_OPTIONS = [
  { value: 'me', label: 'Me' },
  { value: 'household', label: 'Household' },
] as const;

export default function DevKitScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [view, setView] = useState<(typeof VIEW_OPTIONS)[number]['value']>('household');
  const [amount, setAmount] = useState('1350');
  const [name, setName] = useState('');

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.scroll, wide ? styles.scrollWide : null]}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>UI kit</Text>

      <SectionTitle>Card</SectionTitle>
      <Card>
        <Text style={styles.body}>Surface, 20px radius, 20px padding.</Text>
      </Card>

      <SectionTitle>Segmented control</SectionTitle>
      <SegmentedControl
        accessibilityLabel="View"
        options={[...VIEW_OPTIONS]}
        value={view}
        onChange={setView}
      />

      <SectionTitle>Chips</SectionTitle>
      <View style={styles.row}>
        <Chip tone="ok" label="On target" />
        <Chip tone="bad" label="Over limit" />
        <Chip tone="warn" label="Due soon" />
        <Chip tone="neutral" label="Unset" />
      </View>

      <SectionTitle>Progress</SectionTitle>
      <Card>
        <ProgressBar value={0.42} color={colors.accent} accessibilityLabel="Needs, 42 percent" />
        <ProgressBar value={1.18} color={colors.accent} accessibilityLabel="Needs, over budget" />
      </Card>

      <SectionTitle>Money</SectionTitle>
      <Card>
        <MoneyText value={1350} size={26} weight={800} />
        <MoneyText value={1350} size={20} weight={700} whole />
        <MoneyText value={-42.5} size={17} weight={600} />
      </Card>

      <SectionTitle>Fields</SectionTitle>
      <TextField label="Display name" value={name} onChangeText={setName} placeholder="Odogwu" />
      <TextField label="Email" value="not-an-email" error="Enter a valid email address" />
      <MoneyField label="Take-home pay" prefix="$" value={amount} onChangeText={setAmount} />
      <MoneyField
        label="Amount in naira"
        prefix="₦"
        value=""
        onChangeText={() => undefined}
        error="Enter an amount"
      />

      <SectionTitle>Buttons</SectionTitle>
      <View style={styles.stack}>
        <PrimaryButton title="Save" onPress={() => undefined} />
        <PrimaryButton title="Saving" loading onPress={() => undefined} />
        <PrimaryButton title="Unavailable" disabled onPress={() => undefined} />
        <SecondaryButton title="Cancel" onPress={() => undefined} />
        <SecondaryButton title="Working" loading onPress={() => undefined} />
        <SecondaryButton title="Unavailable" disabled onPress={() => undefined} />
      </View>

      <SectionTitle>Avatars</SectionTitle>
      <View style={styles.row}>
        <Avatar name="Odogwu" tone="primary" />
        <Avatar name="Wifey" tone="partner" />
        <Avatar name="Joint" tone="joint" />
      </View>

      <SectionTitle>Collapsible</SectionTitle>
      <Card>
        <CollapsibleSection
          title="Needs & Personal"
          defaultOpen
          right={<Chip tone="ok" label="Within limit" />}>
          <Text style={styles.body}>Categories sit here when the section is open.</Text>
        </CollapsibleSection>
        <CollapsibleSection title="Investment" right={<Chip tone="warn" label="Below target" />}>
          <Text style={styles.body}>Closed until the header is pressed.</Text>
        </CollapsibleSection>
      </Card>

      <SectionTitle>Empty and locked</SectionTitle>
      <Card>
        <EmptyState
          title="No transactions yet"
          body="Add the first one and it will show up in this month."
          action={<PrimaryButton title="Add transaction" onPress={() => undefined} />}
        />
        <LockedNotice text="Only the primary account can change this." />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing[20],
    gap: spacing[12],
    backgroundColor: colors.bg,
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
    marginBottom: spacing[8],
  },
  body: {
    fontFamily: typography.family[400],
    fontSize: typography.size[15],
    color: colors.ink,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing[8],
  },
  stack: {
    gap: spacing[8],
  },
});
