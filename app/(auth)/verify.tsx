import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { router, type Href } from 'expo-router';

import { AuthCard } from '../../src/components/auth-card';
import { CodeInput } from '../../src/components/code-input';
import { PrimaryButton } from '../../src/components/primary-button';
import { AuthFlowError, sendLoginCode, signOut, useSession, verifyLoginCode } from '../../src/data/auth';
import { queryClient } from '../../src/lib/query-client';
import { getPendingInviteToken } from '../../src/lib/pending-invite';
import { colors, spacing, typography } from '../../src/theme/tokens';

export default function VerifyScreen() {
  const { session } = useSession();
  const email = session?.user.email ?? 'your email';
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const submittedRef = useRef<string | null>(null);

  useEffect(() => {
    if (secondsLeft <= 0) {
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function submit(nextCode: string) {
    if (submitting || submittedRef.current === nextCode) {
      return;
    }
    submittedRef.current = nextCode;
    setSubmitting(true);
    setError(null);
    try {
      await verifyLoginCode(nextCode);
      await queryClient.invalidateQueries({ queryKey: ['session-verified'] });
      const inviteToken = await getPendingInviteToken();
      if (inviteToken) {
        router.replace(`/invite/${inviteToken}` as Href);
      }
    } catch (caught) {
      submittedRef.current = null;
      const payload = caught instanceof AuthFlowError ? caught.payload : undefined;
      if (payload?.error === 'expired') {
        setExpired(true);
        setError('That code has expired. Request a new one.');
      } else if (payload?.error === 'too_many_attempts') {
        setError('Too many attempts. Request a new code.');
      } else if (payload?.error === 'invalid') {
        if (typeof payload.attemptsLeft === 'number') {
          setAttemptsLeft(payload.attemptsLeft);
          setError(`That code is incorrect. ${payload.attemptsLeft} attempts left.`);
        } else {
          setError('That code is incorrect');
        }
      } else {
        setError('Could not verify that code. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function onCodeChange(next: string) {
    setCode(next);
    if (next.length === 6) {
      void submit(next);
    }
  }

  async function onResend() {
    if (secondsLeft > 0) {
      return;
    }
    setError(null);
    setExpired(false);
    setAttemptsLeft(null);
    setCode('');
    submittedRef.current = null;
    try {
      await sendLoginCode();
      setSecondsLeft(60);
    } catch {
      setError('Could not send a new code. Please try again.');
    }
  }

  return (
    <AuthCard title="Check your email" subtitle={`We've emailed a 6-digit code to ${email}.`}>
      <CodeInput value={code} onChange={onCodeChange} error={error ?? undefined} editable={!submitting} />
      {expired ? <Text style={styles.note}>This code has expired.</Text> : null}
      {attemptsLeft !== null && !error ? (
        <Text style={styles.note}>{attemptsLeft} attempts left.</Text>
      ) : null}
      <PrimaryButton
        title={secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Resend code'}
        disabled={secondsLeft > 0}
        onPress={() => void onResend()}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Use a different account"
        onPress={() => void signOut()}
        style={styles.other}>
        <Text style={styles.otherLabel}>Use a different account</Text>
      </Pressable>
    </AuthCard>
  );
}

const styles = StyleSheet.create({
  note: {
    fontFamily: typography.family[500],
    fontSize: typography.size[13],
    color: colors.muted,
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
