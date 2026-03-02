import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { Transaction, Folder } from '@/lib/types';
import { formatDate, formatRelativeTime, getTransactionTypeLabel } from '@/lib/utils';
import { router } from 'expo-router';
import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUp,
  Filter,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TYPE_FILTERS = ['all', 'pick', 'restock', 'adjustment', 'receive', 'stock_count'] as const;

export default function TransactionsScreen() {
  const { colors, isDark } = useTheme();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 30;

  const cardStyle = {
    backgroundColor: colors.surface,
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? colors.borderLight : 'transparent',
    ...getCardShadow(isDark),
  };

  const loadTransactions = useCallback(async (reset = false) => {
    try {
      const currentPage = reset ? 0 : page;
      let query = supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      if (typeFilter !== 'all') {
        query = query.eq('transaction_type', typeFilter);
      }

      const { data } = await query;
      const items = (data ?? []) as Transaction[];

      if (reset) {
        setTransactions(items);
        setPage(0);
      } else {
        setTransactions(prev => [...prev, ...items]);
      }
      setHasMore(items.length === PAGE_SIZE);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [typeFilter, page]);

  useEffect(() => {
    setLoading(true);
    setPage(0);
    loadTransactions(true);
  }, [typeFilter]);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(0);
    loadTransactions(true);
  };

  const loadMore = () => {
    if (!hasMore || loading) return;
    setPage(p => p + 1);
    loadTransactions(false);
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
          keyExtractor={(s) => s}
          renderItem={({ item: s }) => (
            <TouchableOpacity
              onPress={() => setTypeFilter(s)}
              className="mr-2 rounded-full px-3.5 py-1.5"
              style={{
                backgroundColor: typeFilter === s ? colors.accentMuted : colors.surface,
                borderWidth: 1,
                borderColor: typeFilter === s ? `${colors.accent}66` : colors.border,
              }}>
              <Text
                className="text-xs font-medium"
                style={{ color: typeFilter === s ? colors.accent : colors.textSecondary }}>
                {s === 'all' ? 'All' : getTransactionTypeLabel(s)}
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
          data={transactions}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          onEndReached={loadMore}
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
          renderItem={({ item: txn }) => {
            const isPositive = txn.quantity_change > 0;
            const changeColor = isPositive ? colors.success : txn.quantity_change < 0 ? colors.destructive : colors.textSecondary;
            return (
              <TouchableOpacity
                onPress={txn.item_id ? () => router.push(`/item/${txn.item_id}`) : undefined}
                className="mb-2 flex-row items-center rounded-2xl px-4 py-3"
                style={cardStyle}>
                <View
                  className="items-center justify-center rounded-xl mr-3"
                  style={{ width: 40, height: 40, backgroundColor: `${changeColor}22` }}>
                  {isPositive ? (
                    <ArrowUp color={changeColor} size={18} />
                  ) : (
                    <ArrowDown color={changeColor} size={18} />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-semibold" style={{ color: colors.accent }}>
                    {getTransactionTypeLabel(txn.transaction_type)}
                  </Text>
                  <Text className="font-medium text-sm" style={{ color: colors.textPrimary }} numberOfLines={1}>
                    {txn.item_name ?? 'Unknown Item'}
                  </Text>
                  {txn.folder_name && (
                    <Text className="text-xs" style={{ color: colors.textSecondary }}>
                      {txn.folder_name}
                    </Text>
                  )}
                </View>
                <View className="items-end">
                  <Text className="text-base font-bold" style={{ color: changeColor }}>
                    {isPositive ? '+' : ''}{txn.quantity_change}
                  </Text>
                  <Text className="text-xs" style={{ color: colors.textTertiary }}>
                    {formatRelativeTime(txn.created_at)}
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
