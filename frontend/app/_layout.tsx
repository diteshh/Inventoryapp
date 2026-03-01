import '@/global.css';
import 'react-native-url-polyfill/auto';

import { buildNavTheme } from '@/lib/theme';
import { ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider, useTheme } from '@/lib/theme-context';
import { ErrorBoundary } from './error-boundary';

function AppInner() {
  const { colors, isDark } = useTheme();
  const navTheme = buildNavTheme(colors, isDark);

  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.statusBarBg} />
      <Stack screenOptions={{ headerShown: false }} />
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AppInner />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
