import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { AuthCard } from '../../src/components/auth-card';
import { PrimaryButton } from '../../src/components/primary-button';
import { TextField } from '../../src/components/text-field';
import { TextLink } from '../../src/components/text-link';
import { sendLoginCode } from '../../src/data/auth';
import { emailSchema, friendlyAuthError } from '../../src/lib/auth-schema';
import { supabase } from '../../src/lib/supabase';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

const schema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
});

type FormValues = z.infer<typeof schema>;

export default function SignInScreen() {
  const params = useLocalSearchParams<{ reset?: string }>();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) {
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
    <AuthCard title="Sign in" subtitle="Household Budget">
      {params.reset === '1' ? (
        <Text style={styles.success}>Your password was updated. Sign in with your new password.</Text>
      ) : null}
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
            autoComplete="password"
            textContentType="password"
            value={value}
            onBlur={onBlur}
            onChangeText={onChange}
            error={errors.password?.message}
          />
        )}
      />
      {formError ? <Text style={styles.error}>{formError}</Text> : null}
      <PrimaryButton title="Sign in" loading={isSubmitting} onPress={handleSubmit(onSubmit)} />
      <View style={styles.links}>
        <TextLink href="/sign-up" label="Create an account" />
        <TextLink href="/forgot-password" label="Forgot password" />
      </View>
    </AuthCard>
  );
}

const styles = StyleSheet.create({
  links: {
    gap: spacing[4],
  },
  error: {
    fontFamily: typography.family[500],
    fontSize: typography.size[13],
    color: colors.danger,
  },
  success: {
    fontFamily: typography.family[500],
    fontSize: typography.size[14],
    color: colors.okText,
    backgroundColor: colors.okBg,
    padding: spacing[12],
    borderRadius: radius.input,
    overflow: 'hidden',
  },
});
