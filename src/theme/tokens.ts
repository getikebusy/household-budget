export const colors = {
  ink: '#13211C',
  bg: '#F3F5F2',
  surface: '#FFFFFF',
  accent: '#1D6A50',
  investment: '#2F5D9E',
  emergency: '#B0731A',
  muted: '#5B6B64',
  border: '#DCE3DE',
  divider: '#EEF2EF',
  danger: '#B3261E',
  okBg: '#E3EFE9',
  okText: '#134836',
  badBg: '#FBE4E2',
  badText: '#8C1D18',
  warnBg: '#FDF4E7',
  warnText: '#5A2C06',
} as const;

export const radius = {
  input: 12,
  card: 20,
} as const;

export const spacing = {
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
} as const;

export const typography = {
  family: {
    400: 'PlusJakartaSans_400Regular',
    500: 'PlusJakartaSans_500Medium',
    600: 'PlusJakartaSans_600SemiBold',
    700: 'PlusJakartaSans_700Bold',
    800: 'PlusJakartaSans_800ExtraBold',
  },
  size: {
    12: 12,
    13: 13,
    14: 14,
    15: 15,
    17: 17,
    20: 20,
    26: 26,
    34: 34,
    44: 44,
  },
} as const;
