import { zodResolver } from '@hookform/resolvers/zod';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text } from 'react-native';
import { z } from 'zod';

import { AuthCard } from '../../src/components/auth-card';
import { PrimaryButton } from '../../src/components/primary-button';
import { TextField } from '../../src/components/text-field';
import { TextLink } from '../../src/components/text-link';
import { beginLoginVerification, cancelLoginVerification, sendLoginCode } from '../../src/data/auth';
import { emailSchema, friendlyAuthError, passwordSchema } from '../../src/lib/auth-schema';
import { supabase } from '../../src/lib/supabase';
import { colors, typography } from '../../src/theme/tokens';

const schema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords must match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export default function SignUpScreen() {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    beginLoginVerification();
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
    });
    if (error) {
      cancelLoginVerification();
      setFormError(friendlyAuthError(error));
      return;
    }
    try {
      const result = await sendLoginCode();
      if (result.alreadyVerified) {
        router.replace('/' as Href);
        return;
      }
    } catch (sendError) {
      const payload = (sendError as { payload?: { error?: string } }).payload;
      if (payload?.error !== 'wait' && payload?.error !== 'too_many') {
        setFormError(friendlyAuthError(sendError));
        return;
      }
    }
    router.replace('/verify' as Href);
  }

  return (
    <AuthCard title="Create account" subtitle="Household Budget">
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            value={value}
            onBlur={onBlur}
            onChangeText={onChange}
            error={errors.email?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Password"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            value={value}
            onBlur={onBlur}
            onChangeText={onChange}
            error={errors.password?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="confirmPassword"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Confirm password"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            value={value}
            onBlur={onBlur}
            onChangeText={onChange}
            error={errors.confirmPassword?.message}
          />
        )}
      />
      {formError ? <Text style={styles.error}>{formError}</Text> : null}
      <PrimaryButton title="Create account" loading={isSubmitting} onPress={handleSubmit(onSubmit)} />
      <TextLink href="/sign-in" label="Already have an account? Sign in" />
    </AuthCard>
  );
}

const styles = StyleSheet.create({
  error: {
    fontFamily: typography.family[500],
    fontSize: typography.size[13],
    color: colors.danger,
  },
});
