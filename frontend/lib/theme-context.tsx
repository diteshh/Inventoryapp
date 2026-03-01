import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ThemeColors {
  // Surfaces
  background: string;
  surface: string;
  surfaceElevated: string;

  // Borders
  border: string;
  borderLight: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;

  // Brand
  accent: string;
  accentMuted: string;
  accentOnAccent: string;

  // Semantic
  success: string;
  successMuted: string;
  warning: string;
  warningMuted: string;
  destructive: string;
  destructiveMuted: string;

  // Pick list status
  statusDraft: string;
  statusReady: string;
  statusInProgress: string;
  statusPartial: string;
  statusComplete: string;

  // Utility
  overlay: string;
  skeleton: string;
  tabBarBackground: string;
  tabBarBorder: string;
  statusBarStyle: 'light-content' | 'dark-content';
  statusBarBg: string;
}

export const DARK_COLORS: ThemeColors = {
  background: '#0D1117',
  surface: '#161B22',
  surfaceElevated: '#1C2333',
  border: '#30363D',
  borderLight: '#21262D',
  textPrimary: '#E6EDF3',
  textSecondary: '#7D8590',
  textTertiary: '#484F58',
  accent: '#00BFA6',
  accentMuted: 'rgba(0,191,166,0.15)',
  accentOnAccent: '#0D1117',
  success: '#3FB950',
  successMuted: 'rgba(63,185,80,0.15)',
  warning: '#D29922',
  warningMuted: 'rgba(210,153,34,0.15)',
  destructive: '#F85149',
  destructiveMuted: 'rgba(248,81,73,0.15)',
  statusDraft: '#7D8590',
  statusReady: '#58A6FF',
  statusInProgress: '#D29922',
  statusPartial: '#F0883E',
  statusComplete: '#3FB950',
  overlay: 'rgba(0,0,0,0.65)',
  skeleton: '#21262D',
  tabBarBackground: '#161B22',
  tabBarBorder: '#30363D',
  statusBarStyle: 'light-content',
  statusBarBg: '#0D1117',
};

export const LIGHT_COLORS: ThemeColors = {
  background: '#FFFFFF',
  surface: '#F6F8FA',
  surfaceElevated: '#FFFFFF',
  border: '#D0D7DE',
  borderLight: '#E8ECF0',
  textPrimary: '#1F2328',
  textSecondary: '#656D76',
  textTertiary: '#8B949E',
  accent: '#009985',
  accentMuted: 'rgba(0,153,133,0.08)',
  accentOnAccent: '#FFFFFF',
  success: '#1A7F37',
  successMuted: 'rgba(26,127,55,0.10)',
  warning: '#9A6700',
  warningMuted: 'rgba(154,103,0,0.10)',
  destructive: '#CF222E',
  destructiveMuted: 'rgba(207,34,46,0.10)',
  statusDraft: '#656D76',
  statusReady: '#0969DA',
  statusInProgress: '#9A6700',
  statusPartial: '#BC4C00',
  statusComplete: '#1A7F37',
  overlay: 'rgba(0,0,0,0.40)',
  skeleton: '#E8ECF0',
  tabBarBackground: '#FFFFFF',
  tabBarBorder: '#D0D7DE',
  statusBarStyle: 'dark-content',
  statusBarBg: '#FFFFFF',
};

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  colors: ThemeColors;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = '@theme_mode';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setModeState(saved);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(STORAGE_KEY, newMode).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const isDark = mode === 'dark' || (mode === 'system' && (systemScheme ?? 'dark') === 'dark');
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  const value = useMemo(
    () => ({ colors, isDark, mode, setMode, toggleTheme }),
    [colors, isDark, mode, setMode, toggleTheme]
  );

  if (!loaded) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

// Shadow helpers
export function getCardShadow(isDark: boolean) {
  if (isDark) return {};
  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  };
}

export function getElevatedShadow(isDark: boolean) {
  if (isDark) return {};
  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  };
}
