import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, ActivityIndicator } from 'react-native';

import { EmptyState } from '../../../src/components/empty-state';
import { FeedAvatar } from '../../../src/components/feed-avatar';
import { MonthSwitcher } from '../../../src/components/month-switcher';
import { PrimaryButton } from '../../../src/components/primary-button';
import { SegmentedControl } from '../../../src/components/segmented-control';
import { useDisplayCurrency } from '../../../src/data/display-currency';
import { useMyMembership } from '../../../src/data/household';
import { useMonth } from '../../../src/data/month';
import { useFeed } from '../../../src/data/summary';
import { useView, type BudgetView } from '../../../src/data/view';
import { colors, spacing, typography } from '../../../src/theme/tokens';

type Filter = 'all' | 'expense' | 'income' | 'joint' | 'mine';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'expense', label: 'Expenses' },
  { value: 'income', label: 'Income' },
  { value: 'joint', label: 'Joint' },
  { value: 'mine', label: 'Mine' },
];

type FeedRow = NonNullable<ReturnType<typeof useFeed>['data']>[number];

function feedDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function matches(row: FeedRow, filter: Filter) {
  if (filter === 'expense') {
    return row.type === 'expense';
  }
  if (filter === 'income') {
    return row.type === 'income';
  }
  if (filter === 'joint') {
    return row.scope === 'joint';
  }
  if (filter === 'mine') {
    return row.is_mine;
  }
  return true;
}

function shareLabel(share: number) {
  return `${Math.round(share * 100)}%`;
}

function detail(
  row: FeedRow,
  view: BudgetView,
  myShare: number,
  primaryShare: number,
  partnerShare: number,
  formatAmount: (cad: number) => string,
) {
  if (row.scope !== 'joint') {
    return null;
  }
  if (view === 'me') {
    return `Your ${shareLabel(myShare)} of ${formatAmount(row.amount_cad)}`;
  }
  return `Joint · split ${Math.round(primaryShare * 100)}/${Math.round(partnerShare * 100)}`;
}

function amountLabel(row: FeedRow, formatAmount: (cad: number) => string) {
  const money = formatAmount(row.view_amount_cad);
  return row.type === 'income' ? `+${money}` : money;
}

export default function TransactionsScreen() {
  const { format: formatAmount } = useDisplayCurrency();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const month = useMonth((state) => state.month);
  const view = useView((state) => state.view);
  const setView = useView((state) => state.setView);
  const membership = useMyMembership();
  const feed = useFeed(month, view, 100);
  const [filter, setFilter] = useState<Filter>('all');
  const rows = (feed.data ?? []).filter((row) => matches(row, filter));
  const myShare = membership.data?.joint_share ?? 0.5;
  const primaryShare = membership.data?.role === 'primary' ? myShare : 1 - myShare;
  const partnerShare = 1 - primaryShare;

  return (
    <ScrollView
      contentContainerStyle={[styles.page, wide ? styles.pageWide : null]}
      keyboardShouldPersistTaps="handled">
      <View style={[styles.header, wide ? styles.headerWide : null]}>
        <MonthSwitcher />
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((item) => {
          const selected = filter === item.value;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected }}
              onPress={() => setFilter(item.value)}
              style={[styles.filter, selected ? styles.filterSelected : null]}>
              <Text style={[styles.filterLabel, selected ? styles.filterLabelSelected : null]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {feed.isLoading ? <ActivityIndicator color={colors.accent} style={styles.loading} /> : null}
      {feed.isError ? <Text style={styles.error}>Transactions could not be loaded.</Text> : null}
      {!feed.isLoading && !feed.isError && feed.data?.length === 0 ? (
        <EmptyState
          title="Nothing logged for this view yet."
          body=""
          action={<PrimaryButton title="Add" onPress={() => router.push('/transactions/new' as Href)} />}
        />
      ) : null}
      {!feed.isLoading && !feed.isError && (feed.data?.length ?? 0) > 0 && rows.length === 0 ? (
        <Text style={styles.error}>No transactions match this filter.</Text>
      ) : null}
      {!feed.isLoading && rows.length > 0 && wide ? (
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.head, styles.date]}>Date</Text>
            <Text style={[styles.head, styles.description]}>Description</Text>
            <Text style={[styles.head, styles.category]}>Category</Text>
            <Text style={[styles.head, styles.whose]}>Whose</Text>
            <Text style={[styles.head, styles.amount]}>Amount</Text>
          </View>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              row={row}
              note={detail(row, view, myShare, primaryShare, partnerShare, formatAmount)}
            />
          ))}
        </View>
      ) : null}
      {!feed.isLoading && rows.length > 0 && !wide
        ? rows.map((row) => (
            <PhoneRow
              key={row.id}
              row={row}
              note={detail(row, view, myShare, primaryShare, partnerShare, formatAmount)}
            />
          ))
        : null}
    </ScrollView>
  );
}

function openMine(row: FeedRow) {
  if (row.is_mine) {
    router.push(`/transactions/${row.id}` as Href);
  }
}

function TableRow({ row, note }: { row: FeedRow; note: string | null }) {
  const { format: formatAmount } = useDisplayCurrency();
  const body = (
    <>
      <Text style={[styles.cell, styles.date]}>{feedDate(row.occurred_on)}</Text>
      <View style={styles.description}>
        <Text style={styles.cell}>{row.description}</Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
      <Text style={[styles.cell, styles.category]}>{row.category_name}</Text>
      <Text style={[styles.cell, styles.whose]}>{row.scope === 'joint' ? 'Joint' : row.owner_name}</Text>
      <Text style={[styles.cell, styles.amount, row.type === 'income' ? styles.income : null]}>{amountLabel(row, formatAmount)}</Text>
    </>
  );

  if (!row.is_mine) {
    return <View style={styles.tableRow}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${row.description}, ${amountLabel(row, formatAmount)}`}
      onPress={() => openMine(row)}
      style={styles.tableRow}>
      {body}
    </Pressable>
  );
}

function PhoneRow({ row, note }: { row: FeedRow; note: string | null }) {
  const { format: formatAmount } = useDisplayCurrency();
  const body = (
    <>
      <FeedAvatar scope={row.scope} name={row.owner_name} mine={row.is_mine} />
      <View style={styles.phoneText}>
        <Text style={styles.descriptionText}>{row.description}</Text>
        <Text style={styles.meta}>
          {row.category_name} · {feedDate(row.occurred_on)}
        </Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
      <Text style={[styles.phoneAmount, row.type === 'income' ? styles.income : null]}>{amountLabel(row, formatAmount)}</Text>
    </>
  );

  if (!row.is_mine) {
    return <View style={styles.phoneRow}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${row.description}, ${amountLabel(row, formatAmount)}`}
      onPress={() => openMine(row)}
      style={styles.phoneRow}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: spacing[20],
    gap: spacing[16],
    backgroundColor: colors.bg,
  },
  pageWide: {
    width: '100%',
    maxWidth: 1160,
    alignSelf: 'center',
    paddingVertical: spacing[28],
    paddingHorizontal: spacing[32],
  },
  header: {
    gap: spacing[12],
  },
  headerWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewWide: {
    width: 280,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing[8],
    paddingVertical: spacing[4],
  },
  filter: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[16],
  },
  filterSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterLabel: {
    fontFamily: typography.family[600],
    fontSize: typography.size[14],
    color: colors.ink,
  },
  filterLabelSelected: {
    color: colors.surface,
  },
  error: {
    fontFamily: typography.family[500],
    fontSize: typography.size[14],
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: spacing[24],
  },
  loading: {
    marginVertical: spacing[24],
  },
  table: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
  },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: spacing[16],
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: spacing[12],
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: spacing[12],
  },
  head: {
    fontFamily: typography.family[700],
    fontSize: typography.size[12],
    color: colors.muted,
    textTransform: 'uppercase',
  },
  cell: {
    fontFamily: typography.family[500],
    fontSize: typography.size[14],
    color: colors.ink,
  },
  date: {
    width: 88,
  },
  description: {
    flex: 2,
    gap: spacing[4],
  },
  category: {
    flex: 1.2,
  },
  whose: {
    flex: 1,
  },
  amount: {
    width: 120,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
    fontFamily: typography.family[700],
  },
  income: {
    color: colors.accent,
  },
  note: {
    fontFamily: typography.family[400],
    fontSize: typography.size[12],
    color: colors.muted,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    minHeight: 44,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing[12],
  },
  phoneText: {
    flex: 1,
    gap: spacing[4],
  },
  descriptionText: {
    fontFamily: typography.family[600],
    fontSize: typography.size[15],
    color: colors.ink,
  },
  meta: {
    fontFamily: typography.family[400],
    fontSize: typography.size[13],
    color: colors.muted,
  },
  phoneAmount: {
    fontFamily: typography.family[700],
    fontSize: typography.size[15],
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
});
