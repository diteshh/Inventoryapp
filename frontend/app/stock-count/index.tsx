import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { StockCount } from '@/lib/types';
import { formatRelativeTime, getStockCountStatusColor, getStockCountStatusLabel } from '@/lib/utils';
import { router } from 'expo-router';
import {
  ArrowLeft,
  ClipboardCheck,
  Plus,
  Search,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBadge } from '@/components/ui/Badge';

const STATUS_FILTERS = ['all', 'draft', 'in_progress', 'complete'] as const;

export default function StockCountListScreen() {
  const { colors, isDark } = useTheme();
  const [counts, setCounts] = useState<StockCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const cardStyle = {
    backgroundColor: colors.surface,
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? colors.borderLight : 'transparent',
    ...getCardShadow(isDark),
  };

  const loadCounts = useCallback(async () => {
    try {
      let query = supabase
        .from('stock_counts')
        .select('*')
        .order('updated_at', { ascending: false });

      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (searchQuery.trim()) query = query.ilike('name', `%${searchQuery}%`);

      const { data } = await query;
      setCounts((data ?? []) as StockCount[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="px-5 pt-4 pb-3">
        <View className="mb-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity onPress={() => router.back()} className="rounded-xl p-2" style={cardStyle}>
              <ArrowLeft color={colors.textPrimary} size={20} />
            </TouchableOpacity>
            <Text className="text-xl font-bold" style={{ fontWeight: '800', color: colors.textPrimary }}>
              Stock Counts
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/stock-count/new')}
            className="flex-row items-center gap-1.5 rounded-xl px-3 py-2.5"
            style={{ backgroundColor: colors.accent }}>
            <Plus color={colors.accentOnAccent} size={16} />
            <Text className="text-sm font-semibold" style={{ color: colors.accentOnAccent }}>New</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View
          className="mb-3 flex-row items-center rounded-xl px-3 py-2.5"
          style={cardStyle}>
          <Search color={colors.textSecondary} size={16} />
          <TextInput
            className="ml-2 flex-1 text-sm"
            style={{ color: colors.textPrimary }}
            placeholder="Search stock counts..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X color={colors.textSecondary} size={16} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Status filter */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_FILTERS}
          keyExtractor={(s) => s}
          renderItem={({ item: s }) => (
            <TouchableOpacity
              onPress={() => setStatusFilter(s)}
              className="mr-2 rounded-full px-3.5 py-1.5"
              style={{
                backgroundColor: statusFilter === s ? colors.accentMuted : colors.surface,
                borderWidth: 1,
                borderColor: statusFilter === s ? `${colors.accent}66` : colors.border,
              }}>
              <Text
                className="text-xs font-medium"
                style={{ color: statusFilter === s ? colors.accent : colors.textSecondary }}>
                {s === 'all' ? 'All' : getStockCountStatusLabel(s)}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} className="mt-8" />
      ) : (
        <FlatList
          data={counts}
          keyExtractor={(sc) => sc.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadCounts(); }} tintColor={colors.accent} />}
          ListEmptyComponent={
            <View className="items-center mt-12">
              <ClipboardCheck color={colors.textSecondary} size={32} />
              <Text className="text-base font-semibold mt-3" style={{ color: colors.textPrimary }}>No stock counts</Text>
              <Text className="text-sm mt-1" style={{ color: colors.textSecondary }}>Create a stock count to verify inventory</Text>
              <TouchableOpacity
                onPress={() => router.push('/stock-count/new')}
                className="mt-4 rounded-xl px-5 py-2.5"
                style={{ backgroundColor: colors.accent }}>
                <Text className="font-semibold" style={{ color: colors.accentOnAccent }}>New Stock Count</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item: sc }) => {
            const statusColor = getStockCountStatusColor(sc.status, colors);
            return (
              <TouchableOpacity
                onPress={() => router.push(`/stock-count/${sc.id}`)}
                className="mb-3 rounded-2xl p-4"
                style={cardStyle}>
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-row items-center gap-3 flex-1">
                    <View
                      className="items-center justify-center rounded-xl p-2.5"
                      style={{ backgroundColor: `${statusColor}22` }}>
                      <ClipboardCheck color={statusColor} size={20} />
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold" style={{ color: colors.textPrimary }} numberOfLines={2}>{sc.name}</Text>
                      {sc.notes && (
                        <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }} numberOfLines={1}>
                          {sc.notes}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View
                    className="rounded-full px-2.5 py-1"
                    style={{ backgroundColor: `${statusColor}22` }}>
                    <Text className="text-xs font-semibold" style={{ color: statusColor }}>
                      {getStockCountStatusLabel(sc.status)}
                    </Text>
                  </View>
                </View>
                <Text className="text-xs" style={{ color: colors.textSecondary }}>
                  Updated {formatRelativeTime(sc.updated_at)}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
