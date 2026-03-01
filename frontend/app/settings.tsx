import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { ThemeColors } from '@/lib/theme-context';
import type { Tag } from '@/lib/types';
import { impactMedium, notificationSuccess } from '@/lib/haptics';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Check,
  Edit2,
  KeyRound,
  Moon,
  Plus,
  Shield,
  Smartphone,
  Sun,
  Tag as TagIcon,
  Trash2,
  User,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ThemeMode } from '@/lib/theme-context';

const PRESET_COLORS = [
  '#00BFA6', '#3B82F6', '#8B5CF6', '#EC4899',
  '#F59E0B', '#EF4444', '#22C55E', '#F97316',
  '#06B6D4', '#84CC16', '#E11D48', '#0EA5E9',
];

type SettingsTab = 'profile' | 'security' | 'tags' | 'appearance';

export default function SettingsScreen() {
  const { tab: defaultTab } = useLocalSearchParams<{ tab?: string }>();
  const { colors, isDark, mode, setMode } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    (defaultTab as SettingsTab) ?? 'profile'
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="flex-row items-center justify-between px-5 py-3">
        <TouchableOpacity onPress={() => router.back()} className="rounded-xl p-2" style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
          <ArrowLeft color={colors.textPrimary} size={20} />
        </TouchableOpacity>
        <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tab bar */}
      <View className="mx-5 mb-4 flex-row rounded-xl p-1" style={{ backgroundColor: colors.surface }}>
        {(['profile', 'security', 'tags', 'appearance'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            className="flex-1 items-center rounded-lg py-2"
            style={{ backgroundColor: activeTab === tab ? colors.accentMuted : 'transparent' }}>
            <Text
              className="text-xs font-semibold capitalize"
              style={{ color: activeTab === tab ? colors.accent : colors.textSecondary }}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'profile' && <ProfileTab colors={colors} isDark={isDark} />}
      {activeTab === 'security' && <SecurityTab colors={colors} isDark={isDark} />}
      {activeTab === 'tags' && <TagsTab colors={colors} isDark={isDark} />}
      {activeTab === 'appearance' && <AppearanceTab colors={colors} isDark={isDark} mode={mode} setMode={setMode} />}
    </SafeAreaView>
  );
}

/* --- Appearance Tab --- */
function AppearanceTab({ colors, isDark, mode, setMode }: { colors: ThemeColors; isDark: boolean; mode: ThemeMode; setMode: (m: ThemeMode) => void }) {
  const options: { key: ThemeMode; label: string; icon: typeof Sun }[] = [
    { key: 'light', label: 'Light', icon: Sun },
    { key: 'dark', label: 'Dark', icon: Moon },
    { key: 'system', label: 'System', icon: Smartphone },
  ];

  return (
    <ScrollView className="flex-1 px-5">
      <View className="rounded-2xl p-4 gap-4" style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
        <Text className="text-sm font-semibold" style={{ color: colors.textPrimary }}>Theme Mode</Text>
        <Text className="text-xs" style={{ color: colors.textSecondary }}>
          Choose how the app looks. "System" follows your device setting.
        </Text>

        <View className="flex-row gap-3">
          {options.map((opt) => {
            const isActive = mode === opt.key;
            const Icon = opt.icon;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setMode(opt.key)}
                className="flex-1 items-center justify-center rounded-xl py-3 gap-2"
                style={{
                  backgroundColor: isActive ? colors.accent : colors.surface,
                  borderWidth: 1,
                  borderColor: isActive ? colors.accent : colors.border,
                }}>
                <Icon color={isActive ? colors.accentOnAccent : colors.textSecondary} size={20} />
                <Text
                  className="text-xs font-semibold"
                  style={{ color: isActive ? colors.accentOnAccent : colors.textSecondary }}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

/* --- Profile Tab --- */
function ProfileTab({ colors, isDark }: { colors: ThemeColors; isDark: boolean }) {
  const { profile, updateProfile, user } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await updateProfile({ full_name: fullName.trim() || null });
    notificationSuccess();
    setSaving(false);
    Alert.alert('Saved', 'Profile updated successfully.');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
      <ScrollView className="flex-1 px-5" keyboardShouldPersistTaps="handled">
        <View className="rounded-2xl p-4 gap-4" style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
          <View
            className="mx-auto items-center justify-center rounded-full mb-2"
            style={{ width: 72, height: 72, backgroundColor: colors.accentMuted }}>
            <User color={colors.accent} size={32} />
          </View>

          <View>
            <Text className="mb-1.5 text-xs font-medium" style={{ color: colors.textSecondary }}>
              Full Name
            </Text>
            <TextInput
              className="rounded-xl px-4 py-3.5 text-sm"
              style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary }}
              placeholder="Your full name"
              placeholderTextColor={colors.textSecondary}
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <View>
            <Text className="mb-1.5 text-xs font-medium" style={{ color: colors.textSecondary }}>
              Email
            </Text>
            <View
              className="rounded-xl px-4 py-3.5"
              style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
              <Text className="text-sm" style={{ color: colors.textSecondary }}>
                {user?.email ?? '\u2014'}
              </Text>
            </View>
          </View>

          <View>
            <Text className="mb-1.5 text-xs font-medium" style={{ color: colors.textSecondary }}>
              Role
            </Text>
            <View
              className="rounded-xl px-4 py-3.5"
              style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
              <Text className="text-sm capitalize" style={{ color: colors.textSecondary }}>
                {profile?.role ?? 'member'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={save}
            disabled={saving}
            className="items-center rounded-xl py-3.5"
            style={{ backgroundColor: colors.accent }}>
            {saving ? (
              <ActivityIndicator color={colors.accentOnAccent} size="small" />
            ) : (
              <Text className="font-bold" style={{ color: colors.accentOnAccent }}>Save Profile</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* --- Security Tab --- */
function SecurityTab({ colors, isDark }: { colors: ThemeColors; isDark: boolean }) {
  const { setPIN, verifyPIN, hasPIN } = useAuth();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSetPIN = async () => {
    if (newPin.length < 4) {
      Alert.alert('Error', 'PIN must be at least 4 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      Alert.alert('Error', 'PINs do not match.');
      return;
    }
    if (hasPIN) {
      const ok = await verifyPIN(currentPin);
      if (!ok) {
        Alert.alert('Error', 'Current PIN is incorrect.');
        return;
      }
    }
    setSaving(true);
    await setPIN(newPin);
    notificationSuccess();
    setSaving(false);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    Alert.alert('Success', hasPIN ? 'PIN updated.' : 'PIN set successfully.');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
      <ScrollView className="flex-1 px-5" keyboardShouldPersistTaps="handled">
        <View
          className="mb-4 flex-row items-center gap-3 rounded-xl px-4 py-3"
          style={{ backgroundColor: colors.accentMuted, borderWidth: 1, borderColor: colors.accent + '33' }}>
          <Shield color={colors.accent} size={16} />
          <Text className="flex-1 text-sm" style={{ color: colors.accent }}>
            {hasPIN ? 'You have a PIN set. Enter your current PIN to change it.' : 'Set a PIN to add an extra layer of security.'}
          </Text>
        </View>

        <View className="rounded-2xl p-4 gap-4" style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
          {hasPIN && (
            <View>
              <Text className="mb-1.5 text-xs font-medium" style={{ color: colors.textSecondary }}>
                Current PIN
              </Text>
              <TextInput
                className="rounded-xl px-4 py-3.5 text-sm"
                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary }}
                placeholder="••••"
                placeholderTextColor={colors.textSecondary}
                value={currentPin}
                onChangeText={setCurrentPin}
                secureTextEntry
                keyboardType="number-pad"
                maxLength={8}
              />
            </View>
          )}

          <View>
            <Text className="mb-1.5 text-xs font-medium" style={{ color: colors.textSecondary }}>
              {hasPIN ? 'New PIN' : 'PIN'}
            </Text>
            <TextInput
              className="rounded-xl px-4 py-3.5 text-sm"
              style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary }}
              placeholder="••••"
              placeholderTextColor={colors.textSecondary}
              value={newPin}
              onChangeText={setNewPin}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={8}
            />
          </View>

          <View>
            <Text className="mb-1.5 text-xs font-medium" style={{ color: colors.textSecondary }}>
              Confirm PIN
            </Text>
            <TextInput
              className="rounded-xl px-4 py-3.5 text-sm"
              style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary }}
              placeholder="••••"
              placeholderTextColor={colors.textSecondary}
              value={confirmPin}
              onChangeText={setConfirmPin}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={8}
            />
          </View>

          <TouchableOpacity
            onPress={handleSetPIN}
            disabled={saving}
            className="flex-row items-center justify-center gap-2 rounded-xl py-3.5"
            style={{ backgroundColor: colors.accent }}>
            {saving ? (
              <ActivityIndicator color={colors.accentOnAccent} size="small" />
            ) : (
              <>
                <KeyRound color={colors.accentOnAccent} size={16} />
                <Text className="font-bold" style={{ color: colors.accentOnAccent }}>
                  {hasPIN ? 'Update PIN' : 'Set PIN'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* --- Tags Tab --- */
function TagsTab({ colors, isDark }: { colors: ThemeColors; isDark: boolean }) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTag, setEditTag] = useState<Tag | null>(null);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState(PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const loadTags = useCallback(async () => {
    const { data } = await supabase.from('tags').select('*').order('name', { ascending: true });
    setTags((data ?? []) as Tag[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const openCreate = () => {
    setEditTag(null);
    setTagName('');
    setTagColor(PRESET_COLORS[0]);
    setShowModal(true);
  };

  const openEdit = (tag: Tag) => {
    setEditTag(tag);
    setTagName(tag.name);
    setTagColor(tag.colour ?? PRESET_COLORS[0]);
    setShowModal(true);
  };

  const saveTag = async () => {
    if (!tagName.trim()) {
      Alert.alert('Required', 'Tag name is required.');
      return;
    }
    setSaving(true);

    if (editTag) {
      await supabase.from('tags').update({ name: tagName.trim(), colour: tagColor }).eq('id', editTag.id);
    } else {
      await supabase.from('tags').insert({ name: tagName.trim(), colour: tagColor });
    }

      notificationSuccess();
      setSaving(false);
      setShowModal(false);
      loadTags();
  };

  const deleteTag = (tag: Tag) => {
    Alert.alert('Delete Tag', `Delete "${tag.name}"? It will be removed from all items.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('item_tags').delete().eq('tag_id', tag.id);
          await supabase.from('tags').delete().eq('id', tag.id);
          impactMedium();
          loadTags();
        },
      },
    ]);
  };

  return (
    <View className="flex-1 px-5">
      <TouchableOpacity
        onPress={openCreate}
        className="mb-4 flex-row items-center justify-center gap-2 rounded-2xl py-3.5"
        style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accent + '44', borderStyle: 'dashed' }}>
        <Plus color={colors.accent} size={16} />
        <Text className="text-sm font-semibold" style={{ color: colors.accent }}>New Tag</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator color={colors.accent} className="mt-8" />
      ) : tags.length === 0 ? (
        <View className="items-center py-12">
          <TagIcon color={colors.textSecondary} size={32} />
          <Text className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
            No tags yet. Create one to start organizing items.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="rounded-2xl overflow-hidden" style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
            {tags.map((tag, idx) => (
              <View key={tag.id}>
                {idx > 0 && <View style={{ height: 1, backgroundColor: colors.border }} />}
                <View className="flex-row items-center gap-3 px-4 py-3.5">
                  <View
                    className="rounded-full"
                    style={{ width: 14, height: 14, backgroundColor: tag.colour ?? colors.accent }}
                  />
                  <Text className="flex-1 text-sm font-medium" style={{ color: colors.textPrimary }}>{tag.name}</Text>
                  <TouchableOpacity onPress={() => openEdit(tag)} className="p-2 rounded-lg mr-1" style={{ backgroundColor: colors.accentMuted }}>
                    <Edit2 color={colors.accent} size={14} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteTag(tag)} className="p-2 rounded-lg" style={{ backgroundColor: colors.destructiveMuted }}>
                    <Trash2 color={colors.destructive} size={14} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Tag modal */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: colors.overlay }}>
          <View className="w-full rounded-2xl p-5" style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-base font-bold" style={{ color: colors.textPrimary }}>{editTag ? 'Edit Tag' : 'New Tag'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X color={colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>

            <Text className="mb-1.5 text-xs font-medium" style={{ color: colors.textSecondary }}>Tag Name</Text>
            <TextInput
              className="rounded-xl px-4 py-3 text-sm mb-4"
              style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary }}
              placeholder="e.g. Electronics"
              placeholderTextColor={colors.textSecondary}
              value={tagName}
              onChangeText={setTagName}
              autoFocus
            />

            <Text className="mb-2 text-xs font-medium" style={{ color: colors.textSecondary }}>Colour</Text>
            <View className="flex-row flex-wrap gap-2.5 mb-4">
              {PRESET_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setTagColor(c)}
                  className="items-center justify-center rounded-full"
                  style={{ width: 32, height: 32, backgroundColor: c }}>
                  {tagColor === c && <Check color="#fff" size={16} />}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={saveTag}
              disabled={saving}
              className="items-center rounded-xl py-3"
              style={{ backgroundColor: colors.accent }}>
              {saving ? (
                <ActivityIndicator color={colors.accentOnAccent} size="small" />
              ) : (
                <Text className="font-bold" style={{ color: colors.accentOnAccent }}>
                  {editTag ? 'Save Changes' : 'Create Tag'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
