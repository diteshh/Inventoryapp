import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { Folder } from '@/lib/types';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ChevronRight, FolderOpen, Search, X } from 'lucide-react-native';

// Lightweight global to pass folder selection back without re-mounting add-item
let _lastFolderSelection: { folderId: string | null; folderName: string } | null = null;
export function getLastFolderSelection() {
  const val = _lastFolderSelection;
  _lastFolderSelection = null;
  return val;
}
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface FolderNode extends Folder {
  children: FolderNode[];
  depth: number;
}

export default function FolderPickerScreen() {
  const { selectedFolderId } = useLocalSearchParams<{ selectedFolderId?: string }>();
  const { colors, isDark } = useTheme();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase
      .from('folders')
      .select('*')
      .order('name', { ascending: true })
      .then(({ data }) => {
        setFolders((data ?? []) as Folder[]);
        setLoading(false);
      });
  }, []);

  // Auto-expand parents of selected folder
  useEffect(() => {
    if (!selectedFolderId || folders.length === 0) return;
    const parentMap = new Map<string, string | null>();
    for (const f of folders) parentMap.set(f.id, f.parent_folder_id);

    const toExpand = new Set<string>();
    let current = parentMap.get(selectedFolderId) ?? null;
    while (current) {
      toExpand.add(current);
      current = parentMap.get(current) ?? null;
    }
    if (toExpand.size > 0) setExpanded((prev) => new Set([...prev, ...toExpand]));
  }, [selectedFolderId, folders]);

  // Build tree and flatten for display
  const flatList = useMemo(() => {
    if (folders.length === 0) return [];

    // If searching, show flat filtered list
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return folders
        .filter((f) => f.name.toLowerCase().includes(q))
        .map((f) => ({ ...f, children: [], depth: 0 } as FolderNode));
    }

    // Build parent → children map
    const childrenMap = new Map<string | null, Folder[]>();
    for (const f of folders) {
      const parentId = f.parent_folder_id;
      if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
      childrenMap.get(parentId)!.push(f);
    }

    // Flatten tree with depth
    const result: FolderNode[] = [];
    const addChildren = (parentId: string | null, depth: number) => {
      const children = childrenMap.get(parentId) ?? [];
      for (const folder of children) {
        const subChildren = childrenMap.get(folder.id) ?? [];
        result.push({ ...folder, children: subChildren as FolderNode[], depth });
        if (expanded.has(folder.id)) {
          addChildren(folder.id, depth + 1);
        }
      }
    };
    addChildren(null, 0);
    return result;
  }, [folders, expanded, searchQuery]);

  const toggleExpand = (folderId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const selectFolder = (folderId: string | null, folderName: string) => {
    _lastFolderSelection = { folderId, folderName };
    router.back();
  };

  // Check if a folder has children
  const hasChildren = useMemo(() => {
    const set = new Set<string>();
    for (const f of folders) {
      if (f.parent_folder_id) set.add(f.parent_folder_id);
    }
    return set;
  }, [folders]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="px-5 py-3 flex-row items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          className="rounded-xl p-2"
          style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
          <ArrowLeft color={colors.textPrimary} size={20} />
        </TouchableOpacity>
        <Text className="text-base font-bold flex-1 mx-3" style={{ color: colors.textPrimary }}>
          Select Folder
        </Text>
      </View>

      {/* Search */}
      <View
        className="mx-5 mb-3 flex-row items-center rounded-xl px-3 py-2.5"
        style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
        <Search color={colors.textSecondary} size={16} />
        <TextInput
          className="ml-2 flex-1 text-sm"
          style={{ color: colors.textPrimary }}
          placeholder="Search folders..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="done"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X color={colors.textSecondary} size={16} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} className="mt-8" />
      ) : (
        <FlatList
          data={flatList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Pressable
              onPress={() => selectFolder(null, 'All Folders')}
              className="mb-1.5 flex-row items-center rounded-2xl px-4 py-3.5"
              style={{
                backgroundColor: !selectedFolderId ? colors.accentMuted : colors.surface,
                borderWidth: 1,
                borderColor: !selectedFolderId ? `${colors.accent}55` : isDark ? colors.borderLight : colors.border,
                ...(!selectedFolderId ? {} : getCardShadow(isDark)),
              }}>
              <FolderOpen
                color={!selectedFolderId ? colors.accent : colors.textSecondary}
                size={20}
              />
              <Text
                className="flex-1 ml-3 text-sm font-semibold"
                style={{ color: !selectedFolderId ? colors.accent : colors.textPrimary }}>
                All Folders
              </Text>
              {!selectedFolderId && (
                <View
                  className="items-center justify-center rounded-full"
                  style={{ width: 22, height: 22, backgroundColor: colors.accent }}>
                  <Text style={{ color: colors.accentOnAccent, fontSize: 12, fontWeight: '700' }}>{'\u2713'}</Text>
                </View>
              )}
            </Pressable>
          }
          renderItem={({ item: folder, index }) => {
            const isSelected = selectedFolderId === folder.id;
            const isExpanded = expanded.has(folder.id);
            const hasSubs = hasChildren.has(folder.id);
            const depthColors = [colors.accent, colors.success, colors.warning, colors.statusReady];
            const folderColor = isSelected ? colors.accent : depthColors[folder.depth % depthColors.length];

            return (
              <Pressable
                onPress={() => selectFolder(folder.id, folder.name)}
                className="mb-1.5 flex-row items-center rounded-2xl px-4 py-3.5"
                style={{
                  marginLeft: folder.depth * 16,
                  backgroundColor: isSelected ? colors.accentMuted : colors.surface,
                  borderWidth: 1,
                  borderColor: isSelected ? `${colors.accent}55` : isDark ? colors.borderLight : colors.border,
                  ...(isSelected ? {} : getCardShadow(isDark)),
                }}>
                {/* Expand/collapse chevron for folders with children */}
                {hasSubs ? (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      toggleExpand(folder.id);
                    }}
                    hitSlop={8}
                    className="mr-2">
                    <ChevronRight
                      color={colors.textSecondary}
                      size={16}
                      style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}
                    />
                  </Pressable>
                ) : (
                  <View style={{ width: 24 }} />
                )}

                <FolderOpen
                  color={folderColor}
                  size={20}
                />
                <Text
                  className="flex-1 ml-3 text-sm font-semibold"
                  numberOfLines={1}
                  style={{ color: isSelected ? colors.accent : colors.textPrimary }}>
                  {folder.name}
                </Text>

                {isSelected && (
                  <View
                    className="items-center justify-center rounded-full"
                    style={{ width: 22, height: 22, backgroundColor: colors.accent }}>
                    <Text style={{ color: colors.accentOnAccent, fontSize: 12, fontWeight: '700' }}>{'\u2713'}</Text>
                  </View>
                )}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            !loading ? (
              <View className="items-center py-12">
                <FolderOpen color={colors.textSecondary} size={32} />
                <Text className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
                  {searchQuery ? 'No folders match your search' : 'No folders found'}
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}
