import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCategories, useCreateCategory, useUpdateCategory } from '../../data/budget-lines';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import type { Enums } from '../../types/database';
import { SecondaryButton } from '../secondary-button';
import { SegmentedControl } from '../segmented-control';
import { TextField } from '../text-field';
import { errorText, parseWholePercent } from './form';
import { SectionFrame } from './section-frame';

type Bucket = Enums<'budget_bucket'>;
type Kind = Enums<'category_kind'>;

const BUCKET_LABEL: Record<Bucket, string> = {
  needs: 'Needs & Personal',
  investment: 'Investment',
  emergency: 'Emergency',
};

const BUCKET_PILL: Record<Bucket, { backgroundColor: string; color: string }> = {
  needs: { backgroundColor: colors.accent, color: colors.surface },
  investment: { backgroundColor: colors.investment, color: colors.surface },
  emergency: { backgroundColor: colors.warnBg, color: colors.warnText },
};

const NEXT_BUCKET: Record<Bucket, Bucket> = {
  needs: 'investment',
  investment: 'emergency',
  emergency: 'needs',
};

const KIND_LABEL: Record<Kind, string> = {
  fixed: 'Fixed',
  variable: 'Variable',
  income: 'Income',
};

type CategoriesSectionProps = {
  locked: boolean;
  onSaved: (message?: string) => void;
};

export function CategoriesSection({ locked, onSaved }: CategoriesSectionProps) {
  const categories = useCategories();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Kind>('variable');
  const [bucket, setBucket] = useState<Bucket>('needs');
  const [split, setSplit] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const visible = (categories.data ?? []).filter((category) => !category.archived);

  async function cycle(id: string, current: Bucket) {
    setError(null);
    try {
      await update.mutateAsync({ id, bucket: NEXT_BUCKET[current] });
      onSaved('Category updated');
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  async function archive(id: string) {
    setError(null);
    try {
      await update.mutateAsync({ id, archived: true });
      onSaved('Category archived');
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  async function add() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a category name');
      return;
    }
    const splitValue = kind === 'income' ? null : parseWholePercent(split);
    if (kind !== 'income' && splitValue == null) {
      setError('Enter a default split from 0 to 100');
      return;
    }
    setError(null);
    try {
      await create.mutateAsync({
        name: trimmed,
        kind,
        bucket: kind === 'income' ? null : bucket,
        defaultSplit: splitValue == null ? null : splitValue / 100,
        sortOrder: (categories.data ?? []).reduce((max, category) => Math.max(max, category.sort_order), 0) + 1,
      });
      setName('');
      setSplit('0');
      setAdding(false);
      onSaved('Category added');
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <SectionFrame title="Categories" error={error}>
      {visible.map((category) => (
        <View key={category.id} style={styles.row}>
          <View style={styles.text}>
            <Text style={styles.name}>{category.name}</Text>
            <Text style={styles.kind}>{KIND_LABEL[category.kind]}</Text>
          </View>
          {category.bucket ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${category.name} bucket, ${BUCKET_LABEL[category.bucket]}`}
              accessibilityState={{ disabled: locked }}
              disabled={locked || update.isPending}
              onPress={() => void cycle(category.id, category.bucket as Bucket)}
              style={[styles.pill, { backgroundColor: BUCKET_PILL[category.bucket].backgroundColor }]}>
              <Text style={[styles.pillLabel, { color: BUCKET_PILL[category.bucket].color }]}>{BUCKET_LABEL[category.bucket]}</Text>
            </Pressable>
          ) : null}
          {locked ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Archive ${category.name}`}
              disabled={update.isPending}
              onPress={() => void archive(category.id)}
              style={styles.archive}>
              <Text style={styles.archiveLabel}>Archive</Text>
            </Pressable>
          )}
        </View>
      ))}
      {locked ? null : adding ? (
        <View style={styles.form}>
          <TextField label="Name" value={name} onChangeText={setName} />
          <SegmentedControl
            accessibilityLabel="Category kind"
            options={[
              { value: 'fixed', label: 'Fixed' },
              { value: 'variable', label: 'Variable' },
              { value: 'income', label: 'Income' },
            ]}
            value={kind}
            onChange={setKind}
          />
          {kind === 'income' ? null : (
            <>
              <SegmentedControl
                accessibilityLabel="Bucket"
                options={[
                  { value: 'needs', label: 'Needs' },
                  { value: 'investment', label: 'Investment' },
                  { value: 'emergency', label: 'Emergency' },
                ]}
                value={bucket}
                onChange={setBucket}
              />
              <TextField label="Default split (%)" value={split} onChangeText={setSplit} keyboardType="number-pad" />
            </>
          )}
          <SecondaryButton title="Add category" loading={create.isPending} onPress={() => void add()} />
        </View>
      ) : (
        <SecondaryButton title="Add category" onPress={() => setAdding(true)} />
      )}
    </SectionFrame>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    minHeight: 44,
  },
  text: {
    flex: 1,
    gap: spacing[4],
  },
  name: {
    fontFamily: typography.family[600],
    fontSize: typography.size[15],
    color: colors.ink,
  },
  kind: {
    fontFamily: typography.family[400],
    fontSize: typography.size[12],
    color: colors.muted,
  },
  pill: {
    minHeight: 44,
    borderRadius: 999,
    paddingHorizontal: spacing[12],
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillLabel: {
    fontFamily: typography.family[700],
    fontSize: typography.size[12],
  },
  archive: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing[8],
  },
  archiveLabel: {
    fontFamily: typography.family[600],
    fontSize: typography.size[14],
    color: colors.danger,
  },
  form: {
    gap: spacing[12],
    borderRadius: radius.input,
  },
});
