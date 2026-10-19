import { z } from 'zod';

import { passwordSchemaMessage } from '../data/auth';

export const emailSchema = z.string().trim().email('Enter a valid email address');

export const passwordSchema = z
  .string()
  .min(10, passwordSchemaMessage)
  .regex(/[A-Za-z]/, passwordSchemaMessage)
  .regex(/[0-9]/, passwordSchemaMessage);

export function friendlyAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const lowered = message.toLowerCase();
  if (lowered.includes('invalid login') || lowered.includes('invalid credentials')) {
    return 'Email or password is incorrect';
  }
  if (lowered.includes('already registered') || lowered.includes('already been registered')) {
    return 'An account with this email already exists';
  }
  if (lowered.includes('wait')) {
    return 'Please wait before requesting another code';
  }
  if (lowered.includes('too_many_attempts')) {
    return 'Too many attempts. Request a new code.';
  }
  if (lowered.includes('too_many')) {
    return 'Too many codes requested. Try again later.';
  }
  if (lowered.includes('expired')) {
    return 'That code has expired. Request a new one.';
  }
  if (lowered.includes('invalid')) {
    return 'That code is incorrect';
  }
  return message || 'Something went wrong. Please try again.';
}
