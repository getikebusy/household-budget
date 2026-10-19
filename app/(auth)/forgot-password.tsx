import { zodResolver } from '@hookform/resolvers/zod';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text } from 'react-native';
import { z } from 'zod';

import { AuthCard } from '../../src/components/auth-card';
import { CodeInput } from '../../src/components/code-input';
import { PrimaryButton } from '../../src/components/primary-button';
import { TextField } from '../../src/components/text-field';
import { TextLink } from '../../src/components/text-link';
import { signOut } from '../../src/data/auth';
import { emailSchema, friendlyAuthError, passwordSchema } from '../../src/lib/auth-schema';
import { supabase } from '../../src/lib/supabase';
import { colors, typography } from '../../src/theme/tokens';

const emailFormSchema = z.object({ email: emailSchema });
const resetFormSchema = z
  .object({
    token: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords must match',
    path: ['confirmPassword'],
  });

type EmailForm = z.infer<typeof emailFormSchema>;
type ResetForm = z.infer<typeof resetFormSchema>;

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: { email: '' },
  });
  const resetForm = useForm<ResetForm>({
    resolver: zodResolver(resetFormSchema),
    defaultValues: { token: '', password: '', confirmPassword: '' },
  });

  async function onSendEmail(values: EmailForm) {
    setFormError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(values.email);
    if (error) {
      setFormError(friendlyAuthError(error));
      return;
    }
    setEmail(values.email);
    setStep(2);
  }

  async function onReset(values: ResetForm) {
    setFormError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: values.token,
      type: 'recovery',
    });
    if (verifyError) {
      setFormError(friendlyAuthError(verifyError));
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: values.password });
    if (updateError) {
      setFormError(friendlyAuthError(updateError));
      return;
    }
    await signOut();
    router.replace('/sign-in?reset=1' as Href);
  }

  if (step === 1) {
    return (
      <AuthCard title="Forgot password" subtitle="We'll email a 6-digit reset code.">
        <Controller
          control={emailForm.control}
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
              error={emailForm.formState.errors.email?.message}
            />
          )}
        />
        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        <PrimaryButton
          title="Send code"
          loading={emailForm.formState.isSubmitting}
          onPress={emailForm.handleSubmit(onSendEmail)}
        />
        <TextLink href="/sign-in" label="Back to sign in" />
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Set a new password" subtitle={`Enter the code sent to ${email}.`}>
      <Controller
        control={resetForm.control}
        name="token"
        render={({ field: { onChange, value } }) => (
          <CodeInput
            value={value}
            onChange={onChange}
            error={resetForm.formState.errors.token?.message}
          />
        )}
      />
      <Controller
        control={resetForm.control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="New password"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            value={value}
            onBlur={onBlur}
            onChangeText={onChange}
            error={resetForm.formState.errors.password?.message}
          />
        )}
      />
      <Controller
        control={resetForm.control}
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
            error={resetForm.formState.errors.confirmPassword?.message}
          />
        )}
      />
      {formError ? <Text style={styles.error}>{formError}</Text> : null}
      <PrimaryButton
        title="Update password"
        loading={resetForm.formState.isSubmitting}
        onPress={resetForm.handleSubmit(onReset)}
      />
      <TextLink href="/sign-in" label="Back to sign in" />
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
