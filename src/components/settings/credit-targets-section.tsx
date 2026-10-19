import { useState } from 'react';

import { useUpdateSettings, type HouseholdSettings } from '../../data/settings';
import { TextField } from '../text-field';
import { errorText, fractionToWhole, parseWholePercent } from './form';
import { SectionFrame } from './section-frame';
import { useServerState } from './use-server-state';

type CreditTargetsSectionProps = {
  settings: HouseholdSettings;
  locked: boolean;
  onSaved: () => void;
};

function parseCount(text: string, max?: number): number | null {
  if (!/^\d+$/.test(text.trim())) {
    return null;
  }
  const value = Number(text);
  if (max != null && value > max) {
    return null;
  }
  return value;
}

export function CreditTargetsSection({ settings, locked, onSaved }: CreditTargetsSectionProps) {
  const update = useUpdateSettings();
  const [ceiling, setCeiling] = useServerState(fractionToWhole(settings.util_ceiling));
  const [ideal, setIdeal] = useServerState(fractionToWhole(settings.util_ideal));
  const [days, setDays] = useServerState(String(settings.statement_alert_days));
  const [inquiries, setInquiries] = useServerState(String(settings.max_hard_inquiries));
  const [error, setError] = useState<string | null>(null);
  const dirty =
    ceiling !== fractionToWhole(settings.util_ceiling) ||
    ideal !== fractionToWhole(settings.util_ideal) ||
    days !== String(settings.statement_alert_days) ||
    inquiries !== String(settings.max_hard_inquiries);

  async function save() {
    const ceilingValue = parseWholePercent(ceiling);
    const idealValue = parseWholePercent(ideal);
    const dayValue = parseCount(days, 31);
    const inquiryValue = parseCount(inquiries);
    if (ceilingValue == null || idealValue == null || dayValue == null || inquiryValue == null) {
      setError('Enter whole numbers. Percentages are 0–100 and alert days are 0–31.');
      return;
    }
    setError(null);
    try {
      await update.mutateAsync({
        util_ceiling: ceilingValue / 100,
        util_ideal: idealValue / 100,
        statement_alert_days: dayValue,
        max_hard_inquiries: inquiryValue,
      });
      onSaved();
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <SectionFrame
      title="Credit targets"
      dirty={!locked && dirty}
      saving={update.isPending}
      onSave={() => void save()}
      error={error}>
      <TextField label="Utilisation ceiling (%)" value={ceiling} onChangeText={setCeiling} keyboardType="number-pad" editable={!locked} />
      <TextField label="Ideal utilisation (%)" value={ideal} onChangeText={setIdeal} keyboardType="number-pad" editable={!locked} />
      <TextField label="Statement alert days" value={days} onChangeText={setDays} keyboardType="number-pad" editable={!locked} />
      <TextField
        label="Max hard inquiries per 12 months"
        value={inquiries}
        onChangeText={setInquiries}
        keyboardType="number-pad"
        editable={!locked}
      />
    </SectionFrame>
  );
}
