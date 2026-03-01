import { useAuth } from '@/lib/auth-context';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import { router } from 'expo-router';
import { Eye, EyeOff, Lock, Mail, Warehouse } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const { signIn, hasPIN, hasBiometric, authenticateWithBiometric } = useAuth();
  const { colors, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);
    if (error) {
      Alert.alert('Sign In Failed', error.message || 'Invalid email or password.');
    } else {
      router.replace('/(tabs)/home');
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          className="flex-1">
          <View className="flex-1 justify-center px-6 py-12">
            {/* Logo & Title */}
            <View className="mb-12 items-center">
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 20,
                  backgroundColor: colors.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                  shadowColor: colors.accent,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.4,
                  shadowRadius: 16,
                }}>
                <Warehouse color={colors.accentOnAccent} size={42} />
              </View>
              <Text
                className="text-3xl font-bold tracking-tight"
                style={{ fontWeight: '800', color: colors.textPrimary }}>
                Imperial Inventory
              </Text>
              <Text className="mt-2 text-center text-sm" style={{ color: colors.textSecondary }}>
                Warehouse management for your team
              </Text>
            </View>

            {/* Form */}
            <View className="gap-4">
              {/* Email */}
              <View>
                <Text className="mb-2 text-sm font-medium" style={{ color: colors.textSecondary }}>
                  Email Address
                </Text>
                <View
                  className="flex-row items-center rounded-xl px-4 py-3.5"
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                  <Mail color={colors.textSecondary} size={18} />
                  <TextInput
                    className="ml-3 flex-1 text-base"
                    style={{ color: colors.textPrimary }}
                    placeholder="you@company.com"
                    placeholderTextColor={colors.textSecondary}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Password */}
              <View>
                <Text className="mb-2 text-sm font-medium" style={{ color: colors.textSecondary }}>
                  Password
                </Text>
                <View
                  className="flex-row items-center rounded-xl px-4 py-3.5"
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                  <Lock color={colors.textSecondary} size={18} />
                  <TextInput
                    className="ml-3 flex-1 text-base"
                    style={{ color: colors.textPrimary }}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textSecondary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    {showPassword ? (
                      <EyeOff color={colors.textSecondary} size={18} />
                    ) : (
                      <Eye color={colors.textSecondary} size={18} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Sign In Button */}
              <TouchableOpacity
                onPress={handleSignIn}
                disabled={loading}
                className="mt-2 items-center justify-center rounded-xl py-4"
                style={{ backgroundColor: colors.accent }}>
                {loading ? (
                  <ActivityIndicator color={colors.accentOnAccent} />
                ) : (
                  <Text className="text-base font-bold" style={{ color: colors.accentOnAccent }}>
                    Sign In
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Footer note */}
            <Text
              className="mt-8 text-center text-xs leading-5"
              style={{ color: colors.textSecondary }}>
              Access is invite-only.{'\n'}Contact your administrator to create an account.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
