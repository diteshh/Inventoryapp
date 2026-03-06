import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { ActivityLog } from '@/lib/types';
import { formatRelativeTime, getActionLabel } from '@/lib/utils';
import { router, useFocusEffect } from 'expo-router';
import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUp,
  Minus,
} from 'lucide-react-native';
import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TYPE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'quantity_adjusted', label: 'Qty Changes' },
  { key: 'item_picked', label: 'Picks' },
  { key: 'item_created', label: 'Created' },
  { key: 'item_deleted', label: 'Deleted' },
] as const;

type FilterKey = (typeof TYPE_FILTERS)[number]['key'];

export default function TransactionsScreen() {
  const { colors, isDark } = useTheme();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<FilterKey>('all');
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  const PAGE_SIZE = 30;

  const cardStyle = {
    backgroundColor: colors.surface,
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? colors.borderLight : 'transparent',
    ...getCardShadow(isDark),
  };

  // Only fetch activity_log entries related to item movements
  const MOVEMENT_ACTIONS = ['quantity_adjusted', 'item_picked', 'item_created', 'item_deleted'];

  const load = async (reset = false) => {
    try {
      const currentPage = reset ? 0 : pageRef.current;
      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('activity_log')
        .select('*')
        .order('timestamp', { ascending: false })
        .range(from, to);

      if (typeFilter === 'all') {
        query = query.in('action_type', MOVEMENT_ACTIONS);
      } else {
        query = query.eq('action_type', typeFilter);
      }

      const { data, error } = await query;
      if (error) console.error('transactions query error:', error);
      const rows = (data ?? []) as ActivityLog[];

      if (reset) {
        setLogs(rows);
        pageRef.current = 1;
      } else {
        setLogs(prev => [...prev, ...rows]);
        pageRef.current += 1;
      }
      setHasMore(rows.length === PAGE_SIZE);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      pageRef.current = 0;
      load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [typeFilter])
  );

  const onRefresh = () => {
    setRefreshing(true);
    pageRef.current = 0;
    load(true);
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="flex-row items-center px-5 py-3 gap-3">
        <TouchableOpacity onPress={() => router.back()} className="rounded-xl p-2" style={cardStyle}>
          <ArrowLeft color={colors.textPrimary} size={20} />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold" style={{ color: colors.textPrimary }}>
          Transactions
        </Text>
        <View className="rounded-xl p-2" style={{ backgroundColor: colors.accentMuted }}>
          <ArrowLeftRight color={colors.accent} size={20} />
        </View>
      </View>

      {/* Type filter chips */}
      <View className="px-5 mb-3">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={TYPE_FILTERS}
          keyExtractor={(s) => s.key}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              onPress={() => setTypeFilter(f.key)}
              className="mr-2 rounded-full px-3.5 py-1.5"
              style={{
                backgroundColor: typeFilter === f.key ? colors.accentMuted : colors.surface,
                borderWidth: 1,
                borderColor: typeFilter === f.key ? `${colors.accent}66` : colors.border,
              }}>
              <Text
                className="text-xs font-medium"
                style={{ color: typeFilter === f.key ? colors.accent : colors.textSecondary }}>
                {f.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Transaction list */}
      {loading ? (
        <ActivityIndicator color={colors.accent} className="mt-8" />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          onEndReached={() => hasMore && load()}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View className="items-center mt-12">
              <ArrowLeftRight color={colors.textSecondary} size={32} />
              <Text className="text-base font-semibold mt-3" style={{ color: colors.textPrimary }}>No transactions</Text>
              <Text className="text-sm mt-1 text-center" style={{ color: colors.textSecondary }}>
                Transactions are recorded when inventory quantities change
              </Text>
            </View>
          }
          renderItem={({ item: log }) => {
            const details = log.details as Record<string, any> | null;
            const itemName = (details?.item_name ?? details?.name) as string | undefined;
            const oldQty = details?.old_qty as number | undefined;
            const newQty = details?.new_qty as number | undefined;
            const quantity = details?.quantity as number | undefined;
            const change = oldQty != null && newQty != null ? newQty - oldQty : null;
            const isPositive = change != null ? change > 0 : false;
            const isNegative = change != null ? change < 0 : log.action_type === 'item_picked' || log.action_type === 'item_deleted';
            const changeColor = isPositive ? colors.success : isNegative ? colors.destructive : colors.textSecondary;

            return (
              <TouchableOpacity
                onPress={log.item_id ? () => router.push(`/item/${log.item_id}`) : undefined}
                activeOpacity={log.item_id ? 0.7 : 1}
                className="mb-2 flex-row items-center rounded-2xl px-4 py-3"
                style={cardStyle}>
                <View
                  className="items-center justify-center rounded-xl mr-3"
                  style={{ width: 40, height: 40, backgroundColor: `${changeColor}22` }}>
                  {isPositive ? (
                    <ArrowUp color={changeColor} size={18} />
                  ) : isNegative ? (
                    <ArrowDown color={changeColor} size={18} />
                  ) : (
                    <Minus color={changeColor} size={18} />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-semibold" style={{ color: colors.accent }}>
                    {getActionLabel(log.action_type)}
                  </Text>
                  <Text className="font-medium text-sm" style={{ color: colors.textPrimary }} numberOfLines={1}>
                    {itemName ?? 'Unknown Item'}
                  </Text>
                  {details?.reason && (
                    <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }} numberOfLines={1}>
                      {details.reason}
                    </Text>
                  )}
                </View>
                <View className="items-end">
                  {change != null ? (
                    <Text className="text-base font-bold" style={{ color: changeColor }}>
                      {isPositive ? '+' : ''}{change}
                    </Text>
                  ) : quantity != null ? (
                    <Text className="text-base font-bold" style={{ color: changeColor }}>
                      {log.action_type === 'item_picked' ? `-${quantity}` : String(quantity)}
                    </Text>
                  ) : null}
                  {oldQty != null && newQty != null && (
                    <Text className="text-[10px]" style={{ color: colors.textSecondary }}>
                      {oldQty} → {newQty}
                    </Text>
                  )}
                  <Text className="text-xs" style={{ color: colors.textSecondary }}>
                    {formatRelativeTime(log.timestamp)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
