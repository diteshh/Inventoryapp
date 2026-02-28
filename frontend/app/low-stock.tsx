import { supabase } from '@/lib/supabase';
import { COLORS } from '@/lib/theme';
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

const FILTERS: { key: Filter; label: string; color: string }[] = [
  { key: 'all', label: 'All Alerts', color: COLORS.warning },
  { key: 'out', label: 'Out of Stock', color: COLORS.destructive },
  { key: 'low', label: 'Low Stock', color: COLORS.warning },
];

export default function LowStockScreen() {
  const [items, setItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

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
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.navy }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-3">
        <TouchableOpacity onPress={() => router.back()} className="rounded-xl p-2" style={{ backgroundColor: COLORS.navyCard }}>
          <ArrowLeft color={COLORS.textPrimary} size={20} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-white">Low Stock Alerts</Text>
        <TouchableOpacity
          onPress={() => { setRefreshing(true); load(); }}
          className="rounded-xl p-2"
          style={{ backgroundColor: COLORS.navyCard }}>
          <RefreshCw color={COLORS.textSecondary} size={18} />
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <View className="mx-5 mb-4 flex-row rounded-xl p-1" style={{ backgroundColor: COLORS.navyCard }}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            className="flex-1 items-center rounded-lg py-2"
            style={{ backgroundColor: filter === f.key ? `${f.color}22` : 'transparent' }}>
            <Text
              className="text-xs font-semibold"
              style={{ color: filter === f.key ? f.color : COLORS.textSecondary }}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.teal} className="mt-8" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.teal} />}
          ListHeaderComponent={
            items.length > 0 ? (
              <View
                className="mb-4 flex-row items-center gap-2.5 rounded-xl px-4 py-3"
                style={{ backgroundColor: `${COLORS.warning}15`, borderWidth: 1, borderColor: `${COLORS.warning}33` }}>
                <AlertTriangle color={COLORS.warning} size={16} />
                <Text className="text-sm" style={{ color: COLORS.warning }}>
                  {items.length} item{items.length !== 1 ? 's' : ''} need{items.length === 1 ? 's' : ''} restocking
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="items-center py-16">
              <View
                className="mb-4 items-center justify-center rounded-full"
                style={{ width: 72, height: 72, backgroundColor: `${COLORS.success}22` }}>
                <Package color={COLORS.success} size={32} />
              </View>
              <Text className="text-base font-semibold text-white">All stocked up!</Text>
              <Text className="mt-2 text-sm text-center" style={{ color: COLORS.textSecondary }}>
                No items are below their minimum quantity.
              </Text>
            </View>
          }
          renderItem={({ item }) => <LowStockItemRow item={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function LowStockItemRow({ item }: { item: LowStockItem }) {
  const isOut = item.quantity === 0;
  const alertColor = isOut ? COLORS.destructive : COLORS.warning;
  const label = isOut ? 'Out of Stock' : 'Low Stock';

  return (
    <TouchableOpacity
      onPress={() => router.push(`/item/${item.id}`)}
      className="mb-2.5 rounded-2xl p-4"
      style={{ backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: `${alertColor}44` }}>
      <View className="flex-row items-center gap-3">
        <View
          className="items-center justify-center rounded-xl p-2.5"
          style={{ backgroundColor: `${alertColor}22` }}>
          <AlertTriangle color={alertColor} size={18} />
        </View>

        <View className="flex-1">
          <Text className="font-semibold text-white" numberOfLines={1}>{item.name}</Text>
          <View className="flex-row flex-wrap items-center gap-2 mt-0.5">
            {item.sku && (
              <Text className="text-xs" style={{ color: COLORS.textSecondary }}>{item.sku}</Text>
            )}
            {(item.folders as any)?.name && (
              <Text className="text-xs" style={{ color: COLORS.textSecondary }}>
                📁 {(item.folders as any).name}
              </Text>
            )}
            {item.location && (
              <Text className="text-xs" style={{ color: COLORS.teal }}>📍 {item.location}</Text>
            )}
          </View>
        </View>

        <View className="items-end gap-1.5">
          <View
            className="rounded-full px-2.5 py-0.5"
            style={{ backgroundColor: `${alertColor}22`, borderWidth: 1, borderColor: `${alertColor}44` }}>
            <Text className="text-xs font-semibold" style={{ color: alertColor }}>{label}</Text>
          </View>
          <Text className="text-sm font-bold" style={{ color: alertColor }}>
            {item.quantity}
            <Text className="text-xs font-normal" style={{ color: COLORS.textSecondary }}>
              {' '}/ {item.min_quantity} min
            </Text>
          </Text>
          {(item.cost_price || item.sell_price) && (
            <Text className="text-xs" style={{ color: COLORS.textSecondary }}>
              {formatCurrency(item.sell_price ?? item.cost_price)}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
