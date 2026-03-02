import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { PurchaseOrder } from '@/lib/types';
import { formatRelativeTime, getPOStatusColor, getPOStatusLabel } from '@/lib/utils';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Plus,
  Search,
  Truck,
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

const STATUS_FILTERS = ['all', 'draft', 'ordered', 'partially_received', 'received', 'cancelled'] as const;

export default function PurchaseOrderListScreen() {
  const { colors, isDark } = useTheme();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
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

  const loadOrders = useCallback(async () => {
    try {
      let query = supabase
        .from('purchase_orders')
        .select('*')
        .order('updated_at', { ascending: false });

      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (searchQuery.trim()) {
        query = query.or(`po_number.ilike.%${searchQuery}%,supplier_name.ilike.%${searchQuery}%`);
      }

      const { data } = await query;
      setOrders((data ?? []) as PurchaseOrder[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="px-5 pt-4 pb-3">
        <View className="mb-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity onPress={() => router.back()} className="rounded-xl p-2" style={cardStyle}>
              <ArrowLeft color={colors.textPrimary} size={20} />
            </TouchableOpacity>
            <Text className="text-xl font-bold" style={{ fontWeight: '800', color: colors.textPrimary }}>
              Purchase Orders
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/purchase-order/new')}
            className="flex-row items-center gap-1.5 rounded-xl px-3 py-2.5"
            style={{ backgroundColor: colors.accent }}>
            <Plus color={colors.accentOnAccent} size={16} />
            <Text className="text-sm font-semibold" style={{ color: colors.accentOnAccent }}>New</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View className="mb-3 flex-row items-center rounded-xl px-3 py-2.5" style={cardStyle}>
          <Search color={colors.textSecondary} size={16} />
          <TextInput
            className="ml-2 flex-1 text-sm"
            style={{ color: colors.textPrimary }}
            placeholder="Search PO number, supplier..."
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
                {s === 'all' ? 'All' : getPOStatusLabel(s)}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} className="mt-8" />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(po) => po.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOrders(); }} tintColor={colors.accent} />}
          ListEmptyComponent={
            <View className="items-center mt-12">
              <Truck color={colors.textSecondary} size={32} />
              <Text className="text-base font-semibold mt-3" style={{ color: colors.textPrimary }}>No purchase orders</Text>
              <Text className="text-sm mt-1" style={{ color: colors.textSecondary }}>Create a PO to track supplier orders</Text>
              <TouchableOpacity
                onPress={() => router.push('/purchase-order/new')}
                className="mt-4 rounded-xl px-5 py-2.5"
                style={{ backgroundColor: colors.accent }}>
                <Text className="font-semibold" style={{ color: colors.accentOnAccent }}>New Purchase Order</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item: po }) => {
            const statusColor = getPOStatusColor(po.status, colors);
            return (
              <TouchableOpacity
                onPress={() => router.push(`/purchase-order/${po.id}`)}
                className="mb-3 rounded-2xl p-4"
                style={cardStyle}>
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-row items-center gap-3 flex-1">
                    <View
                      className="items-center justify-center rounded-xl p-2.5"
                      style={{ backgroundColor: `${statusColor}22` }}>
                      <Truck color={statusColor} size={20} />
                    </View>
                    <View className="flex-1">
                      <Text className="font-bold text-sm" style={{ color: colors.accent }}>{po.po_number}</Text>
                      <Text className="font-semibold" style={{ color: colors.textPrimary }} numberOfLines={1}>{po.supplier_name}</Text>
                    </View>
                  </View>
                  <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: `${statusColor}22` }}>
                    <Text className="text-xs font-semibold" style={{ color: statusColor }}>
                      {getPOStatusLabel(po.status)}
                    </Text>
                  </View>
                </View>
                <Text className="text-xs" style={{ color: colors.textSecondary }}>
                  Updated {formatRelativeTime(po.updated_at)}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
