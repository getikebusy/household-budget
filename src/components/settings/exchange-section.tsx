import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import {
  effectiveRate,
  useFxQuotes,
  useUpdateSettings,
  type FxQuote,
  type HouseholdSettings,
} from '../../data/settings';
import { colors, typography } from '../../theme/tokens';
import { TextField } from '../text-field';
import { errorText, timeAgo } from './form';
import { SectionFrame } from './section-frame';
import { useServerState } from './use-server-state';

type ExchangeSectionProps = {
  settings: HouseholdSettings;
  locked: boolean;
  onSaved: () => void;
};

function formatRate(rate: number) {
  return rate.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function rateText(quote: FxQuote, rate: number | null) {
  if (rate == null) {
    return `${quote}: No rate yet`;
  }
  const prefix = quote === 'NGN' ? '₦' : '';
  return `${quote}: ${prefix}${formatRate(rate)} per CAD`;
}

export function ExchangeSection({ settings, locked, onSaved }: ExchangeSectionProps) {
  const quotes = useFxQuotes();
  const update = useUpdateSettings();
  const server = settings.fx_override_ngn_per_cad == null ? '' : String(settings.fx_override_ngn_per_cad);
  const [override, setOverride] = useServerState(server);
  const [error, setError] = useState<string | null>(null);
  const dirty = override.trim() !== server;
  const draftRate = override.trim() === '' ? null : Number(override);
  const used = effectiveRate(
    { fx_override_ngn_per_cad: draftRate != null && draftRate > 0 ? draftRate : null },
    quotes.data?.NGN,
  );

  async function save() {
    const trimmed = override.trim();
    if (trimmed !== '' && !(Number(trimmed) > 0)) {
      setError('Enter a rate greater than zero, or leave it blank');
      return;
    }
    setError(null);
    try {
      await update.mutateAsync({ fx_override_ngn_per_cad: trimmed === '' ? null : Number(trimmed) });
      onSaved();
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <SectionFrame
      title="Exchange rate"
      dirty={!locked && dirty}
      saving={update.isPending}
      onSave={() => void save()}
      error={error}>
      {(['NGN', 'USD', 'GBP'] as const).map((quote) => {
        const row = quotes.data?.[quote];
        return (
          <Text key={quote} style={styles.body}>
            Live rate {rateText(quote, row?.rate ?? null)}
            {row ? ` · updated ${timeAgo(row.fetched_at)}` : ''}
          </Text>
        );
      })}
      <TextField
        label="Manual override (₦ per CAD)"
        value={override}
        onChangeText={setOverride}
        keyboardType="decimal-pad"
        editable={!locked}
        placeholder="Leave blank to use the live rate"
      />
      <Text style={styles.body}>Naira rate used {rateText('NGN', used).replace('NGN: ', '')}</Text>
    </SectionFrame>
  );
}

const styles = StyleSheet.create({
  body: {
    fontFamily: typography.family[500],
    fontSize: typography.size[14],
    color: colors.ink,
  },
});
