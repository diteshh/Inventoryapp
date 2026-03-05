import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { Tag } from '@/lib/types';
import { router, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  Check,
  Edit2,
  Plus,
  Search,
  Tag as TagIcon,
  Trash2,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PRESET_COLORS = [
  '#00BFA6', '#3B82F6', '#8B5CF6', '#EC4899',
  '#F59E0B', '#EF4444', '#22C55E', '#F97316',
  '#06B6D4', '#84CC16', '#E11D48', '#0EA5E9',
];

export default function TagsScreen() {
  const { colors, isDark } = useTheme();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState(PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const cardStyle = {
    backgroundColor: colors.surface,
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? colors.borderLight : 'transparent',
    ...getCardShadow(isDark),
  };

  const loadTags = useCallback(async () => {
    try {
      let query = supabase.from('tags').select('*').order('name');
      if (searchQuery.trim()) {
        query = query.ilike('name', `%${searchQuery}%`);
      }
      const { data } = await query;
      setTags((data ?? []) as Tag[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery]);

  useEffect(() => { loadTags(); }, [loadTags]);

  useFocusEffect(
    useCallback(() => {
      loadTags();
    }, [loadTags])
  );

  const openCreate = () => {
    setEditingTag(null);
    setTagName('');
    setTagColor(PRESET_COLORS[0]);
    setModalVisible(true);
  };

  const openEdit = (tag: Tag) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagColor(tag.colour ?? PRESET_COLORS[0]);
    setModalVisible(true);
  };

  const saveTag = async () => {
    if (!tagName.trim()) return;
    setSaving(true);
    try {
      if (editingTag) {
        const { error } = await supabase
          .from('tags')
          .update({ name: tagName.trim(), colour: tagColor })
          .eq('id', editingTag.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tags')
          .insert({ name: tagName.trim(), colour: tagColor });
        if (error) throw error;
      }
      setModalVisible(false);
      loadTags();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteTag = (tag: Tag) => {
    Alert.alert('Delete Tag', `Delete "${tag.name}"? This will remove it from all items.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('tags').delete().eq('id', tag.id);
          loadTags();
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="flex-row items-center px-5 py-3 gap-3">
        <TouchableOpacity onPress={() => router.back()} className="rounded-xl p-2" style={cardStyle}>
          <ArrowLeft color={colors.textPrimary} size={20} />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold" style={{ color: colors.textPrimary }}>
          Tags
        </Text>
        <TouchableOpacity
          onPress={openCreate}
          className="flex-row items-center gap-1.5 rounded-xl px-3 py-2.5"
          style={{ backgroundColor: colors.accent }}>
          <Plus color={colors.accentOnAccent} size={16} />
          <Text className="text-sm font-semibold" style={{ color: colors.accentOnAccent }}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View className="px-5 mb-3">
        <View
          className="flex-row items-center rounded-xl px-3 py-2.5"
          style={cardStyle}>
          <Search color={colors.textSecondary} size={16} />
          <TextInput
            className="ml-2 flex-1 text-sm"
            placeholder="Search tags..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{ color: colors.textPrimary }}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X color={colors.textSecondary} size={16} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Tag list */}
      {loading ? (
        <ActivityIndicator color={colors.accent} className="mt-8" />
      ) : (
        <FlatList
          data={tags}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTags(); }} tintColor={colors.accent} />}
          ListEmptyComponent={
            <View className="items-center mt-12">
              <TagIcon color={colors.textSecondary} size={32} />
              <Text className="text-base font-semibold mt-3" style={{ color: colors.textPrimary }}>No tags yet</Text>
              <Text className="text-sm mt-1" style={{ color: colors.textSecondary }}>Create tags to categorize your items</Text>
            </View>
          }
          renderItem={({ item: tag }) => (
            <View
              className="mb-2 flex-row items-center rounded-2xl px-4 py-3"
              style={cardStyle}>
              <View
                className="rounded-full mr-3"
                style={{ width: 14, height: 14, backgroundColor: tag.colour ?? colors.textSecondary }}
              />
              <Text className="flex-1 font-medium text-sm" style={{ color: colors.textPrimary }}>
                {tag.name}
              </Text>
              <TouchableOpacity onPress={() => openEdit(tag)} className="p-2">
                <Edit2 color={colors.textSecondary} size={16} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteTag(tag)} className="p-2">
                <Trash2 color={colors.destructive} size={16} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Create/Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <TouchableOpacity
            className="flex-1"
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
            style={{ backgroundColor: colors.overlay }}
          />
          <View className="rounded-t-3xl p-5 pb-10" style={{ backgroundColor: colors.surface }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>
                {editingTag ? 'Edit Tag' : 'New Tag'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X color={colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>

            <Text className="text-sm mb-2" style={{ color: colors.textSecondary }}>Name</Text>
            <TextInput
              className="rounded-xl px-4 py-3 mb-4 text-sm"
              style={{
                backgroundColor: colors.background,
                color: colors.textPrimary,
                borderWidth: 1,
                borderColor: colors.border,
              }}
              placeholder="Tag name"
              placeholderTextColor={colors.textSecondary}
              value={tagName}
              onChangeText={setTagName}
              autoFocus
            />

            <Text className="text-sm mb-2" style={{ color: colors.textSecondary }}>Color</Text>
            <View className="flex-row flex-wrap gap-3 mb-6">
              {PRESET_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setTagColor(c)}
                  className="items-center justify-center rounded-full"
                  style={{
                    width: 36,
                    height: 36,
                    backgroundColor: c,
                    borderWidth: tagColor === c ? 3 : 0,
                    borderColor: colors.textPrimary,
                  }}>
                  {tagColor === c && <Check color="#fff" size={16} />}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={saveTag}
              disabled={saving || !tagName.trim()}
              className="rounded-xl py-3.5 items-center"
              style={{
                backgroundColor: tagName.trim() ? colors.accent : colors.border,
              }}>
              {saving ? (
                <ActivityIndicator color={colors.accentOnAccent} />
              ) : (
                <Text className="text-base font-semibold" style={{ color: colors.accentOnAccent }}>
                  {editingTag ? 'Save Changes' : 'Create Tag'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
