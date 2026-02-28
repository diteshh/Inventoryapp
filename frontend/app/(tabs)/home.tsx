import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/lib/theme';
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
  ActivityIndicator,
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

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.navy }}>
      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.teal} />}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-5 pt-4 pb-2">
          <Text className="text-sm" style={{ color: COLORS.textSecondary }}>
            {greeting()},
          </Text>
          <Text className="text-2xl font-bold text-white" style={{ fontWeight: '800' }}>
            {profile?.full_name?.split(' ')[0] ?? 'Warehouse Team'}
          </Text>
        </View>

        {/* Quick Actions */}
        <View className="mx-5 mb-5 mt-4 flex-row gap-3">
          <QuickAction
            label="Add Item"
            icon={<Plus color={COLORS.navy} size={22} />}
            onPress={() => router.push('/item/add')}
            primary
          />
          <QuickAction
            label="Scan"
            icon={<QrCode color={COLORS.teal} size={22} />}
            onPress={() => router.push('/(tabs)/scanner')}
          />
          <QuickAction
            label="Pick List"
            icon={<ClipboardList color={COLORS.teal} size={22} />}
            onPress={() => router.push('/pick-list/new')}
          />
        </View>

        {/* Stats Grid */}
        <View className="mx-5 mb-5">
          <Text className="mb-3 text-base font-semibold text-white">Overview</Text>
          {loading ? (
            <View className="flex-row gap-3">
              <View className="flex-1"><CardSkeleton /></View>
              <View className="flex-1"><CardSkeleton /></View>
            </View>
          ) : (
            <>
              <View className="mb-3 flex-row gap-3">
                <StatCard
                  label="Total Items"
                  value={stats?.totalItems ?? 0}
                  icon={<Package color={COLORS.teal} size={20} />}
                  onPress={() => router.push('/(tabs)/inventory')}
                />
                <StatCard
                  label="Total Value"
                  value={`£${(stats?.totalValue ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                  icon={<TrendingUp color="#22C55E" size={20} />}
                  iconBg="#22C55E22"
                />
              </View>
              <View className="flex-row gap-3">
                <StatCard
                  label="Low Stock"
                  value={stats?.lowStockCount ?? 0}
                  icon={<AlertTriangle color={COLORS.warning} size={20} />}
                  iconBg={`${COLORS.warning}22`}
                  highlight={stats?.lowStockCount ? true : false}
                  onPress={() => router.push('/(tabs)/inventory?filter=low_stock')}
                />
                <StatCard
                  label="Active Picks"
                  value={stats?.activePickLists ?? 0}
                  icon={<ClipboardList color="#3B82F6" size={20} />}
                  iconBg="#3B82F622"
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
              <Text className="text-base font-semibold text-white">Active Pick Lists</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/pick-lists')}>
                <Text className="text-sm" style={{ color: COLORS.teal }}>
                  View all
                </Text>
              </TouchableOpacity>
            </View>
            {activePickLists.map((pl) => (
              <TouchableOpacity
                key={pl.id}
                onPress={() => router.push(`/pick-list/${pl.id}`)}
                className="mb-3 flex-row items-center justify-between rounded-2xl p-4"
                style={{ backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.border }}>
                <View className="flex-row items-center gap-3">
                  <View
                    className="items-center justify-center rounded-xl p-2.5"
                    style={{ backgroundColor: `${getPickListStatusColor(pl.status)}22` }}>
                    <ClipboardList color={getPickListStatusColor(pl.status)} size={18} />
                  </View>
                  <View>
                    <Text className="font-semibold text-white" numberOfLines={1}>{pl.name}</Text>
                    <Text className="text-xs mt-0.5" style={{ color: COLORS.textSecondary }}>
                      {formatRelativeTime(pl.updated_at)}
                    </Text>
                  </View>
                </View>
                <View
                  className="rounded-full px-2.5 py-1"
                  style={{ backgroundColor: `${getPickListStatusColor(pl.status)}22` }}>
                  <Text style={{ color: getPickListStatusColor(pl.status), fontSize: 11, fontWeight: '600' }}>
                    {pl.status.replace(/_/g, ' ')}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Recent Activity */}
        <View className="mx-5 mb-8">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-white">Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/more')}>
              <Text className="text-sm" style={{ color: COLORS.teal }}>
                View log
              </Text>
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
              style={{ backgroundColor: COLORS.navyCard }}>
              <Activity color={COLORS.textSecondary} size={28} />
              <Text className="mt-2 text-sm" style={{ color: COLORS.textSecondary }}>
                No activity yet
              </Text>
            </View>
          ) : (
            recentActivity.map((log) => (
              <ActivityItem key={log.id} log={log} />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({
  label,
  icon,
  onPress,
  primary,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-1 items-center justify-center rounded-2xl py-4 gap-2"
      style={{
        backgroundColor: primary ? COLORS.teal : COLORS.navyCard,
        borderWidth: primary ? 0 : 1,
        borderColor: COLORS.border,
      }}>
      {icon}
      <Text
        className="text-xs font-semibold"
        style={{ color: primary ? COLORS.navy : COLORS.textPrimary }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function StatCard({
  label,
  value,
  icon,
  iconBg,
  highlight,
  onPress,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  iconBg?: string;
  highlight?: boolean;
  onPress?: () => void;
}) {
  const bg = iconBg ?? `${COLORS.teal}22`;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      className="flex-1 rounded-2xl p-4"
      style={{
        backgroundColor: COLORS.navyCard,
        borderWidth: 1,
        borderColor: highlight ? `${COLORS.warning}44` : COLORS.border,
      }}>
      <View className="mb-3 self-start rounded-xl p-2" style={{ backgroundColor: bg }}>
        {icon}
      </View>
      <Text className="text-2xl font-bold text-white" style={{ fontWeight: '800' }}>
        {value}
      </Text>
      <Text className="mt-1 text-xs" style={{ color: COLORS.textSecondary }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function ActivityItem({ log }: { log: ActivityLog }) {
  return (
    <View
      className="mb-2 flex-row items-center rounded-xl px-4 py-3"
      style={{ backgroundColor: COLORS.navyCard }}>
      <View
        className="mr-3 items-center justify-center rounded-lg p-2"
        style={{ backgroundColor: `${COLORS.teal}22` }}>
        <Activity color={COLORS.teal} size={14} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-medium text-white">{getActionLabel(log.action_type)}</Text>
        {(log.details as any)?.item_name && (
          <Text className="text-xs mt-0.5" style={{ color: COLORS.textSecondary }} numberOfLines={1}>
            {(log.details as any).item_name}
          </Text>
        )}
      </View>
      <Text className="text-xs" style={{ color: COLORS.textSecondary }}>
        {formatRelativeTime(log.timestamp)}
      </Text>
    </View>
  );
}
