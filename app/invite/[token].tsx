import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { AuthCard } from '../../src/components/auth-card';
import { LoadingScreen } from '../../src/components/loading-screen';
import { PrimaryButton } from '../../src/components/primary-button';
import { TextField } from '../../src/components/text-field';
import { TextLink } from '../../src/components/text-link';
import { AuthFlowError, useSession, useSessionVerified } from '../../src/data/auth';
import { acceptInvite } from '../../src/data/household';
import { clearPendingInviteToken, savePendingInviteToken } from '../../src/lib/pending-invite';
import { colors, spacing, typography } from '../../src/theme/tokens';

const schema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Enter a display name')
    .max(30, 'Use 30 characters or fewer'),
  takeHomeCad: z
    .string()
    .trim()
    .min(1, 'Enter an amount')
    .refine((value) => Number.isFinite(Number(value.replace(/,/g, ''))), 'Enter a number')
    .transform((value) => Number(value.replace(/,/g, '')))
    .refine((value) => value >= 0, 'Must be 0 or more'),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

function inviteErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const lowered = message.toLowerCase();
  if (lowered.includes('invite invalid') || lowered.includes('expired')) {
    return 'This invite is invalid or has expired.';
  }
  if (lowered.includes('different email')) {
    return 'This invite was sent to a different email.';
  }
  if (lowered.includes('household is full')) {
    return 'This household is full.';
  }
  if (lowered.includes('already in a household')) {
    return 'You already belong to a household.';
  }
  if (error instanceof AuthFlowError) {
    return error.message;
  }
  return message || 'Could not accept this invite. Please try again.';
}

export default function InviteScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = useMemo(() => {
    const value = params.token;
    return Array.isArray(value) ? value[0] : value;
  }, [params.token]);
  const { session, isLoading: sessionLoading } = useSession();
  const verifiedQuery = useSessionVerified();
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      void savePendingInviteToken(token);
    }
  }, [token]);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: '', takeHomeCad: '' },
  });

  async function onSubmit(values: FormOutput) {
    if (!token) {
      setFormError('This invite is invalid or has expired.');
      return;
    }
    setFormError(null);
    try {
      await acceptInvite({
        token,
        displayName: values.displayName,
        takeHomeCad: values.takeHomeCad,
      });
      await clearPendingInviteToken();
      router.replace('/' as Href);
    } catch (error) {
      setFormError(inviteErrorMessage(error));
    }
  }

  if (!token) {
    return (
      <AuthCard title="Household invite">
        <Text style={styles.body}>This invite is invalid or has expired.</Text>
        <TextLink href="/sign-in" label="Back to sign in" />
      </AuthCard>
    );
  }

  if (sessionLoading || (session && verifiedQuery.isPending)) {
    return <LoadingScreen />;
  }

  if (!session) {
    return (
      <AuthCard title="You're invited" subtitle="Household Budget">
        <Text style={styles.body}>
          Create an account or sign in with the email this invite was sent to.
        </Text>
        <View style={styles.actions}>
          <PrimaryButton title="Create an account" onPress={() => router.push('/sign-up' as Href)} />
          <PrimaryButton title="Sign in" onPress={() => router.push('/sign-in' as Href)} />
        </View>
      </AuthCard>
    );
  }

  if (verifiedQuery.data !== true) {
    return <LoadingScreen />;
  }

  return (
    <AuthCard title="Join the household" subtitle="Your take-home pay is private to you.">
      <Controller
        control={control}
        name="displayName"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Display name"
            autoCapitalize="words"
            textContentType="nickname"
            placeholder="Wifey"
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
      {formError ? <Text style={styles.error}>{formError}</Text> : null}
      <PrimaryButton
        title="Join household"
        loading={isSubmitting}
        onPress={handleSubmit(onSubmit)}
      />
    </AuthCard>
  );
}

const styles = StyleSheet.create({
  body: {
    fontFamily: typography.family[400],
    fontSize: typography.size[15],
    color: colors.muted,
  },
  actions: {
    gap: spacing[12],
  },
  error: {
    fontFamily: typography.family[500],
    fontSize: typography.size[13],
    color: colors.danger,
  },
});
