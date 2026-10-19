import { zodResolver } from '@hookform/resolvers/zod';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text } from 'react-native';
import { z } from 'zod';

import { AuthCard } from '../../src/components/auth-card';
import { CodeInput } from '../../src/components/code-input';
import { PrimaryButton } from '../../src/components/primary-button';
import { TextField } from '../../src/components/text-field';
import { TextLink } from '../../src/components/text-link';
import {
  abandonPasswordRecovery,
  completePasswordReset,
  requestPasswordReset,
} from '../../src/data/auth';
import { emailSchema, passwordSchema } from '../../src/lib/auth-schema';
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
  const [secondsLeft, setSecondsLeft] = useState(0);

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: { email: '' },
  });
  const resetForm = useForm<ResetForm>({
    resolver: zodResolver(resetFormSchema),
    defaultValues: { token: '', password: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (secondsLeft <= 0) {
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function onSendEmail(values: EmailForm) {
    setFormError(null);
    try {
      await requestPasswordReset(values.email);
    } catch {
      // Always continue so we do not reveal whether the email is registered.
    }
    setEmail(values.email);
    setSecondsLeft(60);
    setStep(2);
  }

  async function onResend() {
    if (secondsLeft > 0) {
      return;
    }
    setFormError(null);
    try {
      await requestPasswordReset(email);
    } catch {
      // Same as the first send: do not reveal whether the account exists.
    }
    setSecondsLeft(60);
  }

  async function onReset(values: ResetForm) {
    setFormError(null);
    try {
      await completePasswordReset({
        email,
        token: values.token,
        password: values.password,
      });
      router.replace('/sign-in?reset=1' as Href);
    } catch (error) {
      if (error instanceof Error && error.message === 'That code is invalid or has expired.') {
        setFormError(error.message);
        return;
      }
      setFormError('Could not update your password. Please try again.');
    }
  }

  async function onBackToSignIn() {
    await abandonPasswordRecovery();
    router.replace('/sign-in' as Href);
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
    <AuthCard title="Enter the code" subtitle={`We've emailed a 6-digit code to ${email}.`}>
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
      <PrimaryButton
        title={secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Resend code'}
        disabled={secondsLeft > 0}
        onPress={() => void onResend()}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to sign in"
        onPress={() => void onBackToSignIn()}
        style={styles.other}>
        <Text style={styles.otherLabel}>Back to sign in</Text>
      </Pressable>
    </AuthCard>
  );
}

const styles = StyleSheet.create({
  error: {
    fontFamily: typography.family[500],
    fontSize: typography.size[13],
    color: colors.danger,
  },
  other: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otherLabel: {
    fontFamily: typography.family[600],
    fontSize: typography.size[14],
    color: colors.accent,
  },
});
