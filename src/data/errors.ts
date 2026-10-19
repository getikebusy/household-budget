const PRIMARY_ONLY = 'Only the primary account can change this';

type PostgrestLike = {
  message?: string;
  code?: string;
};

export function primaryOnlyError(error: PostgrestLike): Error {
  const message = error.message ?? '';
  const denied =
    error.code === '42501' ||
    /row-level security|permission denied|not allowed/i.test(message);
  if (denied) {
    return new Error(PRIMARY_ONLY);
  }
  if (error.code === '23505') {
    return new Error('That name is already used');
  }
  return new Error(message || 'Request failed');
}

export function primaryOnlyIfEmpty(): Error {
  return new Error(PRIMARY_ONLY);
}
