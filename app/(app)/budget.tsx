import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { BudgetLineSheet } from '../../src/components/budget-line-sheet';
import { Card } from '../../src/components/card';
import { Chip } from '../../src/components/chip';
import { CollapsibleSection } from '../../src/components/collapsible-section';
import { MonthSwitcher } from '../../src/components/month-switcher';
import { ProgressBar } from '../../src/components/progress-bar';
import { SegmentedControl } from '../../src/components/segmented-control';
import { useDisplayCurrency } from '../../src/data/display-currency';
import { useBucketOpen } from '../../src/data/budget-open';
import { useBudgetLines, useCategories } from '../../src/data/budget-lines';
import { useMonth } from '../../src/data/month';
import { useMonthSummary, type MonthSummaryCategory } from '../../src/data/summary';
import { useView } from '../../src/data/view';
import { bucketStatus, type BudgetBucket, type BucketStatus } from '../../src/lib/budget';
import { formatPercent } from '../../src/lib/money';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

const BUCKETS: { id: BudgetBucket; name: string; color: string }[] = [
  { id: 'needs', name: 'Needs & Personal', color: colors.accent },
  { id: 'investment', name: 'Investment', color: colors.investment },
  { id: 'emergency', name: 'Emergency', color: colors.emergency },
];

function statusTone(status: BucketStatus): 'ok' | 'bad' {
  return status === 'Within limit' || status === 'On target' ? 'ok' : 'bad';
}

function usedLabel(spent: number, planned: number) {
  if (planned <= 0) {
    return spent > 0 ? 'Over' : '0.0%';
  }
  return formatPercent(spent / planned, 1);
}

export default function BudgetScreen() {
  const { format: formatAmount } = useDisplayCurrency();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const month = useMonth((state) => state.month);
  const view = useView((state) => state.view);
  const setView = useView((state) => state.setView);
  const summary = useMonthSummary(month, view);
  const lines = useBudgetLines(month);
  const categories = useCategories();
  const { open, setBucketOpen } = useBucketOpen();
  const [editingId, setEditingId] = useState<string | null>(null);

  const income = summary.data?.budgeted_income ?? 0;
  const allocated = (summary.data?.categories ?? []).reduce((sum, category) => sum + category.planned, 0);
  const spent = (summary.data?.categories ?? []).reduce((sum, category) => sum + category.spent, 0);
  const unallocated = income - allocated;
  const editing = (summary.data?.categories ?? []).find((category) => category.id === editingId) ?? null;
  const editingLine = lines.data?.find((line) => line.category_id === editingId) ?? null;
  const editingMeta = categories.data?.find((category) => category.id === editingId);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.page, wide ? styles.pageWide : null]}>
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

        {summary.isLoading ? <ActivityIndicator color={colors.accent} style={styles.loading} /> : null}
        {summary.isError ? <Text style={styles.message}>The budget could not be loaded.</Text> : null}

        {summary.data ? (
          <>
            <View style={styles.tiles}>
              <StatTile label="Budgeted income" value={formatAmount(income)} />
              <StatTile label="Allocated" value={formatAmount(allocated)} />
              <StatTile label="Spent so far" value={formatAmount(spent)} />
              <StatTile label="Unallocated" value={formatAmount(unallocated)} negative={unallocated < 0} />
            </View>
            {BUCKETS.map((bucket) => {
              const rows = summary.data.categories.filter((category) => category.bucket === bucket.id);
              const planned = summary.data.buckets[bucket.id]?.planned ?? rows.reduce((sum, row) => sum + row.planned, 0);
              const share = income > 0 ? planned / income : 0;
              const status = bucketStatus(bucket.id, share, summary.data.targets[bucket.id]);
              return (
                <Card key={bucket.id}>
                  <CollapsibleSection
                    accessibilityLabel={`${bucket.name}, ${status}`}
                    open={open[bucket.id]}
                    onOpenChange={(next) => setBucketOpen(bucket.id, next)}
                    title={
                      <BucketHeader
                        name={bucket.name}
                        color={bucket.color}
                        count={rows.length}
                        planned={planned}
                        share={share}
                        status={status}
                      />
                    }>
                    {wide ? (
                      <BucketTable
                        rows={rows}
                        color={bucket.color}
                        editable={view === 'me'}
                        onEdit={setEditingId}
                      />
                    ) : (
                      rows.map((row) => (
                        <CategoryRow
                          key={row.id}
                          row={row}
                          color={bucket.color}
                          editable={view === 'me'}
                          onEdit={() => setEditingId(row.id)}
                        />
                      ))
                    )}
                  </CollapsibleSection>
                </Card>
              );
            })}
          </>
        ) : null}

        {view === 'me' ? (
          <Text style={styles.footer}>Your budget lines are yours; your partner keeps their own.</Text>
        ) : null}
      </ScrollView>
      {view === 'me' && editing ? (
        <BudgetLineSheet
          key={editing.id}
          categoryName={editing.name}
          rent={Boolean(editingMeta?.is_rent || editingLine?.categories?.is_rent)}
          line={editingLine}
          onClose={() => setEditingId(null)}
        />
      ) : null}
    </View>
  );
}

function StatTile({ label, value, negative = false }: { label: string; value: string; negative?: boolean }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, negative ? styles.negative : null]}>{value}</Text>
    </View>
  );
}

function BucketHeader({
  name,
  color,
  count,
  planned,
  share,
  status,
}: {
  name: string;
  color: string;
  count: number;
  planned: number;
  share: number;
  status: BucketStatus;
}) {
  const { format: formatAmount } = useDisplayCurrency();
  return (
    <View style={styles.bucketHeader}>
      <View style={styles.bucketTitle}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.bucketName}>{name}</Text>
      </View>
      <Text style={styles.bucketMeta}>
        {count} {count === 1 ? 'category' : 'categories'}
      </Text>
      <Text style={styles.bucketMeta}>
        {formatAmount(planned)} · {formatPercent(share, 1)} of income
      </Text>
      <Chip tone={statusTone(status)} label={status} />
    </View>
  );
}

function CategoryRow({
  row,
  color,
  editable,
  onEdit,
}: {
  row: MonthSummaryCategory;
  color: string;
  editable: boolean;
  onEdit: () => void;
}) {
  const { format: formatAmount } = useDisplayCurrency();
  const used = row.planned > 0 ? row.spent / row.planned : row.spent > 0 ? 1.01 : 0;
  const body = (
    <View style={styles.phoneRow}>
      <View style={styles.phoneTop}>
        <Text style={styles.categoryName}>{row.name}</Text>
        <Text style={styles.categoryMoney}>
          {formatAmount(row.spent)} / {formatAmount(row.planned)}
        </Text>
      </View>
      <ProgressBar value={used} color={color} accessibilityLabel={`${row.name} progress`} />
    </View>
  );
  if (!editable) {
    return body;
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${row.name}`} onPress={onEdit} style={styles.hit}>
      {body}
    </Pressable>
  );
}

function BucketTable({
  rows,
  color,
  editable,
  onEdit,
}: {
  rows: MonthSummaryCategory[];
  color: string;
  editable: boolean;
  onEdit: (id: string) => void;
}) {
  const { format: formatAmount } = useDisplayCurrency();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.table}>
        <View style={styles.tableHead}>
          <Text style={[styles.head, styles.colName]}>Category</Text>
          <Text style={[styles.head, styles.colMoney]}>Planned</Text>
          <Text style={[styles.head, styles.colMoney]}>Spent</Text>
          <Text style={[styles.head, styles.colMoney]}>Left</Text>
          <Text style={[styles.head, styles.colProgress]}>Progress</Text>
        </View>
        {rows.map((row) => {
          const left = row.planned - row.spent;
          const used = row.planned > 0 ? row.spent / row.planned : row.spent > 0 ? 1.01 : 0;
          const content = (
            <>
              <Text style={[styles.cell, styles.colName]}>{row.name}</Text>
              <Text style={[styles.cell, styles.colMoney]}>{formatAmount(row.planned)}</Text>
              <Text style={[styles.cell, styles.colMoney]}>{formatAmount(row.spent)}</Text>
              <Text style={[styles.cell, styles.colMoney, left < 0 ? styles.negative : null]}>{formatAmount(left)}</Text>
              <View style={styles.colProgress}>
                <View style={styles.bar}>
                  <ProgressBar value={used} color={color} accessibilityLabel={`${row.name} progress`} />
                </View>
                <Text style={styles.percent}>{usedLabel(row.spent, row.planned)}</Text>
              </View>
            </>
          );
          if (!editable) {
            return (
              <View key={row.id} style={styles.tableRow}>
                {content}
              </View>
            );
          }
          return (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${row.name}`}
              onPress={() => onEdit(row.id)}
              style={styles.tableRow}>
              {content}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  page: {
    padding: spacing[20],
    gap: spacing[16],
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
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[12],
  },
  tile: {
    flexGrow: 1,
    flexBasis: 150,
    minWidth: 150,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing[16],
    gap: spacing[4],
  },
  tileLabel: {
    fontFamily: typography.family[600],
    fontSize: typography.size[13],
    color: colors.muted,
  },
  tileValue: {
    fontFamily: typography.family[700],
    fontSize: typography.size[20],
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  negative: {
    color: colors.danger,
  },
  loading: {
    marginVertical: spacing[16],
  },
  message: {
    fontFamily: typography.family[500],
    fontSize: typography.size[14],
    color: colors.muted,
    textAlign: 'center',
  },
  bucketHeader: {
    gap: spacing[4],
    paddingVertical: spacing[4],
  },
  bucketTitle: {
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
  bucketMeta: {
    fontFamily: typography.family[500],
    fontSize: typography.size[13],
    color: colors.muted,
  },
  hit: {
    minHeight: 44,
  },
  phoneRow: {
    gap: spacing[4],
    paddingVertical: spacing[8],
  },
  phoneTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[12],
  },
  categoryName: {
    flex: 1,
    fontFamily: typography.family[600],
    fontSize: typography.size[15],
    color: colors.ink,
  },
  categoryMoney: {
    fontFamily: typography.family[600],
    fontSize: typography.size[14],
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  table: {
    minWidth: 680,
  },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    gap: spacing[12],
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    gap: spacing[12],
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
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
    fontVariant: ['tabular-nums'],
  },
  colName: {
    width: 180,
  },
  colMoney: {
    width: 110,
    textAlign: 'right',
  },
  colProgress: {
    width: 180,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  bar: {
    flex: 1,
  },
  percent: {
    width: 52,
    textAlign: 'right',
    fontFamily: typography.family[600],
    fontSize: typography.size[12],
    color: colors.muted,
    fontVariant: ['tabular-nums'],
  },
  footer: {
    fontFamily: typography.family[400],
    fontSize: typography.size[13],
    color: colors.muted,
  },
});
