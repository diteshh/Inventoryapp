import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { Item, PickList } from '@/lib/types';
import { formatRelativeTime, getPickListStatusColor } from '@/lib/utils';
import { router, useFocusEffect } from 'expo-router';
import {
  AlertTriangle,
  ClipboardList,
  Package,
  Plus,
  QrCode,
  TrendingUp,
  Trophy,
} from 'lucide-react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CardSkeleton } from '@/components/ui/Skeleton';

interface DashboardStats {
  totalItems: number;
  totalValue: number;
  lowStockCount: number;
  activePickLists: number;
}

type SellerPeriod = '7d' | '14d' | '30d' | 'custom';

interface TopSeller {
  itemId: string;
  itemName: string;
  unitsSold: number;
}

export default function HomeScreen() {
  const { user, profile } = useAuth();
  const { colors, isDark } = useTheme();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activePickLists, setActivePickLists] = useState<PickList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [topSellers, setTopSellers] = useState<TopSeller[]>([]);
  const [sellerPeriod, setSellerPeriod] = useState<SellerPeriod>('7d');
  const [customStart, setCustomStart] = useState<Date>(new Date());
  const [customEnd, setCustomEnd] = useState<Date>(new Date());
  const [showCustomDates, setShowCustomDates] = useState(false);
  const [showPicker, setShowPicker] = useState<'start' | 'end' | null>(null);

  const getDateRange = useCallback((period: SellerPeriod): { start: Date; end: Date } | null => {
    const end = new Date();
    const start = new Date();
    if (period === '7d') start.setDate(end.getDate() - 7);
    else if (period === '14d') start.setDate(end.getDate() - 14);
    else if (period === '30d') start.setDate(end.getDate() - 30);
    else return null;
    return { start, end };
  }, []);

  const loadTopSellers = useCallback(async (startDate: Date, endDate: Date) => {
    try {
      const { data, error } = await supabase
        .from('pick_list_items')
        .select('item_id, quantity_picked, picked_at, items!inner(name)')
        .gt('quantity_picked', 0)
        .gte('picked_at', startDate.toISOString())
        .lte('picked_at', endDate.toISOString());

      if (error) throw error;

      const grouped: Record<string, { itemName: string; unitsSold: number }> = {};
      for (const row of data ?? []) {
        if (!row.item_id) continue;
        const itemName = (row.items as any)?.name ?? 'Unknown';
        if (!grouped[row.item_id]) {
          grouped[row.item_id] = { itemName, unitsSold: 0 };
        }
        grouped[row.item_id].unitsSold += row.quantity_picked ?? 0;
      }

      const sorted = Object.entries(grouped)
        .map(([itemId, v]) => ({ itemId, itemName: v.itemName, unitsSold: v.unitsSold }))
        .sort((a, b) => b.unitsSold - a.unitsSold)
        .slice(0, 10);

      setTopSellers(sorted);
    } catch (e) {
      console.error('Top sellers load error:', e);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [itemsRes, pickListsRes] = await Promise.all([
        supabase.from('items').select('id, quantity, min_quantity, sell_price, cost_price').eq('status', 'active'),
        supabase.from('pick_lists').select('*').in('status', ['ready_to_pick', 'in_progress', 'partially_complete']).order('updated_at', { ascending: false }).limit(5),
      ]);

      const items = (itemsRes.data ?? []) as Pick<Item, 'id' | 'quantity' | 'min_quantity' | 'sell_price' | 'cost_price'>[];
      const totalValue = items.reduce((sum, i) => sum + (i.sell_price ?? i.cost_price ?? 0) * i.quantity, 0);
      const lowStock = items.filter((i) => i.quantity <= i.min_quantity);

      setStats({
        totalItems: items.length,
        totalValue,
        lowStockCount: lowStock.length,
        activePickLists: (pickListsRes.data ?? []).length,
      });
      setActivePickLists((pickListsRes.data ?? []) as PickList[]);

      const range = getDateRange(sellerPeriod);
      if (range) {
        await loadTopSellers(range.start, range.end);
      }
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sellerPeriod, getDateRange, loadTopSellers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handlePeriodChange = useCallback((period: SellerPeriod) => {
    setSellerPeriod(period);
    if (period === 'custom') {
      setShowCustomDates(true);
      return;
    }
    setShowCustomDates(false);
    const range = getDateRange(period);
    if (range) loadTopSellers(range.start, range.end);
  }, [getDateRange, loadTopSellers]);

  const formatDate = (date: Date) => {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
  };

  const onPickerChange = useCallback((event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowPicker(null);
    if (event.type === 'dismissed') {
      setShowPicker(null);
      return;
    }
    if (!selectedDate) return;
    if (showPicker === 'start') {
      setCustomStart(selectedDate);
      if (selectedDate > customEnd) setCustomEnd(selectedDate);
    } else if (showPicker === 'end') {
      setCustomEnd(selectedDate);
      if (selectedDate < customStart) setCustomStart(selectedDate);
    }
    if (Platform.OS === 'android') {
      // Auto-apply on Android after both dates selected
      const start = showPicker === 'start' ? selectedDate : customStart;
      const end = showPicker === 'end' ? selectedDate : customEnd;
      const endOfDay = new Date(end);
      endOfDay.setHours(23, 59, 59, 999);
      loadTopSellers(start, endOfDay);
    }
  }, [showPicker, customStart, customEnd, loadTopSellers]);

  const applyCustomDates = useCallback(() => {
    if (customStart > customEnd) {
      Alert.alert('Invalid Range', 'Start date must be before end date.');
      return;
    }
    const endOfDay = new Date(customEnd);
    endOfDay.setHours(23, 59, 59, 999);
    loadTopSellers(customStart, endOfDay);
  }, [customStart, customEnd, loadTopSellers]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const cardStyle = {
    backgroundColor: colors.surface,
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? colors.borderLight : 'transparent',
    ...getCardShadow(isDark),
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-5 pt-4 pb-2">
          <Text className="text-sm" style={{ color: colors.textSecondary }}>
            {greeting()},
          </Text>
          <Text className="text-2xl font-bold" style={{ color: colors.textPrimary, fontWeight: '700', letterSpacing: -0.3 }}>
            {profile?.full_name?.split(' ')[0] ?? 'Warehouse Team'}
          </Text>
        </View>

        {/* Quick Actions */}
        <View className="mx-5 mb-5 mt-4 flex-row gap-3">
          <Pressable
            onPress={() => router.push('/item/add')}
            className="flex-1 items-center justify-center rounded-2xl py-4 gap-2"
            style={{ backgroundColor: colors.accent }}>
            <Plus color={colors.accentOnAccent} size={22} />
            <Text className="text-xs font-semibold" style={{ color: colors.accentOnAccent }}>Add Item</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(tabs)/scanner')}
            className="flex-1 items-center justify-center rounded-2xl py-4 gap-2"
            style={{ ...cardStyle }}>
            <QrCode color={colors.accent} size={22} />
            <Text className="text-xs font-semibold" style={{ color: colors.textPrimary }}>Scan</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/pick-list/')}
            className="flex-1 items-center justify-center rounded-2xl py-4 gap-2"
            style={{ ...cardStyle }}>
            <ClipboardList color={colors.accent} size={22} />
            <Text className="text-xs font-semibold" style={{ color: colors.textPrimary }}>Pick List</Text>
          </Pressable>
        </View>

        {/* Stats Grid */}
        <View className="mx-5 mb-5">
          <Text className="mb-3 text-base font-semibold" style={{ color: colors.textPrimary }}>Overview</Text>
          {loading ? (
            <View className="flex-row gap-3">
              <View className="flex-1"><CardSkeleton /></View>
              <View className="flex-1"><CardSkeleton /></View>
            </View>
          ) : (
            <>
              <View className="mb-3 flex-row gap-3">
                <StatCard
                  colors={colors}
                  isDark={isDark}
                  label="Total Items"
                  value={stats?.totalItems ?? 0}
                  icon={<Package color={colors.accent} size={20} />}
                  iconBg={colors.accentMuted}
                  onPress={() => router.push('/(tabs)/inventory')}
                />
                <StatCard
                  colors={colors}
                  isDark={isDark}
                  label="Total Value"
                  value={`£${(stats?.totalValue ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                  icon={<TrendingUp color={colors.success} size={20} />}
                  iconBg={colors.successMuted}
                />
              </View>
              <View className="flex-row gap-3">
                <StatCard
                  colors={colors}
                  isDark={isDark}
                  label="Low Stock"
                  value={stats?.lowStockCount ?? 0}
                  icon={<AlertTriangle color={colors.warning} size={20} />}
                  iconBg={colors.warningMuted}
                  highlight={stats?.lowStockCount ? true : false}
                  onPress={() => router.push('/low-stock')}
                />
                <StatCard
                  colors={colors}
                  isDark={isDark}
                  label="Active Picks"
                  value={stats?.activePickLists ?? 0}
                  icon={<ClipboardList color={colors.statusReady} size={20} />}
                  iconBg={`${colors.statusReady}22`}
                  onPress={() => router.push('/(tabs)/pick-lists')}
                />
              </View>
            </>
          )}
        </View>

        {/* Top Sellers */}
        <View className="mx-5 mb-5">
          <View className="mb-3 flex-row items-center gap-2">
            <Trophy color={colors.accent} size={18} />
            <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>Top Sellers</Text>
          </View>

          {/* Period filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3" style={{ marginHorizontal: -4 }}>
            {([
              { key: '7d' as SellerPeriod, label: '7 Days' },
              { key: '14d' as SellerPeriod, label: '14 Days' },
              { key: '30d' as SellerPeriod, label: '1 Month' },
              { key: 'custom' as SellerPeriod, label: 'Custom' },
            ]).map((chip) => {
              const active = sellerPeriod === chip.key;
              return (
                <Pressable
                  key={chip.key}
                  onPress={() => handlePeriodChange(chip.key)}
                  className="rounded-full px-4 py-2 mx-1"
                  style={{
                    backgroundColor: active ? colors.accent : colors.surface,
                    borderWidth: active ? 0 : isDark ? 1 : 0,
                    borderColor: isDark ? colors.borderLight : 'transparent',
                  }}>
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: active ? colors.accentOnAccent : colors.textSecondary }}>
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Custom date pickers */}
          {showCustomDates && (
            <View className="mb-3">
              <View className="flex-row items-center gap-2 mb-2">
                <Pressable
                  onPress={() => setShowPicker('start')}
                  className="flex-1 rounded-xl px-3 py-3"
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: isDark ? 1 : 0,
                    borderColor: isDark ? colors.borderLight : 'transparent',
                  }}>
                  <Text className="text-xs mb-0.5" style={{ color: colors.textSecondary }}>From</Text>
                  <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>{formatDate(customStart)}</Text>
                </Pressable>
                <Pressable
                  onPress={() => setShowPicker('end')}
                  className="flex-1 rounded-xl px-3 py-3"
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: isDark ? 1 : 0,
                    borderColor: isDark ? colors.borderLight : 'transparent',
                  }}>
                  <Text className="text-xs mb-0.5" style={{ color: colors.textSecondary }}>To</Text>
                  <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>{formatDate(customEnd)}</Text>
                </Pressable>
                <Pressable
                  onPress={applyCustomDates}
                  className="rounded-xl px-4 py-3"
                  style={{ backgroundColor: colors.accent }}>
                  <Text className="text-xs font-semibold" style={{ color: colors.accentOnAccent }}>Go</Text>
                </Pressable>
              </View>
              {showPicker && (
                <View className="rounded-xl overflow-hidden" style={{ backgroundColor: colors.surface }}>
                  <DateTimePicker
                    value={showPicker === 'start' ? customStart : customEnd}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    maximumDate={new Date()}
                    onChange={onPickerChange}
                    themeVariant={isDark ? 'dark' : 'light'}
                  />
                  {Platform.OS === 'ios' && (
                    <View className="flex-row justify-end px-3 pb-2">
                      <Pressable onPress={() => setShowPicker(null)} className="px-4 py-2">
                        <Text className="text-sm font-semibold" style={{ color: colors.accent }}>Done</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Top sellers list */}
          {loading ? (
            <>
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </>
          ) : topSellers.length === 0 ? (
            <View
              className="items-center rounded-2xl py-8"
              style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent' }}>
              <Trophy color={colors.textSecondary} size={28} />
              <Text className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                No sales data for this period
              </Text>
            </View>
          ) : (
            topSellers.map((seller, index) => {
              const rank = index + 1;
              const medalColor = rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : colors.accent;
              return (
                <Pressable
                  key={seller.itemId}
                  onPress={() => router.push(`/item/${seller.itemId}`)}
                  className="mb-2 flex-row items-center rounded-xl px-4 py-3"
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: isDark ? 1 : 0,
                    borderColor: isDark ? colors.borderLight : 'transparent',
                    ...getCardShadow(isDark),
                  }}>
                  <View
                    className="mr-3 items-center justify-center rounded-full"
                    style={{ width: 30, height: 30, backgroundColor: `${medalColor}22` }}>
                    <Text style={{ color: medalColor, fontSize: 13, fontWeight: '800' }}>{rank}</Text>
                  </View>
                  <Text className="flex-1 text-sm font-medium" style={{ color: colors.textPrimary }} numberOfLines={1}>
                    {seller.itemName}
                  </Text>
                  <Text className="text-sm font-semibold" style={{ color: colors.textSecondary }}>
                    {seller.unitsSold} sold
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>

        {/* Active Pick Lists */}
        {activePickLists.length > 0 && (
          <View className="mx-5 mb-8">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>Active Pick Lists</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/pick-lists')}>
                <Text className="text-sm" style={{ color: colors.accent }}>View all</Text>
              </TouchableOpacity>
            </View>
            {activePickLists.map((pl) => {
              const statusColor = getPickListStatusColor(pl.status, colors);
              return (
                <Pressable
                  key={pl.id}
                  onPress={() => router.push(`/pick-list/${pl.id}`)}
                  className="mb-3 flex-row items-center justify-between rounded-2xl p-4"
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: isDark ? 1 : 0,
                    borderColor: isDark ? colors.borderLight : 'transparent',
                    ...getCardShadow(isDark),
                  }}>
                  <View className="flex-row items-center gap-3">
                    <View
                      className="items-center justify-center rounded-xl p-2.5"
                      style={{ backgroundColor: `${statusColor}22` }}>
                      <ClipboardList color={statusColor} size={18} />
                    </View>
                    <View>
                      <Text className="font-semibold" style={{ color: colors.textPrimary }} numberOfLines={1}>{pl.name}</Text>
                      <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
                        {formatRelativeTime(pl.updated_at)}
                      </Text>
                    </View>
                  </View>
                  <View
                    className="rounded-full px-2.5 py-1"
                    style={{ backgroundColor: `${statusColor}22` }}>
                    <Text style={{ color: statusColor, fontSize: 11, fontWeight: '600' }}>
                      {pl.status.replace(/_/g, ' ')}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  icon,
  iconBg,
  highlight,
  onPress,
  colors,
  isDark,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  iconBg: string;
  highlight?: boolean;
  onPress?: () => void;
  colors: any;
  isDark: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 rounded-2xl p-4"
      style={{
        backgroundColor: colors.surface,
        borderWidth: isDark ? 1 : 0,
        borderColor: highlight ? `${colors.warning}44` : isDark ? colors.borderLight : 'transparent',
        ...getCardShadow(isDark),
      }}>
      <View className="mb-3 self-start rounded-xl p-2" style={{ backgroundColor: iconBg }}>
        {icon}
      </View>
      <Text className="text-2xl font-bold" style={{ color: colors.textPrimary, fontWeight: '800' }}>
        {value}
      </Text>
      <Text className="mt-1 text-xs" style={{ color: colors.textSecondary }}>
        {label}
      </Text>
    </Pressable>
  );
}

