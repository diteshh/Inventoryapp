import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import { type ThemeColors, DARK_COLORS, LIGHT_COLORS } from './theme-context';

// Legacy COLORS export — kept for backward compat during migration
export const COLORS = {
  navy: '#1B2838',
  navyLight: '#222D3D',
  navyCard: '#243044',
  teal: '#00BFA6',
  tealDark: '#009B86',
  white: '#FFFFFF',
  textPrimary: '#F0F4FF',
  textSecondary: '#8899B4',
  border: '#2D3F55',
  destructive: '#EF4444',
  warning: '#F59E0B',
  success: '#22C55E',
};

export function buildNavTheme(colors: ThemeColors, isDark: boolean): Theme {
  const base = isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      background: colors.background,
      border: colors.border,
      card: colors.surface,
      notification: colors.destructive,
      primary: colors.accent,
      text: colors.textPrimary,
    },
  };
}

// Legacy NAV_THEME — still used if ThemeProvider not yet wired
export const NAV_THEME: Record<'light' | 'dark', Theme> = {
  light: buildNavTheme(LIGHT_COLORS, false),
  dark: buildNavTheme(DARK_COLORS, true),
};
