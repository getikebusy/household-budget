import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Card } from '../../src/components/card';
import { Chip } from '../../src/components/chip';
import { CreditAccountSheet } from '../../src/components/credit-account-sheet';
import { CreditScoreSheet } from '../../src/components/credit-score-sheet';
import { EmptyState } from '../../src/components/empty-state';
import { LockedNotice } from '../../src/components/locked-notice';
import { PrimaryButton } from '../../src/components/primary-button';
import { SecondaryButton } from '../../src/components/secondary-button';
import { useDisplayCurrency } from '../../src/data/display-currency';
import { useCreditAccounts, useCreditLogs } from '../../src/data/credit';
import { useMyMembership } from '../../src/data/household';
import { currentMonth } from '../../src/data/month';
import { useSettings } from '../../src/data/settings';
import {
  accountsNeedingAttention,
  barShare,
  creditUtilisation,
  hardInquiriesLast12Months,
  inquiryHealth,
  oldestOpenAccountMonths,
  onTimePaymentRate,
  paymentHealth,
  soonestStatement,
  utilisationBand,
  type AttentionReason,
  type UtilisationBand,
} from '../../src/lib/credit';
import { formatPercent } from '../../src/lib/money';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';
import type { Tables } from '../../src/types/database';

const TYPE_LABEL = { card: 'Card', line: 'Line', loan: 'Loan' } as const;

function bandTone(band: UtilisationBand): 'ok' | 'warn' | 'bad' {
  if (band === 'Ideal') {
    return 'ok';
  }
  if (band === 'Within ceiling') {
    return 'warn';
  }
  return 'bad';
}

function openedLabel(openedOn: string | null) {
  if (!openedOn) {
    return 'Opened date not set';
  }
  const [year, month, day] = openedOn.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function statementCopy(days: number, date: Date) {
  const when = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const wait = days === 1 ? 'in 1 day' : `in ${days} days`;
  return `Statement closes ${when}, ${wait}`;
}

function reasonLabel(reason: AttentionReason) {
  return reason === 'utilisation' ? 'above ceiling' : 'statement soon';
}

export default function CreditScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const membership = useMyMembership();
  const settings = useSettings();
  const accounts = useCreditAccounts();
  const logs = useCreditLogs();
  const [scoreOpen, setScoreOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);

  const month = currentMonth();
  const name = membership.data?.display_name ?? 'You';
  const ideal = settings.data?.util_ideal ?? 0.1;
  const ceiling = settings.data?.util_ceiling ?? 0.3;
  const alertDays = settings.data?.statement_alert_days ?? 3;
  const maxInquiries = settings.data?.max_hard_inquiries ?? 2;
  const rows = accounts.data ?? [];
  const scoreLogs = logs.data ?? [];
  const latest = scoreLogs[0];
  const thisMonth = scoreLogs.find((log) => log.month === month) ?? null;
  const utilisation = creditUtilisation(rows);
  const band = utilisation == null ? null : utilisationBand(utilisation, ideal, ceiling);
  const next = soonestStatement(rows);
  const attention = accountsNeedingAttention(rows, ceiling, alertDays);
  const rate = onTimePaymentRate(scoreLogs);
  const payments = paymentHealth(rate);
  const inquiries = hardInquiriesLast12Months(scoreLogs);
  const inquiriesStatus = inquiryHealth(inquiries, maxInquiries);
  const oldest = oldestOpenAccountMonths(rows);
  const editing = editingId && editingId !== 'new' ? (rows.find((row) => row.id === editingId) ?? null) : null;
  const loading = (accounts.isLoading && !accounts.data) || (logs.isLoading && !logs.data);
  const failed = accounts.isError || logs.isError;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.page, wide ? styles.pageWide : null]}>
        <Text accessibilityRole="header" style={styles.title}>
          Credit
        </Text>
        <LockedNotice text={`${name}, this is private to you. Credit files are individual in Canada.`} />

        {loading ? <ActivityIndicator color={colors.accent} style={styles.loading} /> : null}
        {failed ? (
          <Card>
            <Text style={styles.message}>Credit could not be loaded.</Text>
            <PrimaryButton
              title="Retry"
              onPress={() => {
                void accounts.refetch();
                void logs.refetch();
              }}
            />
          </Card>
        ) : null}

        {!loading && !failed ? (
          <View style={wide ? styles.columns : styles.stack}>
            <View style={[styles.column, wide ? styles.columnWide : styles.columnPhone]}>
              <ScoresCard latest={latest} onLog={() => setScoreOpen(true)} />
              <UtilisationCard utilisation={utilisation} band={band} ideal={ideal} ceiling={ceiling} next={next} />
            </View>
            <View style={[styles.column, wide ? styles.columnWide : styles.columnPhone]}>
              {rows.length === 0 ? (
                <Card>
                  <EmptyState
                    title="No cards yet"
                    body="A secured card or a newcomer card is a common first account in Canada. Add it here to watch utilisation and statement dates."
                    action={<PrimaryButton title="Add a card" onPress={() => setEditingId('new')} />}
                  />
                </Card>
              ) : (
                <AccountsCard accounts={rows} onEdit={setEditingId} onAdd={() => setEditingId('new')} />
              )}
              <HealthCard
                rate={rate}
                payments={payments}
                inquiries={inquiries}
                maxInquiries={maxInquiries}
                inquiriesStatus={inquiriesStatus}
                oldest={oldest}
                attention={attention}
              />
            </View>
          </View>
        ) : null}
      </ScrollView>

      {scoreOpen ? (
        <CreditScoreSheet
          month={month}
          existing={thisMonth}
          utilisation={utilisation}
          onClose={() => setScoreOpen(false)}
        />
      ) : null}
      {editingId ? (
        <CreditAccountSheet
          key={editingId}
          account={editingId === 'new' ? null : editing}
          onClose={() => setEditingId(null)}
        />
      ) : null}
    </View>
  );
}

function ScoresCard({
  latest,
  onLog,
}: {
  latest: Tables<'credit_score_logs'> | undefined;
  onLog: () => void;
}) {
  const hasScore = latest?.equifax != null || latest?.transunion != null;
  return (
    <View style={styles.inkCard}>
      <Text style={styles.inkLabel}>Scores</Text>
      <Text style={styles.scoreLine}>
        {hasScore
          ? [
              latest?.equifax != null ? `Equifax ${latest.equifax}` : null,
              latest?.transunion != null ? `TransUnion ${latest.transunion}` : null,
            ]
              .filter(Boolean)
              .join(' · ')
          : 'No score yet'}
      </Text>
      <Text style={styles.inkBody}>
        Scores range from 300 to 900. Check Borrowell (Equifax) and Credit Karma (TransUnion) once a month.
      </Text>
      <SecondaryButton title="Log this month's scores" onPress={onLog} />
    </View>
  );
}

function UtilisationCard({
  utilisation,
  band,
  ideal,
  ceiling,
  next,
}: {
  utilisation: number | null;
  band: UtilisationBand | null;
  ideal: number;
  ceiling: number;
  next: { name: string; date: Date; days: number } | null;
}) {
  return (
    <Card style={styles.cardBody}>
      <View style={styles.row}>
        <Text style={styles.cardTitle}>Utilisation</Text>
        {band ? <Chip tone={bandTone(band)} label={band} /> : null}
      </View>
      <Text style={styles.big}>{utilisation == null ? '—' : formatPercent(utilisation, 0)}</Text>
      <UtilisationScale value={utilisation ?? 0} ideal={ideal} ceiling={ceiling} />
      <Text style={styles.meta}>
        Ideal {formatPercent(ideal, 0)} · ceiling {formatPercent(ceiling, 0)}
      </Text>
      {next ? <Text style={styles.alert}>{statementCopy(next.days, next.date)}</Text> : null}
    </Card>
  );
}

function UtilisationScale({ value, ideal, ceiling }: { value: number; ideal: number; ceiling: number }) {
  return (
    <View>
      <View style={styles.scale}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${barShare(value) * 100}%` }]} />
        </View>
        <View style={[styles.marker, { left: `${barShare(ideal) * 100}%` }]} />
        <View style={[styles.marker, styles.ceilingMarker, { left: `${barShare(ceiling) * 100}%` }]} />
      </View>
      <View style={styles.scaleLabels}>
        <Text style={styles.meta}>0%</Text>
        <Text style={styles.meta}>50%</Text>
      </View>
    </View>
  );
}

function AccountsCard({
  accounts,
  onEdit,
  onAdd,
}: {
  accounts: Tables<'credit_accounts'>[];
  onEdit: (id: string) => void;
  onAdd: () => void;
}) {
  const { format: formatAmount } = useDisplayCurrency();
  return (
    <Card style={styles.cardBody}>
      <Text style={styles.cardTitle}>Accounts</Text>
      {accounts.map((account) => (
        <Pressable
          key={account.id}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${account.name}`}
          onPress={() => onEdit(account.id)}
          style={styles.account}>
          <View style={styles.accountTop}>
            <Text style={styles.accountName}>{account.name}</Text>
            <Text style={styles.accountAmount}>
              {formatAmount(account.current_balance)} / {formatAmount(account.credit_limit)}
            </Text>
          </View>
          <Text style={styles.meta}>
            {TYPE_LABEL[account.type]} · {account.autopay ? 'Autopay on' : 'Autopay off'} · {openedLabel(account.opened_on)}
            {account.closed_on ? ' · Closed' : ''}
          </Text>
        </Pressable>
      ))}
      <SecondaryButton title="Add a card" onPress={onAdd} />
    </Card>
  );
}

function HealthCard({
  rate,
  payments,
  inquiries,
  maxInquiries,
  inquiriesStatus,
  oldest,
  attention,
}: {
  rate: number | null;
  payments: 'On target' | 'Below target' | null;
  inquiries: number;
  maxInquiries: number;
  inquiriesStatus: 'Within max' | 'Above max';
  oldest: number | null;
  attention: { name: string; reasons: AttentionReason[] }[];
}) {
  return (
    <Card style={styles.cardBody}>
      <Text style={styles.cardTitle}>Health checks</Text>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.checkLabel}>On-time payments</Text>
          <Text style={styles.checkValue}>{rate == null ? 'No payments logged' : formatPercent(rate, 0)}</Text>
          <Text style={styles.meta}>100% target</Text>
        </View>
        {payments ? <Chip tone={payments === 'On target' ? 'ok' : 'bad'} label={payments} /> : null}
      </View>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.checkLabel}>Hard inquiries, last 12 months</Text>
          <Text style={styles.checkValue}>
            {inquiries} of {maxInquiries} max
          </Text>
        </View>
        <Chip tone={inquiriesStatus === 'Within max' ? 'ok' : 'bad'} label={inquiriesStatus} />
      </View>
      <View>
        <Text style={styles.checkLabel}>Age of oldest open account</Text>
        <Text style={styles.checkValue}>{oldest == null ? 'No open date' : `${oldest} months`}</Text>
      </View>
      <View>
        <Text style={styles.checkLabel}>Needing attention</Text>
        <Text style={styles.checkValue}>{attention.length}</Text>
        {attention.map((item) => (
          <Text key={item.name} style={styles.meta}>
            {item.name} · {item.reasons.map(reasonLabel).join(', ')}
          </Text>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  page: {
    padding: spacing[16],
    gap: spacing[16],
    paddingBottom: spacing[32],
  },
  pageWide: {
    paddingHorizontal: spacing[32],
    paddingVertical: spacing[28],
  },
  title: {
    fontFamily: typography.family[800],
    fontSize: typography.size[34],
    color: colors.ink,
  },
  loading: {
    marginTop: spacing[24],
  },
  message: {
    fontFamily: typography.family[500],
    fontSize: typography.size[15],
    color: colors.ink,
    marginBottom: spacing[12],
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[16],
  },
  stack: {
    gap: spacing[16],
  },
  column: {
    gap: spacing[16],
  },
  columnPhone: {
    width: '100%',
  },
  columnWide: {
    flex: 1,
    minWidth: 0,
  },
  inkCard: {
    backgroundColor: colors.ink,
    borderRadius: radius.hero,
    padding: spacing[20],
    gap: spacing[12],
  },
  inkLabel: {
    fontFamily: typography.family[700],
    fontSize: typography.size[13],
    color: colors.heroMint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  scoreLine: {
    fontFamily: typography.family[800],
    fontSize: typography.size[26],
    color: colors.surface,
  },
  inkBody: {
    fontFamily: typography.family[400],
    fontSize: typography.size[14],
    color: colors.surface,
  },
  cardBody: {
    gap: spacing[12],
  },
  cardTitle: {
    fontFamily: typography.family[800],
    fontSize: typography.size[17],
    color: colors.ink,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[12],
  },
  flex: {
    flex: 1,
    gap: spacing[4],
  },
  big: {
    fontFamily: typography.family[800],
    fontSize: typography.size[34],
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  meta: {
    fontFamily: typography.family[400],
    fontSize: typography.size[13],
    color: colors.muted,
  },
  alert: {
    fontFamily: typography.family[600],
    fontSize: typography.size[14],
    color: colors.warnText,
    backgroundColor: colors.warnBg,
    borderRadius: radius.input,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
    overflow: 'hidden',
  },
  scale: {
    height: 18,
    justifyContent: 'flex-end',
  },
  track: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.divider,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    backgroundColor: colors.accent,
  },
  marker: {
    position: 'absolute',
    bottom: 0,
    width: 2,
    height: 14,
    marginLeft: -1,
    backgroundColor: colors.accent,
  },
  ceilingMarker: {
    backgroundColor: colors.danger,
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  account: {
    minHeight: 44,
    paddingVertical: spacing[8],
    gap: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  accountTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[12],
  },
  accountName: {
    flex: 1,
    fontFamily: typography.family[700],
    fontSize: typography.size[15],
    color: colors.ink,
  },
  accountAmount: {
    fontFamily: typography.family[600],
    fontSize: typography.size[14],
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  checkLabel: {
    fontFamily: typography.family[600],
    fontSize: typography.size[14],
    color: colors.ink,
  },
  checkValue: {
    fontFamily: typography.family[700],
    fontSize: typography.size[17],
    color: colors.ink,
  },
});
