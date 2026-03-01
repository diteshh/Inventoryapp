import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { ThemeColors } from '@/lib/theme-context';
import type { Folder, Item } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { router } from 'expo-router';
import { AlertTriangle, ArrowLeft, Package, RefreshCw } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type LowStockItem = Item & { folder?: Folder | null };
type Filter = 'all' | 'low' | 'out';

export default function LowStockScreen() {
  const { colors, isDark } = useTheme();
  const [items, setItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const FILTERS: { key: Filter; label: string; color: string; mutedColor: string }[] = [
    { key: 'all', label: 'All Alerts', color: colors.warning, mutedColor: colors.warningMuted },
    { key: 'out', label: 'Out of Stock', color: colors.destructive, mutedColor: colors.destructiveMuted },
    { key: 'low', label: 'Low Stock', color: colors.warning, mutedColor: colors.warningMuted },
  ];

  const load = useCallback(async () => {
    // Fetch all active items, then filter client-side since min_quantity comparison
    // requires knowing each item's own min_quantity column
    const { data } = await supabase
      .from('items')
      .select('*, folders(*)')
      .eq('status', 'active')
      .order('quantity', { ascending: true });
    let filtered = (data ?? []) as LowStockItem[];

    // Client-side filter since RLS/computed columns not available
    if (filter === 'all') {
      filtered = filtered.filter((i) => i.quantity <= i.min_quantity);
    } else if (filter === 'out') {
      filtered = filtered.filter((i) => i.quantity === 0);
    } else if (filter === 'low') {
      filtered = filtered.filter((i) => i.quantity > 0 && i.quantity <= i.min_quantity);
    }

    setItems(filtered);
    setLoading(false);
    setRefreshing(false);
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-3">
        <TouchableOpacity onPress={() => router.back()} className="rounded-xl p-2" style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
          <ArrowLeft color={colors.textPrimary} size={20} />
        </TouchableOpacity>
        <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>Low Stock Alerts</Text>
        <TouchableOpacity
          onPress={() => { setRefreshing(true); load(); }}
          className="rounded-xl p-2"
          style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
          <RefreshCw color={colors.textSecondary} size={18} />
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <View className="mx-5 mb-4 flex-row rounded-xl p-1" style={{ backgroundColor: colors.surface }}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            className="flex-1 items-center rounded-lg py-2"
            style={{ backgroundColor: filter === f.key ? f.mutedColor : 'transparent' }}>
            <Text
              className="text-xs font-semibold"
              style={{ color: filter === f.key ? f.color : colors.textSecondary }}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} className="mt-8" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} />}
          ListHeaderComponent={
            items.length > 0 ? (
              <View
                className="mb-4 flex-row items-center gap-2.5 rounded-xl px-4 py-3"
                style={{ backgroundColor: colors.warningMuted, borderWidth: 1, borderColor: colors.warning + '33' }}>
                <AlertTriangle color={colors.warning} size={16} />
                <Text className="text-sm" style={{ color: colors.warning }}>
                  {items.length} item{items.length !== 1 ? 's' : ''} need{items.length === 1 ? 's' : ''} restocking
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="items-center py-16">
              <View
                className="mb-4 items-center justify-center rounded-full"
                style={{ width: 72, height: 72, backgroundColor: colors.successMuted }}>
                <Package color={colors.success} size={32} />
              </View>
              <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>All stocked up!</Text>
              <Text className="mt-2 text-sm text-center" style={{ color: colors.textSecondary }}>
                No items are below their minimum quantity.
              </Text>
            </View>
          }
          renderItem={({ item }) => <LowStockItemRow item={item} colors={colors} isDark={isDark} />}
        />
      )}
    </SafeAreaView>
  );
}

function LowStockItemRow({ item, colors, isDark }: { item: LowStockItem; colors: ThemeColors; isDark: boolean }) {
  const isOut = item.quantity === 0;
  const alertColor = isOut ? colors.destructive : colors.warning;
  const alertMutedColor = isOut ? colors.destructiveMuted : colors.warningMuted;
  const label = isOut ? 'Out of Stock' : 'Low Stock';

  return (
    <TouchableOpacity
      onPress={() => router.push(`/item/${item.id}`)}
      className="mb-2.5 rounded-2xl p-4"
      style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
      <View className="flex-row items-center gap-3">
        <View
          className="items-center justify-center rounded-xl p-2.5"
          style={{ backgroundColor: alertMutedColor }}>
          <AlertTriangle color={alertColor} size={18} />
        </View>

        <View className="flex-1">
          <Text className="font-semibold" style={{ color: colors.textPrimary }} numberOfLines={1}>{item.name}</Text>
          <View className="flex-row flex-wrap items-center gap-2 mt-0.5">
            {item.sku && (
              <Text className="text-xs" style={{ color: colors.textSecondary }}>{item.sku}</Text>
            )}
            {(item.folder as any)?.name && (
              <Text className="text-xs" style={{ color: colors.textSecondary }}>
                {(item.folder as any).name}
              </Text>
            )}
            {item.location && (
              <Text className="text-xs" style={{ color: colors.accent }}>{item.location}</Text>
            )}
          </View>
        </View>

        <View className="items-end gap-1.5">
          <View
            className="rounded-full px-2.5 py-0.5"
            style={{ backgroundColor: alertMutedColor, borderWidth: 1, borderColor: alertColor + '44' }}>
            <Text className="text-xs font-semibold" style={{ color: alertColor }}>{label}</Text>
          </View>
          <Text className="text-sm font-bold" style={{ color: alertColor }}>
            {item.quantity}
            <Text className="text-xs font-normal" style={{ color: colors.textSecondary }}>
              {' '}/ {item.min_quantity} min
            </Text>
          </Text>
          {(item.cost_price || item.sell_price) && (
            <Text className="text-xs" style={{ color: colors.textSecondary }}>
              {formatCurrency(item.sell_price ?? item.cost_price)}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
