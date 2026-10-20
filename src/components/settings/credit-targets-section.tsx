import { useState } from 'react';

import { useUpdateSettings, type HouseholdSettings } from '../../data/settings';
import { TextField } from '../text-field';
import { errorText, fractionToWhole } from './form';
import { SectionFrame } from './section-frame';
import { useServerState } from './use-server-state';

type CreditTargetsSectionProps = {
  settings: HouseholdSettings;
  locked: boolean;
  onSaved: () => void;
};

function wholeInRange(text: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(text.trim())) {
    return null;
  }
  const value = Number(text);
  if (value < min || value > max) {
    return null;
  }
  return value;
}

function digits(text: string, maxLength: number) {
  return text.replace(/\D/g, '').slice(0, maxLength);
}

const CEILING_TIP =
  'The highest share of your credit limit you want to use. Utilisation is your balance divided by your limit. Above 30% can lower your score, so the app warns you when a card goes over this.';
const IDEAL_TIP =
  'The level to aim for on statement day. Keeping reported balances under 10% of your limit gives the best boost to your score. Must be lower than the ceiling.';
const ALERT_DAYS_TIP =
  "How many days before each card's statement day you get a reminder. That gives you time to pay the balance down before it's reported to Equifax and TransUnion. Set 0 to turn reminders off.";
const INQUIRIES_TIP =
  'The most credit applications you plan to make in a year. Each application for a card, loan or line usually triggers a hard inquiry, which can lower your score for a while; too many in a short time looks risky to lenders. The app warns you when you reach this number.';
const PERCENT_ERROR = 'Enter a whole number from 1 to 100';

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
  const ceilingValue = wholeInRange(ceiling, 1, 100);
  const idealValue = wholeInRange(ideal, 1, 100);
  const dayValue = wholeInRange(days, 0, 31);
  const inquiryValue = wholeInRange(inquiries, 0, 10);
  const idealAboveCeiling = ceilingValue != null && idealValue != null && idealValue >= ceilingValue;
  const ceilingError = locked || ceilingValue != null ? undefined : PERCENT_ERROR;
  const idealError = locked
    ? undefined
    : idealValue == null
      ? PERCENT_ERROR
      : idealAboveCeiling
        ? 'Must be lower than the utilisation ceiling'
        : undefined;
  const daysError = locked || dayValue != null ? undefined : 'Enter a whole number from 0 to 31';
  const inquiriesError = locked || inquiryValue != null ? undefined : 'Enter a whole number from 0 to 10';
  const invalid = ceilingError != null || idealError != null || daysError != null || inquiriesError != null;

  async function save() {
    if (locked || ceilingValue == null || idealValue == null || dayValue == null || inquiryValue == null || idealAboveCeiling) {
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
      saveDisabled={invalid}
      onSave={() => void save()}
      error={error}>
      <TextField
        label="Utilisation ceiling (%)"
        value={ceiling}
        onChangeText={(value) => setCeiling(digits(value, 3))}
        keyboardType="number-pad"
        inputMode="numeric"
        editable={!locked}
        info={CEILING_TIP}
        error={ceilingError}
      />
      <TextField
        label="Ideal utilisation (%)"
        value={ideal}
        onChangeText={(value) => setIdeal(digits(value, 3))}
        keyboardType="number-pad"
        inputMode="numeric"
        editable={!locked}
        info={IDEAL_TIP}
        error={idealError}
      />
      <TextField
        label="Statement alert days"
        value={days}
        onChangeText={(value) => setDays(digits(value, 2))}
        keyboardType="number-pad"
        inputMode="numeric"
        editable={!locked}
        info={ALERT_DAYS_TIP}
        error={daysError}
      />
      <TextField
        label="Max hard inquiries per 12 months"
        value={inquiries}
        onChangeText={(value) => setInquiries(digits(value, 2))}
        keyboardType="number-pad"
        inputMode="numeric"
        editable={!locked}
        info={INQUIRIES_TIP}
        error={inquiriesError}
      />
    </SectionFrame>
  );
}
