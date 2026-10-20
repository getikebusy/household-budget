import { router, type Href } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { Card } from '../../src/components/card';
import { Chip } from '../../src/components/chip';
import { FeedAvatar } from '../../src/components/feed-avatar';
import { PrimaryButton } from '../../src/components/primary-button';
import { ProgressBar } from '../../src/components/progress-bar';
import { SecondaryButton } from '../../src/components/secondary-button';
import { SegmentedControl } from '../../src/components/segmented-control';
import { Skeleton } from '../../src/components/skeleton';
import { useDisplayCurrency } from '../../src/data/display-currency';
import { useCreditAccounts, useCreditLogs } from '../../src/data/credit';
import { useMembers, useMyMembership } from '../../src/data/household';
import { formatMonthTitle, useMonth } from '../../src/data/month';
import { useSettings, type HouseholdSettings } from '../../src/data/settings';
import { useFeed, useMonthSummary, type MonthSummary } from '../../src/data/summary';
import { useView, type BudgetView } from '../../src/data/view';
import { bucketStatus, type BudgetBucket, type BucketStatus } from '../../src/lib/budget';
import { creditUtilisation, soonestStatement } from '../../src/lib/credit';
import { formatPercent } from '../../src/lib/money';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

const BUCKETS: { id: BudgetBucket; name: string; color: string; aim: 'max' | 'aim' }[] = [
  { id: 'needs', name: 'Needs & Personal', color: colors.accent, aim: 'max' },
  { id: 'investment', name: 'Investment', color: colors.investment, aim: 'aim' },
  { id: 'emergency', name: 'Emergency', color: colors.emergency, aim: 'aim' },
];

function statusTone(status: BucketStatus): 'ok' | 'bad' {
  return status === 'Within limit' || status === 'On target' ? 'ok' : 'bad';
}

function sheetsEnabled(settings: HouseholdSettings | null | undefined) {
  if (!settings || !('sheets_export_enabled' in settings)) {
    return false;
  }
  return Boolean((settings as HouseholdSettings & { sheets_export_enabled?: boolean }).sheets_export_enabled);
}

function statementLabel(days: number, date: Date) {
  const when = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  if (days === 0) {
    return `Statement closes ${when}, today`;
  }
  return `Statement closes ${when}, in ${days} ${days === 1 ? 'day' : 'days'}`;
}

export default function OverviewScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const month = useMonth((state) => state.month);
  const view = useView((state) => state.view);
  const setView = useView((state) => state.setView);
  const membership = useMyMembership();
  const members = useMembers();
  const settings = useSettings();
  const summary = useMonthSummary(month, view);
  const feed = useFeed(month, view, wide ? 6 : 5);
  const jointFeed = useFeed(month, 'household', 100);
  const creditAccounts = useCreditAccounts();
  const creditLogs = useCreditLogs();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await Promise.all([
      summary.refetch(),
      feed.refetch(),
      jointFeed.refetch(),
      settings.refetch(),
      creditAccounts.refetch(),
      creditLogs.refetch(),
      members.refetch(),
    ]);
    setRefreshing(false);
  }

  const loading = summary.isLoading && !summary.data;
  const failed = summary.isError && !summary.data;
  const targets = settings.data;
  const ruleTitle = targets
    ? `Your ${Math.round(targets.target_needs * 100)} / ${Math.round(targets.target_investment * 100)} / ${Math.round(targets.target_emergency * 100)}`
    : 'Your 55 / 25 / 20';

  return (
    <ScrollView
      contentContainerStyle={[styles.page, wide ? styles.pageWide : null]}
      refreshControl={wide ? undefined : <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.accent} />}>
      <View style={wide ? styles.columns : styles.stack}>
        <View style={styles.main}>
          <View style={[styles.header, wide ? styles.headerWide : null]}>
            <View style={styles.titles}>
              <Text style={styles.eyebrow}>{formatMonthTitle(month)}</Text>
              <Text style={styles.title}>{view === 'household' ? 'Our money' : `Hi, ${membership.data?.display_name ?? 'there'}`}</Text>
            </View>
            <View style={wide ? styles.viewWide : null}>
              <SegmentedControl
                accessibilityLabel="View"
                options={[
                  { value: 'me', label: 'Me' },
                  { value: 'household', label: 'Household' },
                ]}
                value={view}
                onChange={setView}
              />
            </View>
          </View>

          {failed ? (
            <Card>
              <Text style={styles.errorTitle}>The overview could not be loaded.</Text>
              <PrimaryButton title="Retry" onPress={() => void refresh()} />
            </Card>
          ) : null}

          {loading ? <OverviewSkeleton /> : null}

          {summary.data ? (
            <>
              <Hero summary={summary.data} wide={wide} />
              <RuleCard summary={summary.data} title={ruleTitle} wide={wide} />
              <Recent
                rows={feed.data ?? []}
                loading={feed.isLoading && !feed.data}
                failed={feed.isError}
                onRetry={() => void feed.refetch()}
              />
            </>
          ) : null}
        </View>

        <View style={[styles.side, wide ? styles.sideWide : null]}>
          <CreditSnapshot
            loading={creditAccounts.isLoading || creditLogs.isLoading}
            accounts={creditAccounts.data ?? []}
            log={creditLogs.data?.[0]}
            alertDays={settings.data?.statement_alert_days ?? 3}
          />
          <JointCard
            rent={settings.data?.rent_total_cad ?? 0}
            members={members.data ?? []}
            jointTotal={(jointFeed.data ?? [])
              .filter((row) => row.scope === 'joint' && row.type === 'expense')
              .reduce((sum, row) => sum + row.amount_cad, 0)}
          />
          {sheetsEnabled(settings.data) ? (
            <Card>
              <Text style={styles.cardTitle}>Synced with Google Sheets</Text>
            </Card>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

function Hero({ summary, wide }: { summary: MonthSummary; wide: boolean }) {
  const { format: formatAmount } = useDisplayCurrency();
  const planned = summary.categories.reduce((sum, category) => sum + category.planned, 0);
  const spent = summary.categories.reduce((sum, category) => sum + category.spent, 0);
  const left = planned - spent;
  const used = planned > 0 ? spent / planned : 0;

  return (
    <View style={styles.hero}>
      <Text style={styles.heroLabel}>Left to spend this month</Text>
      <Text style={[styles.heroAmount, wide ? styles.heroAmountWide : null]}>{formatAmount(left)}</Text>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Spent against planned"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(used * 100) }}
        style={styles.heroTrack}>
        <View style={[styles.heroFill, { width: `${Math.min(Math.max(used, 0), 1) * 100}%` }]} />
      </View>
      <View style={styles.heroStats}>
        <HeroStat label="Budgeted income" value={formatAmount(summary.budgeted_income)} />
        <HeroStat label="Planned" value={formatAmount(planned)} />
        <HeroStat label="Spent" value={formatAmount(spent)} />
      </View>
    </View>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatLabel}>{label}</Text>
      <Text style={styles.heroStatValue}>{value}</Text>
    </View>
  );
}

function RuleCard({ summary, title, wide }: { summary: MonthSummary; title: string; wide: boolean }) {
  const income = summary.budgeted_income;
  const buckets = BUCKETS.map((bucket) => {
    const rows = summary.categories.filter((category) => category.bucket === bucket.id);
    const planned = summary.buckets[bucket.id]?.planned ?? rows.reduce((sum, row) => sum + row.planned, 0);
    const spent = summary.buckets[bucket.id]?.spent ?? rows.reduce((sum, row) => sum + row.spent, 0);
    const share = income > 0 ? planned / income : 0;
    const target = summary.targets[bucket.id];
    return { ...bucket, planned, spent, share, target, status: bucketStatus(bucket.id, share, target) };
  });

  if (wide) {
    return (
      <View style={styles.ruleBlock}>
        <Text style={styles.ruleHeading}>{title}</Text>
        <View style={styles.ruleGrid}>
          {buckets.map((bucket) => (
            <Card key={bucket.id} style={styles.ruleCard}>
              <BucketBlock bucket={bucket} />
            </Card>
          ))}
        </View>
      </View>
    );
  }

  return (
    <Card style={styles.ruleCard}>
      <Text style={styles.ruleHeading}>{title}</Text>
      <View style={styles.ruleRows}>
        {buckets.map((bucket) => (
          <BucketBlock key={bucket.id} bucket={bucket} />
        ))}
      </View>
    </Card>
  );
}

function BucketBlock({
  bucket,
}: {
  bucket: (typeof BUCKETS)[number] & {
    planned: number;
    spent: number;
    share: number;
    target: number;
    status: BucketStatus;
  };
}) {
  const { format: formatAmount } = useDisplayCurrency();
  const used = bucket.planned > 0 ? bucket.spent / bucket.planned : bucket.spent > 0 ? 1.01 : 0;
  const targetPercent = Math.round(bucket.target * 100);
  return (
    <View style={styles.bucket}>
      <View style={styles.bucketTop}>
        <View style={[styles.dot, { backgroundColor: bucket.color }]} />
        <Text style={styles.bucketName}>{bucket.name}</Text>
        <Chip tone={statusTone(bucket.status)} label={bucket.status} />
      </View>
      <Text style={styles.bucketAmount}>{formatAmount(bucket.planned)}</Text>
      <ProgressBar value={used} color={bucket.color} accessibilityLabel={`${bucket.name} progress`} />
      <Text style={styles.bucketMeta}>{formatAmount(bucket.spent)} spent</Text>
      <Text style={styles.bucketMeta}>
        {formatPercent(bucket.share, 1)} · {bucket.aim} {targetPercent}%
      </Text>
    </View>
  );
}

function Recent({
  rows,
  loading,
  failed,
  onRetry,
}: {
  rows: NonNullable<ReturnType<typeof useFeed>['data']>;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const { format: formatAmount } = useDisplayCurrency();
  return (
    <Card style={styles.cardBody}>
      <View style={styles.recentHeader}>
        <Text style={styles.cardTitle}>Recent transactions</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="See all transactions"
          onPress={() => router.push('/transactions' as Href)}
          style={styles.seeAll}>
          <Text style={styles.seeAllLabel}>See all</Text>
        </Pressable>
      </View>
      {loading ? <Skeleton height={64} /> : null}
      {failed ? (
        <View style={styles.retry}>
          <Text style={styles.bucketMeta}>Transactions could not be loaded.</Text>
          <SecondaryButton title="Retry" onPress={onRetry} />
        </View>
      ) : null}
      {rows.map((row) => {
        const amount = row.type === 'income' ? `+${formatAmount(row.view_amount_cad)}` : formatAmount(row.view_amount_cad);
        const body = (
          <>
            <FeedAvatar scope={row.scope} name={row.owner_name} mine={row.is_mine} />
            <View style={styles.recentText}>
              <Text style={styles.recentDescription}>{row.description}</Text>
              <Text style={styles.bucketMeta}>{row.category_name}</Text>
            </View>
            <Text style={[styles.recentAmount, row.type === 'income' ? styles.income : null]}>{amount}</Text>
          </>
        );
        if (!row.is_mine) {
          return (
            <View key={row.id} style={styles.recentRow}>
              {body}
            </View>
          );
        }
        return (
          <Pressable
            key={row.id}
            accessibilityRole="button"
            accessibilityLabel={`${row.description}, ${amount}`}
            onPress={() => router.push(`/transactions/${row.id}` as Href)}
            style={styles.recentRow}>
            {body}
          </Pressable>
        );
      })}
      {!loading && !failed && rows.length === 0 ? <Text style={styles.bucketMeta}>Nothing logged for this view yet.</Text> : null}
    </Card>
  );
}

function CreditSnapshot({
  loading,
  accounts,
  log,
  alertDays,
}: {
  loading: boolean;
  accounts: NonNullable<ReturnType<typeof useCreditAccounts>['data']>;
  log: NonNullable<ReturnType<typeof useCreditLogs>['data']>[number] | undefined;
  alertDays: number;
}) {
  const utilisation = creditUtilisation(accounts);
  const next = soonestStatement(accounts);
  const showAlert = next != null && next.days <= alertDays;

  return (
    <Card style={styles.cardBody}>
      <View style={styles.recentHeader}>
        <Text style={styles.cardTitle}>Your credit</Text>
        <Chip tone="neutral" label="Private" />
      </View>
      {loading ? <Skeleton height={88} /> : null}
      {!loading ? (
        <>
          <Text style={styles.score}>
            {log?.equifax == null && log?.transunion == null
              ? 'No score yet'
              : [log?.equifax != null ? `Equifax ${log.equifax}` : null, log?.transunion != null ? `TransUnion ${log.transunion}` : null]
                  .filter(Boolean)
                  .join(' · ')}
          </Text>
          <Text style={styles.bucketAmount}>{utilisation == null ? '—' : formatPercent(utilisation, 0)}</Text>
          <Text style={styles.bucketMeta}>Utilisation</Text>
          {showAlert && next ? <Text style={styles.alert}>{statementLabel(next.days, next.date)}</Text> : null}
          <SecondaryButton title="Open credit" onPress={() => router.push('/credit' as Href)} />
        </>
      ) : null}
    </Card>
  );
}

function JointCard({
  rent,
  members,
  jointTotal,
}: {
  rent: number;
  members: { display_name: string; role: 'primary' | 'partner'; joint_share: number }[];
  jointTotal: number;
}) {
  const { format: formatAmount } = useDisplayCurrency();
  const primary = members.find((member) => member.role === 'primary');
  const partner = members.find((member) => member.role === 'partner');
  const primaryShare = primary?.joint_share ?? 0.5;
  const partnerShare = partner?.joint_share ?? 1 - primaryShare;

  return (
    <Card style={styles.cardBody}>
      <Text style={styles.cardTitle}>Joint costs</Text>
      <Text style={styles.bucketMeta}>Total rent {formatAmount(rent)}</Text>
      <Text style={styles.jointLine}>
        {primary?.display_name ?? 'Primary'} {Math.round(primaryShare * 100)}% · {formatAmount(rent * primaryShare)}
      </Text>
      <Text style={styles.jointLine}>
        {partner?.display_name ?? 'Partner'} {Math.round(partnerShare * 100)}% · {formatAmount(rent * partnerShare)}
      </Text>
      <Text style={styles.bucketMeta}>Logged as Joint this month {formatAmount(jointTotal)}</Text>
    </Card>
  );
}

function OverviewSkeleton() {
  return (
    <View style={styles.stack}>
      <Skeleton height={180} style={styles.heroSkeleton} />
      <Skeleton height={220} />
      <Skeleton height={160} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: spacing[20],
    backgroundColor: colors.bg,
  },
  pageWide: {
    width: '100%',
    maxWidth: 1160,
    alignSelf: 'center',
    paddingVertical: spacing[28],
    paddingHorizontal: spacing[32],
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[16],
  },
  stack: {
    gap: spacing[16],
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: spacing[16],
  },
  side: {
    width: '100%',
    gap: spacing[16],
  },
  sideWide: {
    width: 320,
  },
  header: {
    gap: spacing[12],
  },
  headerWide: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  titles: {
    gap: spacing[4],
    flex: 1,
  },
  eyebrow: {
    fontFamily: typography.family[700],
    fontSize: typography.size[13],
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: typography.family[800],
    fontSize: typography.size[34],
    color: colors.ink,
  },
  viewWide: {
    width: 280,
  },
  hero: {
    backgroundColor: colors.ink,
    borderRadius: radius.hero,
    padding: spacing[20],
    gap: spacing[12],
  },
  heroLabel: {
    fontFamily: typography.family[600],
    fontSize: typography.size[14],
    color: colors.surface,
  },
  heroAmount: {
    fontFamily: typography.family[800],
    fontSize: typography.size[34],
    color: colors.surface,
    fontVariant: ['tabular-nums'],
  },
  heroAmountWide: {
    fontSize: typography.size[44],
  },
  heroTrack: {
    height: 6,
    borderRadius: 6,
    backgroundColor: colors.heroTrack,
    overflow: 'hidden',
  },
  heroFill: {
    height: 6,
    borderRadius: 6,
    backgroundColor: colors.heroMint,
  },
  heroStats: {
    flexDirection: 'row',
    gap: spacing[12],
  },
  heroStat: {
    flex: 1,
    gap: spacing[4],
  },
  heroStatLabel: {
    fontFamily: typography.family[500],
    fontSize: typography.size[12],
    color: colors.heroMint,
  },
  heroStatValue: {
    fontFamily: typography.family[700],
    fontSize: typography.size[14],
    color: colors.surface,
    fontVariant: ['tabular-nums'],
  },
  ruleGrid: {
    flexDirection: 'row',
    gap: spacing[12],
    alignItems: 'stretch',
  },
  ruleBlock: {
    gap: spacing[12],
  },
  ruleCard: {
    flex: 1,
    gap: spacing[12],
  },
  cardBody: {
    gap: spacing[12],
  },
  ruleHeading: {
    fontFamily: typography.family[800],
    fontSize: typography.size[17],
    color: colors.ink,
  },
  ruleRows: {
    gap: spacing[16],
  },
  bucket: {
    gap: spacing[4],
  },
  bucketTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  bucketName: {
    flex: 1,
    fontFamily: typography.family[700],
    fontSize: typography.size[15],
    color: colors.ink,
  },
  bucketAmount: {
    fontFamily: typography.family[700],
    fontSize: typography.size[20],
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  bucketMeta: {
    fontFamily: typography.family[500],
    fontSize: typography.size[13],
    color: colors.muted,
  },
  cardTitle: {
    fontFamily: typography.family[800],
    fontSize: typography.size[17],
    color: colors.ink,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[8],
  },
  seeAll: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing[8],
  },
  seeAllLabel: {
    fontFamily: typography.family[700],
    fontSize: typography.size[14],
    color: colors.accent,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    minHeight: 44,
  },
  recentText: {
    flex: 1,
    gap: spacing[4],
  },
  recentDescription: {
    fontFamily: typography.family[600],
    fontSize: typography.size[15],
    color: colors.ink,
  },
  recentAmount: {
    fontFamily: typography.family[700],
    fontSize: typography.size[14],
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  income: {
    color: colors.accent,
  },
  retry: {
    gap: spacing[8],
  },
  score: {
    fontFamily: typography.family[800],
    fontSize: typography.size[26],
    color: colors.ink,
  },
  alert: {
    fontFamily: typography.family[600],
    fontSize: typography.size[13],
    color: colors.warnText,
  },
  jointLine: {
    fontFamily: typography.family[600],
    fontSize: typography.size[14],
    color: colors.ink,
  },
  errorTitle: {
    fontFamily: typography.family[700],
    fontSize: typography.size[17],
    color: colors.ink,
    marginBottom: spacing[12],
  },
  heroSkeleton: {
    borderRadius: radius.hero,
  },
});
