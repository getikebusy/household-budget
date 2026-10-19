import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useUpdateSettings, type HouseholdSettings } from '../../data/settings';
import { colors, typography } from '../../theme/tokens';
import { Chip } from '../chip';
import { TextField } from '../text-field';
import { errorText, fractionToWhole, parseWholePercent } from './form';
import { SectionFrame } from './section-frame';
import { useServerState } from './use-server-state';

type BudgetRuleSectionProps = {
  settings: HouseholdSettings;
  locked: boolean;
  onSaved: () => void;
};

export function BudgetRuleSection({ settings, locked, onSaved }: BudgetRuleSectionProps) {
  const update = useUpdateSettings();
  const [needs, setNeeds] = useServerState(fractionToWhole(settings.target_needs));
  const [investment, setInvestment] = useServerState(fractionToWhole(settings.target_investment));
  const [emergency, setEmergency] = useServerState(fractionToWhole(settings.target_emergency));
  const [error, setError] = useState<string | null>(null);
  const needsValue = parseWholePercent(needs);
  const investmentValue = parseWholePercent(investment);
  const emergencyValue = parseWholePercent(emergency);
  const sum = (needsValue ?? NaN) + (investmentValue ?? NaN) + (emergencyValue ?? NaN);
  const totalsOk = sum === 100;
  const dirty =
    needs !== fractionToWhole(settings.target_needs) ||
    investment !== fractionToWhole(settings.target_investment) ||
    emergency !== fractionToWhole(settings.target_emergency);

  async function save() {
    if (needsValue == null || investmentValue == null || emergencyValue == null || !totalsOk) {
      setError('The three percentages must be whole numbers that total 100');
      return;
    }
    setError(null);
    try {
      await update.mutateAsync({
        target_needs: needsValue / 100,
        target_investment: investmentValue / 100,
        target_emergency: emergencyValue / 100,
      });
      onSaved();
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <SectionFrame
      title="Budget rule"
      dirty={!locked && dirty}
      saving={update.isPending}
      saveDisabled={!totalsOk}
      onSave={() => void save()}
      error={error}>
      <TextField label="Needs & Personal ceiling (%)" value={needs} onChangeText={setNeeds} keyboardType="number-pad" editable={!locked} />
      <TextField label="Investment floor (%)" value={investment} onChangeText={setInvestment} keyboardType="number-pad" editable={!locked} />
      <TextField label="Emergency floor (%)" value={emergency} onChangeText={setEmergency} keyboardType="number-pad" editable={!locked} />
      <Chip tone={totalsOk ? 'ok' : 'bad'} label="Totals 100%" />
      {totalsOk ? null : <Text style={styles.hint}>Current total is {Number.isFinite(sum) ? sum : 0}%.</Text>}
    </SectionFrame>
  );
}

const styles = StyleSheet.create({
  hint: {
    fontFamily: typography.family[400],
    fontSize: typography.size[13],
    color: colors.muted,
  },
});
