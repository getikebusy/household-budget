import { zodResolver } from '@hookform/resolvers/zod';
import { Redirect, router, type Href } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text } from 'react-native';
import { z } from 'zod';

import { AuthCard } from '../../src/components/auth-card';
import { PrimaryButton } from '../../src/components/primary-button';
import { TextField } from '../../src/components/text-field';
import { createHousehold } from '../../src/data/household';
import { usePendingInviteToken } from '../../src/lib/pending-invite';
import { colors, typography } from '../../src/theme/tokens';

const cadAmount = z
  .string()
  .trim()
  .min(1, 'Enter an amount')
  .refine((value) => Number.isFinite(Number(value.replace(/,/g, ''))), 'Enter a number')
  .transform((value) => Number(value.replace(/,/g, '')))
  .refine((value) => value >= 0, 'Must be 0 or more');

const schema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Enter a display name')
    .max(30, 'Use 30 characters or fewer'),
  takeHomeCad: cadAmount,
  rentTotalCad: cadAmount,
  householdName: z.string().trim().max(80, 'Use 80 characters or fewer'),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

export default function CreateHouseholdScreen() {
  const pendingInvite = usePendingInviteToken();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: '',
      takeHomeCad: '',
      rentTotalCad: '',
      householdName: 'Our household',
    },
  });

  async function onSubmit(values: FormOutput) {
    setFormError(null);
    try {
      await createHousehold({
        displayName: values.displayName,
        takeHomeCad: values.takeHomeCad,
        rentTotalCad: values.rentTotalCad,
        householdName: values.householdName || 'Our household',
      });
      router.replace('/' as Href);
    } catch {
      setFormError('Could not create the household. Please try again.');
    }
  }

  if (pendingInvite.isLoading) {
    return null;
  }

  if (pendingInvite.token) {
    return <Redirect href={`/invite/${pendingInvite.token}` as Href} />;
  }

  return (
    <AuthCard title="Create your household" subtitle="Set up how you share money together.">
      <Text style={styles.note}>You'll be the primary account and manage household settings.</Text>
      <Text style={styles.note}>Your take-home pay is private to you.</Text>
      <Controller
        control={control}
        name="displayName"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Display name"
            autoCapitalize="words"
            textContentType="nickname"
            placeholder="Odogwu"
            value={value}
            onBlur={onBlur}
            onChangeText={onChange}
            error={errors.displayName?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="takeHomeCad"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Monthly take-home pay (CAD)"
            keyboardType="decimal-pad"
            placeholder="0"
            value={value}
            onBlur={onBlur}
            onChangeText={onChange}
            error={errors.takeHomeCad?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="rentTotalCad"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Total monthly rent (CAD)"
            keyboardType="decimal-pad"
            placeholder="0"
            value={value}
            onBlur={onBlur}
            onChangeText={onChange}
            error={errors.rentTotalCad?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="householdName"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Household name (optional)"
            placeholder="Our household"
            value={value}
            onBlur={onBlur}
            onChangeText={onChange}
            error={errors.householdName?.message}
          />
        )}
      />
      {formError ? <Text style={styles.error}>{formError}</Text> : null}
      <PrimaryButton
        title="Create household"
        loading={isSubmitting}
        onPress={handleSubmit(onSubmit)}
      />
    </AuthCard>
  );
}

const styles = StyleSheet.create({
  note: {
    fontFamily: typography.family[400],
    fontSize: typography.size[14],
    color: colors.muted,
  },
  error: {
    fontFamily: typography.family[500],
    fontSize: typography.size[13],
    color: colors.danger,
  },
});
