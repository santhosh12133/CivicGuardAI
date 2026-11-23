import { MD3LightTheme } from 'react-native-paper';
import { DefaultTheme as NavigationDefaultTheme } from '@react-navigation/native';

// One set of design tokens for the whole app. The blue is the app icon's; the
// status colours are the same as in the admin dashboard, so staff and citizens
// see the same colour for the same state.
export const colors = {
  brand: '#2563eb',
  brandPressed: '#1d4ed8',
  brandSoft: '#eef3fe',
  brandLine: '#c7d7fb',

  ink: '#0f172a',
  ink2: '#334155',
  muted: '#64748b',
  faint: '#94a3b8',

  background: '#f6f7f9',
  surface: '#ffffff',
  surfaceAlt: '#f1f4f8',
  line: '#e5e7eb',
  lineStrong: '#d1d5db',

  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  dangerLine: '#fecaca',
  success: '#15803d',
  successSoft: '#f0fdf4',
  successLine: '#bbf7d0',
  info: '#1d4ed8',
  infoSoft: '#eff6ff',
  infoLine: '#bfdbfe',
  warning: '#b45309',
  warningSoft: '#fffbeb',
  warningLine: '#fde68a',
};

export const STATUS = {
  Open: { label: 'Open', color: '#d97706', soft: '#fef3c7', text: '#92400e' },
  'In Progress': {
    label: 'In progress',
    color: '#0284c7',
    soft: '#e0f2fe',
    text: '#075985',
  },
  Resolved: {
    label: 'Resolved',
    color: '#16a34a',
    soft: '#dcfce7',
    text: '#166534',
  },
};
export const statusInfo = (status) => STATUS[status] || STATUS.Open;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };

// Roboto (the Android system face) on a fixed scale.
export const type = {
  display: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: colors.ink,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: colors.ink,
  },
  heading: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
    color: colors.ink,
  },
  body: { fontSize: 15, lineHeight: 22, color: colors.ink2 },
  bodyStrong: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: colors.ink,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: colors.ink2,
  },
  caption: { fontSize: 13, lineHeight: 18, color: colors.muted },
  micro: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors.muted,
  },
};

// react-native-paper: replace Material's default purple with the CivicFix palette.
export const paperTheme = {
  ...MD3LightTheme,
  roundness: 3,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.brand,
    onPrimary: '#ffffff',
    primaryContainer: colors.brandSoft,
    onPrimaryContainer: colors.brandPressed,
    secondary: colors.ink2,
    secondaryContainer: colors.brandSoft,
    onSecondaryContainer: colors.brandPressed,
    background: colors.background,
    surface: colors.surface,
    onSurface: colors.ink,
    surfaceVariant: colors.surfaceAlt,
    onSurfaceVariant: colors.muted,
    outline: colors.lineStrong,
    outlineVariant: colors.line,
    error: colors.danger,
    inverseSurface: colors.ink,
    inverseOnSurface: '#ffffff',
    inversePrimary: '#93b4f8',
    elevation: {
      level0: 'transparent',
      level1: colors.surface,
      level2: colors.surface,
      level3: colors.surface,
      level4: colors.surface,
      level5: colors.surface,
    },
  },
};

export const navigationTheme = {
  ...NavigationDefaultTheme,
  colors: {
    ...NavigationDefaultTheme.colors,
    primary: colors.brand,
    background: colors.background,
    card: colors.surface,
    text: colors.ink,
    border: colors.line,
  },
};
