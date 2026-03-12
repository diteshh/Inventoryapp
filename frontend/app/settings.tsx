import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { ThemeColors } from '@/lib/theme-context';
import { notificationSuccess } from '@/lib/haptics';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Building2,
  Edit2,
  MapPin,
  Save,
  User,
} from 'lucide-react-native';
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

export default function SettingsScreen() {
  const { colors, isDark } = useTheme();
  const { profile, updateProfile, user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [businessName, setBusinessName] = useState(profile?.business_name ?? '');
  const [businessAddress, setBusinessAddress] = useState(profile?.business_address ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await updateProfile({
      full_name: fullName.trim() || null,
      business_name: businessName.trim() || null,
      business_address: businessAddress.trim() || null,
    });
    notificationSuccess();
    setSaving(false);
    setEditing(false);
    Alert.alert('Saved', 'Profile updated successfully.');
  };

  const startEdit = () => {
    setFullName(profile?.full_name ?? '');
    setBusinessName(profile?.business_name ?? '');
    setBusinessAddress(profile?.business_address ?? '');
    setEditing(true);
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="flex-row items-center justify-between px-5 py-3">
        <TouchableOpacity onPress={() => router.back()} className="rounded-xl p-2" style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
          <ArrowLeft color={colors.textPrimary} size={20} />
        </TouchableOpacity>
        <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>User Profile</Text>
        {editing ? (
          <TouchableOpacity
            onPress={save}
            disabled={saving}
            className="flex-row items-center gap-1.5 rounded-xl px-3 py-2"
            style={{ backgroundColor: colors.accent }}>
            {saving ? (
              <ActivityIndicator color={colors.accentOnAccent} size="small" />
            ) : (
              <>
                <Save color={colors.accentOnAccent} size={16} />
                <Text className="text-sm font-bold" style={{ color: colors.accentOnAccent }}>Save</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={startEdit}
            className="flex-row items-center gap-1.5 rounded-xl px-3 py-2"
            style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
            <Edit2 color={colors.accent} size={16} />
            <Text className="text-sm font-medium" style={{ color: colors.accent }}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Avatar */}
          <View className="items-center mt-4 mb-6">
            <View
              className="items-center justify-center rounded-full"
              style={{ width: 80, height: 80, backgroundColor: colors.accentMuted }}>
              <User color={colors.accent} size={36} />
            </View>
            <Text className="mt-3 text-lg font-bold" style={{ color: colors.textPrimary }}>
              {profile?.full_name ?? 'User'}
            </Text>
            <View className="mt-1.5 rounded-full px-3 py-1" style={{ backgroundColor: colors.accentMuted }}>
              <Text className="text-xs font-semibold capitalize" style={{ color: colors.accent }}>
                {profile?.role ?? 'member'}
              </Text>
            </View>
          </View>

          {/* Personal Information */}
          <View className="mx-5 mb-4">
            <Text className="mb-3 text-sm font-semibold" style={{ color: colors.textPrimary }}>Personal Information</Text>
            <View className="rounded-2xl p-4 gap-3" style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
              <FieldRow
                label="Full Name"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your full name"
                editing={editing}
                colors={colors}
              />
              <FieldRow
                label="Email"
                value={user?.email ?? '—'}
                editing={false}
                colors={colors}
              />
              <FieldRow
                label="Role"
                value={profile?.role ?? 'member'}
                editing={false}
                capitalize
                colors={colors}
              />
            </View>
          </View>

          {/* Business Information */}
          <View className="mx-5 mb-4">
            <Text className="mb-3 text-sm font-semibold" style={{ color: colors.textPrimary }}>Business Information</Text>
            <View className="rounded-2xl p-4 gap-3" style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
              <FieldRow
                label="Business Name"
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="Your business name"
                editing={editing}
                icon={<Building2 color={colors.textSecondary} size={14} />}
                colors={colors}
              />
              <FieldRow
                label="Business Address"
                value={businessAddress}
                onChangeText={setBusinessAddress}
                placeholder="Your business address"
                editing={editing}
                multiline
                icon={<MapPin color={colors.textSecondary} size={14} />}
                colors={colors}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldRow({
  label,
  value,
  onChangeText,
  placeholder,
  editing,
  multiline,
  capitalize: cap,
  icon,
  colors,
}: {
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  editing: boolean;
  multiline?: boolean;
  capitalize?: boolean;
  icon?: React.ReactNode;
  colors: ThemeColors;
}) {
  return (
    <View>
      <Text className="mb-1.5 text-xs font-medium" style={{ color: colors.textSecondary }}>
        {label}
      </Text>
      {editing && onChangeText ? (
        <TextInput
          className="rounded-xl px-4 py-3.5 text-sm"
          style={{
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            color: colors.textPrimary,
            ...(multiline ? { minHeight: 70, textAlignVertical: 'top' as const } : {}),
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          value={value}
          onChangeText={onChangeText}
          multiline={multiline}
        />
      ) : (
        <View
          className="flex-row items-center gap-2 rounded-xl px-4 py-3.5"
          style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
          {icon}
          <Text
            className="text-sm flex-1"
            style={{ color: value && value !== '—' ? colors.textPrimary : colors.textSecondary, ...(cap ? { textTransform: 'capitalize' } : {}) }}>
            {value || placeholder || '—'}
          </Text>
        </View>
      )}
    </View>
  );
}
