import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { Item, Folder } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { router, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  ChevronDown,
  Package,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type SortOption = 'updated_at' | 'name' | 'quantity';

export default function InventorySummaryScreen() {
  const { colors, isDark } = useTheme();
  const [items, setItems] = useState<(Item & { folder_name?: string })[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('updated_at');
  const [folderPickerVisible, setFolderPickerVisible] = useState(false);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [totalValue, setTotalValue] = useState(0);

  const cardStyle = {
    backgroundColor: colors.surface,
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? colors.borderLight : 'transparent',
    ...getCardShadow(isDark),
  };

  const loadData = useCallback(async () => {
    try {
      // Load folders for filter
      const { data: foldersData } = await supabase
        .from('folders')
        .select('*')
        .order('name');
      setFolders((foldersData ?? []) as Folder[]);

      // Load items
      let query = supabase
        .from('items')
        .select('*, folders(name)')
        .eq('status', 'active');

      if (selectedFolder) {
        query = query.eq('folder_id', selectedFolder);
      }

      const sortCol = sortBy === 'updated_at' ? 'updated_at' : sortBy === 'name' ? 'name' : 'quantity';
      const ascending = sortBy === 'name';
      query = query.order(sortCol, { ascending });

      const { data: itemsData } = await query;

      const enhancedItems = ((itemsData ?? []) as any[]).map(item => ({
        ...item,
        folder_name: item.folders?.name ?? null,
        folders: undefined,
      })) as (Item & { folder_name?: string })[];

      setItems(enhancedItems);
      setTotalQuantity(enhancedItems.reduce((acc, i) => acc + (i.quantity || 0), 0));
      setTotalValue(enhancedItems.reduce((acc, i) => acc + (i.quantity || 0) * (i.sell_price ?? i.cost_price ?? 0), 0));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedFolder, sortBy]);

  useEffect(() => { loadData(); }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const selectedFolderName = selectedFolder
    ? folders.find(f => f.id === selectedFolder)?.name ?? 'Unknown'
    : 'All Folders';

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="flex-row items-center px-5 py-3 gap-3">
        <TouchableOpacity onPress={() => router.back()} className="rounded-xl p-2" style={cardStyle}>
          <ArrowLeft color={colors.textPrimary} size={20} />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold" style={{ color: colors.textPrimary }}>
          Inventory Summary
        </Text>
      </View>

      {/* Summary stats */}
      <View className="mx-5 mb-3 flex-row gap-3">
        <View className="flex-1 rounded-2xl p-4" style={cardStyle}>
          <Text className="text-xs" style={{ color: colors.textSecondary }}>Total Quantity</Text>
          <Text className="text-xl font-bold mt-1" style={{ color: colors.textPrimary }}>{totalQuantity}</Text>
        </View>
        <View className="flex-1 rounded-2xl p-4" style={cardStyle}>
          <Text className="text-xs" style={{ color: colors.textSecondary }}>Total Value</Text>
          <Text className="text-xl font-bold mt-1" style={{ color: colors.accent }}>{formatCurrency(totalValue)}</Text>
        </View>
      </View>

      {/* Filters */}
      <View className="px-5 mb-3 flex-row items-center gap-2">
        <TouchableOpacity
          onPress={() => setFolderPickerVisible(true)}
          className="flex-row items-center rounded-full px-3 py-1.5"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <Text className="text-xs font-medium mr-1" style={{ color: selectedFolder ? colors.accent : colors.textSecondary }}>
            {selectedFolderName}
          </Text>
          <ChevronDown color={colors.textSecondary} size={12} />
        </TouchableOpacity>

        {(['updated_at', 'name', 'quantity'] as SortOption[]).map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => setSortBy(s)}
            className="rounded-full px-3 py-1.5"
            style={{
              backgroundColor: sortBy === s ? colors.accentMuted : colors.surface,
              borderWidth: 1,
              borderColor: sortBy === s ? `${colors.accent}66` : colors.border,
            }}>
            <Text
              className="text-xs font-medium"
              style={{ color: sortBy === s ? colors.accent : colors.textSecondary }}>
              {s === 'updated_at' ? 'Recent' : s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Item list */}
      {loading ? (
        <ActivityIndicator color={colors.accent} className="mt-8" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.accent} />}
          ListEmptyComponent={
            <View className="items-center mt-12">
              <Package color={colors.textSecondary} size={32} />
              <Text className="text-base font-semibold mt-3" style={{ color: colors.textPrimary }}>No items found</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/item/${item.id}`)}
              className="mb-2 flex-row items-center rounded-2xl px-4 py-3"
              style={cardStyle}>
              <View className="flex-1">
                <Text className="text-xs" style={{ color: colors.textSecondary }}>{item.sku || 'NO SKU'}</Text>
                <Text className="font-semibold text-sm" style={{ color: colors.textPrimary }} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.folder_name && (
                  <Text className="text-xs mt-0.5" style={{ color: colors.textTertiary }}>
                    {item.folder_name}
                  </Text>
                )}
              </View>
              <View className="items-end">
                <Text className="font-bold text-sm" style={{ color: colors.textPrimary }}>
                  {item.quantity}
                </Text>
                <Text className="text-xs" style={{ color: colors.accent }}>
                  {formatCurrency(item.sell_price)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Folder picker modal */}
      <Modal visible={folderPickerVisible} transparent animationType="slide">
        <TouchableOpacity
          className="flex-1"
          activeOpacity={1}
          onPress={() => setFolderPickerVisible(false)}
          style={{ backgroundColor: colors.overlay }}
        />
        <View className="rounded-t-3xl p-5 pb-10" style={{ backgroundColor: colors.surface }}>
          <Text className="text-lg font-bold mb-4" style={{ color: colors.textPrimary }}>Select Folder</Text>
          <TouchableOpacity
            onPress={() => { setSelectedFolder(null); setFolderPickerVisible(false); }}
            className="rounded-xl px-4 py-3 mb-2"
            style={{ backgroundColor: !selectedFolder ? colors.accentMuted : colors.background }}>
            <Text className="font-medium" style={{ color: !selectedFolder ? colors.accent : colors.textPrimary }}>
              All Folders
            </Text>
          </TouchableOpacity>
          {folders.map(f => (
            <TouchableOpacity
              key={f.id}
              onPress={() => { setSelectedFolder(f.id); setFolderPickerVisible(false); }}
              className="rounded-xl px-4 py-3 mb-2"
              style={{ backgroundColor: selectedFolder === f.id ? colors.accentMuted : colors.background }}>
              <Text className="font-medium" style={{ color: selectedFolder === f.id ? colors.accent : colors.textPrimary }}>
                {f.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
