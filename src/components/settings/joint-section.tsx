import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import type { HouseholdMember } from '../../data/household';
import { useSetJointShare, useUpdateSettings, type HouseholdSettings } from '../../data/settings';
import { formatCAD } from '../../lib/money';
import { colors, typography } from '../../theme/tokens';
import { MoneyField } from '../money-field';
import { ShareSlider } from '../share-slider';
import { errorText, moneyToInput, parseMoney } from './form';
import { SectionFrame } from './section-frame';
import { useServerState } from './use-server-state';

type JointSectionProps = {
  settings: HouseholdSettings;
  members: HouseholdMember[];
  locked: boolean;
  onSaved: () => void;
};

export function JointSection({ settings, members, locked, onSaved }: JointSectionProps) {
  const primary = members.find((member) => member.role === 'primary');
  const partner = members.find((member) => member.role === 'partner');
  const primaryName = primary?.display_name ?? 'Primary';
  const partnerName = partner?.display_name ?? 'Partner';
  const serverShare = Math.round((primary?.joint_share ?? 0.5) * 100);
  const serverRent = Math.round(settings.rent_total_cad * 100) / 100;
  const [share, setShare] = useServerState(serverShare);
  const [rent, setRent] = useServerState(moneyToInput(settings.rent_total_cad));
  const [error, setError] = useState<string | null>(null);
  const saveShare = useSetJointShare();
  const update = useUpdateSettings();
  const rentAmount = parseMoney(rent);
  const dirty = share !== serverShare || rentAmount !== serverRent;

  async function save() {
    if (rentAmount == null) {
      setError('Enter the total monthly rent');
      return;
    }
    setError(null);
    try {
      if (share !== serverShare) {
        await saveShare.mutateAsync(share / 100);
      }
      if (rentAmount !== serverRent) {
        await update.mutateAsync({ rent_total_cad: rentAmount });
      }
      onSaved();
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  const rentValue = rentAmount ?? 0;
  const primaryPays = formatCAD(rentValue * (share / 100));
  const partnerPays = formatCAD(rentValue * ((100 - share) / 100));

  return (
    <SectionFrame
      title="Joint costs"
      dirty={!locked && dirty}
      saving={saveShare.isPending || update.isPending}
      onSave={() => void save()}
      error={error}>
      <ShareSlider
        value={share}
        onChange={setShare}
        primaryName={primaryName}
        partnerName={partnerName}
        disabled={locked}
      />
      <MoneyField label="Total monthly rent" prefix="$" value={rent} onChangeText={setRent} editable={!locked} />
      <Text style={styles.split}>
        {primaryName} pays {primaryPays} · {partnerName} pays {partnerPays}
      </Text>
    </SectionFrame>
  );
}

const styles = StyleSheet.create({
  split: {
    fontFamily: typography.family[500],
    fontSize: typography.size[14],
    color: colors.ink,
  },
});
