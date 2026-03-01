import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { ActivityLog, Item, PickList } from '@/lib/types';
import { formatRelativeTime, getActionLabel, getPickListStatusColor } from '@/lib/utils';
import { router } from 'expo-router';
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  Package,
  Plus,
  QrCode,
  TrendingUp,
  Activity,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
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

export default function HomeScreen() {
  const { user, profile } = useAuth();
  const { colors, isDark } = useTheme();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [activePickLists, setActivePickLists] = useState<PickList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [itemsRes, pickListsRes, activityRes] = await Promise.all([
        supabase.from('items').select('id, quantity, min_quantity, sell_price, cost_price').eq('status', 'active'),
        supabase.from('pick_lists').select('*').in('status', ['ready_to_pick', 'in_progress', 'partially_complete']).order('updated_at', { ascending: false }).limit(5),
        supabase.from('activity_log').select('*').order('timestamp', { ascending: false }).limit(10),
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
      setRecentActivity((activityRes.data ?? []) as ActivityLog[]);
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

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
          <TouchableOpacity
            onPress={() => router.push('/item/add')}
            className="flex-1 items-center justify-center rounded-2xl py-4 gap-2"
            style={{ backgroundColor: colors.accent }}>
            <Plus color={colors.accentOnAccent} size={22} />
            <Text className="text-xs font-semibold" style={{ color: colors.accentOnAccent }}>Add Item</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/scanner')}
            className="flex-1 items-center justify-center rounded-2xl py-4 gap-2"
            style={{ ...cardStyle }}>
            <QrCode color={colors.accent} size={22} />
            <Text className="text-xs font-semibold" style={{ color: colors.textPrimary }}>Scan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/pick-list/new')}
            className="flex-1 items-center justify-center rounded-2xl py-4 gap-2"
            style={{ ...cardStyle }}>
            <ClipboardList color={colors.accent} size={22} />
            <Text className="text-xs font-semibold" style={{ color: colors.textPrimary }}>Pick List</Text>
          </TouchableOpacity>
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
                  onPress={() => router.push('/(tabs)/inventory?filter=low_stock')}
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

        {/* Active Pick Lists */}
        {activePickLists.length > 0 && (
          <View className="mx-5 mb-5">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>Active Pick Lists</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/pick-lists')}>
                <Text className="text-sm" style={{ color: colors.accent }}>View all</Text>
              </TouchableOpacity>
            </View>
            {activePickLists.map((pl) => {
              const statusColor = getPickListStatusColor(pl.status, colors);
              return (
                <TouchableOpacity
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
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Recent Activity */}
        <View className="mx-5 mb-8">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/more')}>
              <Text className="text-sm" style={{ color: colors.accent }}>View log</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <>
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </>
          ) : recentActivity.length === 0 ? (
            <View
              className="items-center rounded-2xl py-8"
              style={{ backgroundColor: colors.surface }}>
              <Activity color={colors.textSecondary} size={28} />
              <Text className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                No activity yet
              </Text>
            </View>
          ) : (
            recentActivity.map((log) => (
              <ActivityItem key={log.id} log={log} colors={colors} isDark={isDark} />
            ))
          )}
        </View>
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
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
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
    </TouchableOpacity>
  );
}

function ActivityItem({ log, colors, isDark }: { log: ActivityLog; colors: any; isDark: boolean }) {
  return (
    <View
      className="mb-2 flex-row items-center rounded-xl px-4 py-3"
      style={{
        backgroundColor: colors.surface,
        ...getCardShadow(isDark),
      }}>
      <View
        className="mr-3 items-center justify-center rounded-lg p-2"
        style={{ backgroundColor: colors.accentMuted }}>
        <Activity color={colors.accent} size={14} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>{getActionLabel(log.action_type)}</Text>
        {(log.details as any)?.item_name && (
          <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }} numberOfLines={1}>
            {(log.details as any).item_name}
          </Text>
        )}
      </View>
      <Text className="text-xs" style={{ color: colors.textSecondary }}>
        {formatRelativeTime(log.timestamp)}
      </Text>
    </View>
  );
}
