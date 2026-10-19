import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { effectiveRate, useLatestFxRate, useUpdateSettings, type HouseholdSettings } from '../../data/settings';
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

function rateText(rate: number | null) {
  if (rate == null) {
    return 'No rate yet';
  }
  return `₦${rate.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per CAD`;
}

export function ExchangeSection({ settings, locked, onSaved }: ExchangeSectionProps) {
  const latest = useLatestFxRate();
  const update = useUpdateSettings();
  const server = settings.fx_override_ngn_per_cad == null ? '' : String(settings.fx_override_ngn_per_cad);
  const [override, setOverride] = useServerState(server);
  const [error, setError] = useState<string | null>(null);
  const dirty = override.trim() !== server;
  const draftRate = override.trim() === '' ? null : Number(override);
  const used = effectiveRate(
    { fx_override_ngn_per_cad: draftRate != null && draftRate > 0 ? draftRate : null },
    latest.data,
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
      <Text style={styles.body}>
        Live rate {rateText(latest.data?.rate ?? null)}
        {latest.data ? ` · updated ${timeAgo(latest.data.fetched_at)}` : ''}
      </Text>
      <TextField
        label="Manual override (₦ per CAD)"
        value={override}
        onChangeText={setOverride}
        keyboardType="decimal-pad"
        editable={!locked}
        placeholder="Leave blank to use the live rate"
      />
      <Text style={styles.body}>Rate used {rateText(used)}</Text>
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
