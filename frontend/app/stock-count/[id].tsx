import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useTeam } from '@/lib/team-context';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { Item, StockCount, StockCountItem } from '@/lib/types';
import {
  getStockCountStatusColor,
  getStockCountStatusLabel,
  logActivity,
} from '@/lib/utils';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  Check,
  ClipboardCheck,
  Minus,
  Plus,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type CountItemWithItem = StockCountItem & { items: Item | null };

export default function StockCountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { teamId } = useTeam();
  const { colors, isDark } = useTheme();
  const [stockCount, setStockCount] = useState<StockCount | null>(null);
  const [items, setItems] = useState<CountItemWithItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [applying, setApplying] = useState(false);

  const cardStyle = {
    backgroundColor: colors.surface,
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? colors.borderLight : 'transparent',
    ...getCardShadow(isDark),
  };

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [scRes, itemsRes] = await Promise.all([
        supabase.from('stock_counts').select('*').eq('id', id).single(),
        supabase.from('stock_count_items').select('*, items(*)').eq('stock_count_id', id),
      ]);
      setStockCount(scRes.data as StockCount);
      setItems((itemsRes.data ?? []) as CountItemWithItem[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const updateCount = async (sci: CountItemWithItem, newCount: number) => {
    const counted = Math.max(0, newCount);
    const diff = counted - sci.expected_quantity;

    await supabase
      .from('stock_count_items')
      .update({
        counted_quantity: counted,
        difference: diff,
        counted_by: user?.id,
        counted_at: new Date().toISOString(),
      })
      .eq('id', sci.id);

    setItems(prev =>
      prev.map(i =>
        i.id === sci.id ? { ...i, counted_quantity: counted, difference: diff } : i
      )
    );

    // Auto-transition to in_progress if still draft
    if (stockCount?.status === 'draft') {
      await supabase.from('stock_counts').update({ status: 'in_progress' }).eq('id', id);
      setStockCount(prev => prev ? { ...prev, status: 'in_progress' } : prev);
    }
  };

  const applyAdjustments = async () => {
    Alert.alert(
      'Apply Adjustments',
      'This will update inventory quantities based on counted values. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          onPress: async () => {
            setApplying(true);
            try {
              for (const sci of items) {
                if (sci.counted_quantity == null || sci.difference === 0) continue;

                // Update item quantity
                await supabase
                  .from('items')
                  .update({ quantity: sci.counted_quantity })
                  .eq('id', sci.item_id);

                // Log transaction
                await supabase.from('transactions').insert({
                  item_id: sci.item_id,
                  transaction_type: 'stock_count',
                  quantity_before: sci.expected_quantity,
                  quantity_after: sci.counted_quantity,
                  quantity_change: sci.difference ?? 0,
                  reference_id: id,
                  reference_type: 'stock_count',
                  performed_by: user?.id,
                  item_name: sci.items?.name,
                  notes: `Stock count: ${stockCount?.name}`,
                  team_id: teamId ?? null,
                });
              }

              // Mark complete
              await supabase
                .from('stock_counts')
                .update({ status: 'complete', completed_at: new Date().toISOString() })
                .eq('id', id);

              await logActivity(user?.id, 'stock_count_completed', { details: { name: stockCount?.name }, teamId });

              setStockCount(prev => prev ? { ...prev, status: 'complete' } : prev);
              Alert.alert('Success', 'Stock count completed and inventory updated.');
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally {
              setApplying(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (!stockCount) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
        <Text style={{ color: colors.textSecondary }}>Stock count not found</Text>
      </SafeAreaView>
    );
  }

  const statusColor = getStockCountStatusColor(stockCount.status, colors);
  const countedCount = items.filter(i => i.counted_quantity != null).length;
  const totalItems = items.length;
  const progress = totalItems > 0 ? Math.round((countedCount / totalItems) * 100) : 0;
  const isComplete = stockCount.status === 'complete';

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="flex-row items-center px-5 py-3 gap-3">
        <TouchableOpacity onPress={() => router.back()} className="rounded-xl p-2" style={cardStyle}>
          <ArrowLeft color={colors.textPrimary} size={20} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-lg font-bold" numberOfLines={1} style={{ color: colors.textPrimary }}>
            {stockCount.name}
          </Text>
          <View className="flex-row items-center gap-2 mt-0.5">
            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${statusColor}22` }}>
              <Text className="text-xs font-semibold" style={{ color: statusColor }}>
                {getStockCountStatusLabel(stockCount.status)}
              </Text>
            </View>
            <Text className="text-xs" style={{ color: colors.textSecondary }}>
              {countedCount}/{totalItems} counted ({progress}%)
            </Text>
          </View>
        </View>
      </View>

      {/* Progress bar */}
      <View className="mx-5 mb-3 rounded-full overflow-hidden" style={{ height: 4, backgroundColor: colors.border }}>
        <View style={{ height: 4, width: `${progress}%` as any, backgroundColor: statusColor, borderRadius: 2 }} />
      </View>

      {/* Items */}
      <FlatList
        data={items}
        keyExtractor={(sci) => sci.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} />}
        renderItem={({ item: sci }) => {
          const counted = sci.counted_quantity;
          const diff = sci.difference ?? 0;
          const diffColor = diff > 0 ? colors.success : diff < 0 ? colors.destructive : colors.textSecondary;

          return (
            <View className="mb-3 rounded-2xl p-4" style={cardStyle}>
              <View className="flex-row items-start justify-between mb-3">
                <View className="flex-1">
                  <Text className="text-xs" style={{ color: colors.textSecondary }}>{sci.items?.sku || 'NO SKU'}</Text>
                  <Text className="font-semibold text-sm" style={{ color: colors.textPrimary }} numberOfLines={1}>
                    {sci.items?.name ?? 'Unknown'}
                  </Text>
                </View>
                {counted != null && diff !== 0 && (
                  <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${diffColor}22` }}>
                    <Text className="text-xs font-bold" style={{ color: diffColor }}>
                      {diff > 0 ? '+' : ''}{diff}
                    </Text>
                  </View>
                )}
              </View>

              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-xs" style={{ color: colors.textSecondary }}>Expected</Text>
                  <Text className="text-base font-bold" style={{ color: colors.textPrimary }}>{sci.expected_quantity}</Text>
                </View>

                <View className="items-center">
                  <Text className="text-xs mb-1" style={{ color: colors.textSecondary }}>Counted</Text>
                  <View className="flex-row items-center gap-2">
                    <TouchableOpacity
                      disabled={isComplete}
                      onPress={() => updateCount(sci, (counted ?? sci.expected_quantity) - 1)}
                      className="items-center justify-center rounded-lg"
                      style={{ width: 36, height: 36, backgroundColor: isComplete ? colors.border : colors.destructiveMuted }}>
                      <Minus color={isComplete ? colors.textSecondary : colors.destructive} size={16} />
                    </TouchableOpacity>
                    <Text className="text-lg font-bold min-w-[40px] text-center" style={{ color: colors.textPrimary }}>
                      {counted ?? '—'}
                    </Text>
                    <TouchableOpacity
                      disabled={isComplete}
                      onPress={() => updateCount(sci, (counted ?? sci.expected_quantity) + 1)}
                      className="items-center justify-center rounded-lg"
                      style={{ width: 36, height: 36, backgroundColor: isComplete ? colors.border : colors.successMuted }}>
                      <Plus color={isComplete ? colors.textSecondary : colors.success} size={16} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* Apply button */}
      {!isComplete && countedCount > 0 && (
        <View className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-3" style={{ backgroundColor: colors.background }}>
          <TouchableOpacity
            onPress={applyAdjustments}
            disabled={applying}
            className="rounded-xl py-3.5 flex-row items-center justify-center gap-2"
            style={{ backgroundColor: colors.accent }}>
            {applying ? (
              <ActivityIndicator color={colors.accentOnAccent} />
            ) : (
              <>
                <Check color={colors.accentOnAccent} size={18} />
                <Text className="text-base font-semibold" style={{ color: colors.accentOnAccent }}>
                  Apply Adjustments & Complete
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
