import '@/global.css';
import 'react-native-url-polyfill/auto';

import { NAV_THEME } from '@/lib/theme';
import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/lib/auth-context';
import { ErrorBoundary } from './error-boundary';

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider value={NAV_THEME.dark}>
          <StatusBar style="light" backgroundColor="#1B2838" />
          <Stack screenOptions={{ headerShown: false }} />
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
