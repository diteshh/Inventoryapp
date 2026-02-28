import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/lib/theme';
import type { Tag } from '@/lib/types';
import { impactMedium, notificationSuccess } from '@/lib/haptics';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Check,
  Edit2,
  KeyRound,
  Plus,
  Shield,
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

const PRESET_COLORS = [
  '#00BFA6', '#3B82F6', '#8B5CF6', '#EC4899',
  '#F59E0B', '#EF4444', '#22C55E', '#F97316',
  '#06B6D4', '#84CC16', '#E11D48', '#0EA5E9',
];

type SettingsTab = 'profile' | 'security' | 'tags';

export default function SettingsScreen() {
  const { tab: defaultTab } = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    (defaultTab as SettingsTab) ?? 'profile'
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.navy }}>
      <View className="flex-row items-center justify-between px-5 py-3">
        <TouchableOpacity onPress={() => router.back()} className="rounded-xl p-2" style={{ backgroundColor: COLORS.navyCard }}>
          <ArrowLeft color={COLORS.textPrimary} size={20} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-white">Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tab bar */}
      <View className="mx-5 mb-4 flex-row rounded-xl p-1" style={{ backgroundColor: COLORS.navyCard }}>
        {(['profile', 'security', 'tags'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            className="flex-1 items-center rounded-lg py-2"
            style={{ backgroundColor: activeTab === tab ? `${COLORS.teal}22` : 'transparent' }}>
            <Text
              className="text-xs font-semibold capitalize"
              style={{ color: activeTab === tab ? COLORS.teal : COLORS.textSecondary }}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'profile' && <ProfileTab />}
      {activeTab === 'security' && <SecurityTab />}
      {activeTab === 'tags' && <TagsTab />}
    </SafeAreaView>
  );
}

/* ─── Profile Tab ─── */
function ProfileTab() {
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
        <View className="rounded-2xl p-4 gap-4" style={{ backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.border }}>
          <View
            className="mx-auto items-center justify-center rounded-full mb-2"
            style={{ width: 72, height: 72, backgroundColor: `${COLORS.teal}22` }}>
            <User color={COLORS.teal} size={32} />
          </View>

          <View>
            <Text className="mb-1.5 text-xs font-medium" style={{ color: COLORS.textSecondary }}>
              Full Name
            </Text>
            <TextInput
              className="rounded-xl px-4 py-3.5 text-sm text-white"
              style={{ backgroundColor: COLORS.navy, borderWidth: 1, borderColor: COLORS.border }}
              placeholder="Your full name"
              placeholderTextColor={COLORS.textSecondary}
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <View>
            <Text className="mb-1.5 text-xs font-medium" style={{ color: COLORS.textSecondary }}>
              Email
            </Text>
            <View
              className="rounded-xl px-4 py-3.5"
              style={{ backgroundColor: COLORS.navy, borderWidth: 1, borderColor: COLORS.border }}>
              <Text className="text-sm" style={{ color: COLORS.textSecondary }}>
                {user?.email ?? '—'}
              </Text>
            </View>
          </View>

          <View>
            <Text className="mb-1.5 text-xs font-medium" style={{ color: COLORS.textSecondary }}>
              Role
            </Text>
            <View
              className="rounded-xl px-4 py-3.5"
              style={{ backgroundColor: COLORS.navy, borderWidth: 1, borderColor: COLORS.border }}>
              <Text className="text-sm capitalize" style={{ color: COLORS.textSecondary }}>
                {profile?.role ?? 'member'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={save}
            disabled={saving}
            className="items-center rounded-xl py-3.5"
            style={{ backgroundColor: COLORS.teal }}>
            {saving ? (
              <ActivityIndicator color={COLORS.navy} size="small" />
            ) : (
              <Text className="font-bold" style={{ color: COLORS.navy }}>Save Profile</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ─── Security Tab ─── */
function SecurityTab() {
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
          style={{ backgroundColor: `${COLORS.teal}15`, borderWidth: 1, borderColor: `${COLORS.teal}33` }}>
          <Shield color={COLORS.teal} size={16} />
          <Text className="flex-1 text-sm" style={{ color: COLORS.teal }}>
            {hasPIN ? 'You have a PIN set. Enter your current PIN to change it.' : 'Set a PIN to add an extra layer of security.'}
          </Text>
        </View>

        <View className="rounded-2xl p-4 gap-4" style={{ backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.border }}>
          {hasPIN && (
            <View>
              <Text className="mb-1.5 text-xs font-medium" style={{ color: COLORS.textSecondary }}>
                Current PIN
              </Text>
              <TextInput
                className="rounded-xl px-4 py-3.5 text-sm text-white"
                style={{ backgroundColor: COLORS.navy, borderWidth: 1, borderColor: COLORS.border }}
                placeholder="••••"
                placeholderTextColor={COLORS.textSecondary}
                value={currentPin}
                onChangeText={setCurrentPin}
                secureTextEntry
                keyboardType="number-pad"
                maxLength={8}
              />
            </View>
          )}

          <View>
            <Text className="mb-1.5 text-xs font-medium" style={{ color: COLORS.textSecondary }}>
              {hasPIN ? 'New PIN' : 'PIN'}
            </Text>
            <TextInput
              className="rounded-xl px-4 py-3.5 text-sm text-white"
              style={{ backgroundColor: COLORS.navy, borderWidth: 1, borderColor: COLORS.border }}
              placeholder="••••"
              placeholderTextColor={COLORS.textSecondary}
              value={newPin}
              onChangeText={setNewPin}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={8}
            />
          </View>

          <View>
            <Text className="mb-1.5 text-xs font-medium" style={{ color: COLORS.textSecondary }}>
              Confirm PIN
            </Text>
            <TextInput
              className="rounded-xl px-4 py-3.5 text-sm text-white"
              style={{ backgroundColor: COLORS.navy, borderWidth: 1, borderColor: COLORS.border }}
              placeholder="••••"
              placeholderTextColor={COLORS.textSecondary}
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
            style={{ backgroundColor: COLORS.teal }}>
            {saving ? (
              <ActivityIndicator color={COLORS.navy} size="small" />
            ) : (
              <>
                <KeyRound color={COLORS.navy} size={16} />
                <Text className="font-bold" style={{ color: COLORS.navy }}>
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

/* ─── Tags Tab ─── */
function TagsTab() {
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
        style={{ backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: `${COLORS.teal}44`, borderStyle: 'dashed' }}>
        <Plus color={COLORS.teal} size={16} />
        <Text className="text-sm font-semibold" style={{ color: COLORS.teal }}>New Tag</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator color={COLORS.teal} className="mt-8" />
      ) : tags.length === 0 ? (
        <View className="items-center py-12">
          <TagIcon color={COLORS.textSecondary} size={32} />
          <Text className="mt-3 text-sm" style={{ color: COLORS.textSecondary }}>
            No tags yet. Create one to start organizing items.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="rounded-2xl overflow-hidden" style={{ backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.border }}>
            {tags.map((tag, idx) => (
              <View key={tag.id}>
                {idx > 0 && <View style={{ height: 1, backgroundColor: COLORS.border }} />}
                <View className="flex-row items-center gap-3 px-4 py-3.5">
                  <View
                    className="rounded-full"
                    style={{ width: 14, height: 14, backgroundColor: tag.colour ?? COLORS.teal }}
                  />
                  <Text className="flex-1 text-sm font-medium text-white">{tag.name}</Text>
                  <TouchableOpacity onPress={() => openEdit(tag)} className="p-2 rounded-lg mr-1" style={{ backgroundColor: `${COLORS.teal}22` }}>
                    <Edit2 color={COLORS.teal} size={14} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteTag(tag)} className="p-2 rounded-lg" style={{ backgroundColor: `${COLORS.destructive}22` }}>
                    <Trash2 color={COLORS.destructive} size={14} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Tag modal */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <View className="w-full rounded-2xl p-5" style={{ backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.border }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-base font-bold text-white">{editTag ? 'Edit Tag' : 'New Tag'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X color={COLORS.textSecondary} size={20} />
              </TouchableOpacity>
            </View>

            <Text className="mb-1.5 text-xs font-medium" style={{ color: COLORS.textSecondary }}>Tag Name</Text>
            <TextInput
              className="rounded-xl px-4 py-3 text-sm text-white mb-4"
              style={{ backgroundColor: COLORS.navy, borderWidth: 1, borderColor: COLORS.border }}
              placeholder="e.g. Electronics"
              placeholderTextColor={COLORS.textSecondary}
              value={tagName}
              onChangeText={setTagName}
              autoFocus
            />

            <Text className="mb-2 text-xs font-medium" style={{ color: COLORS.textSecondary }}>Colour</Text>
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
              style={{ backgroundColor: COLORS.teal }}>
              {saving ? (
                <ActivityIndicator color={COLORS.navy} size="small" />
              ) : (
                <Text className="font-bold" style={{ color: COLORS.navy }}>
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
