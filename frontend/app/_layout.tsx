import '@/global.css';
import 'react-native-url-polyfill/auto';

import { buildNavTheme } from '@/lib/theme';
import { ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, Text, TextInput } from 'react-native';
import { AuthProvider } from '@/lib/auth-context';
import { TeamProvider } from '@/lib/team-context';
import { ThemeProvider, useTheme } from '@/lib/theme-context';
import { ErrorBoundary } from './error-boundary';

// Set Gill Sans as the default font globally
const FONT_FAMILY = Platform.OS === 'ios' ? 'Gill Sans' : 'sans-serif';
const defaultTextStyle = { fontFamily: FONT_FAMILY };
const origTextRender = (Text as any).render;
(Text as any).render = function (...args: any[]) {
  const origin = origTextRender.call(this, ...args);
  return {
    ...origin,
    props: {
      ...origin.props,
      style: [defaultTextStyle, origin.props.style],
    },
  };
};
const origInputRender = (TextInput as any).render;
(TextInput as any).render = function (...args: any[]) {
  const origin = origInputRender.call(this, ...args);
  return {
    ...origin,
    props: {
      ...origin.props,
      style: [defaultTextStyle, origin.props.style],
    },
  };
};

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
          <TeamProvider>
            <AppInner />
          </TeamProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
