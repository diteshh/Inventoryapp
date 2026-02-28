import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/lib/theme';
import { router } from 'expo-router';
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  LogOut,
  Package,
  Settings,
  Tag,
  User,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface QuickStat {
  label: string;
  value: number;
  color: string;
}

export default function MoreScreen() {
  const { user, profile, signOut } = useAuth();
  const [stats, setStats] = useState<{ lowStock: number; outOfStock: number; activityToday: number } | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [itemsRes, activityRes] = await Promise.all([
        supabase.from('items').select('quantity, min_quantity').eq('status', 'active'),
        supabase
          .from('activity_log')
          .select('id', { count: 'exact', head: true })
          .gte('timestamp', today.toISOString()),
      ]);

      const items = itemsRes.data ?? [];
      const lowStock = items.filter((i) => i.quantity > 0 && i.quantity <= i.min_quantity).length;
      const outOfStock = items.filter((i) => i.quantity === 0).length;

      setStats({
        lowStock,
        outOfStock,
        activityToday: activityRes.count ?? 0,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => signOut(),
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.navy }}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 pt-4 pb-3">
          <Text className="text-xl font-bold text-white" style={{ fontWeight: '800' }}>
            More
          </Text>
        </View>

        {/* Profile card */}
        <TouchableOpacity
          onPress={() => router.push('/settings')}
          className="mx-5 mb-4 flex-row items-center gap-4 rounded-2xl p-4"
          style={{ backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.border }}>
          <View
            className="items-center justify-center rounded-2xl"
            style={{ width: 52, height: 52, backgroundColor: `${COLORS.teal}22` }}>
            <User color={COLORS.teal} size={26} />
          </View>
          <View className="flex-1">
            <Text className="font-bold text-white text-base">
              {profile?.full_name ?? 'User'}
            </Text>
            <Text className="text-sm mt-0.5" style={{ color: COLORS.textSecondary }}>
              {user?.email}
            </Text>
            <View
              className="mt-1.5 self-start rounded-full px-2.5 py-0.5"
              style={{ backgroundColor: `${COLORS.teal}22` }}>
              <Text className="text-xs font-semibold capitalize" style={{ color: COLORS.teal }}>
                {profile?.role ?? 'member'}
              </Text>
            </View>
          </View>
          <ChevronRight color={COLORS.textSecondary} size={18} />
        </TouchableOpacity>

        {/* Quick stats */}
        <View className="mx-5 mb-4">
          <Text className="mb-3 text-sm font-semibold" style={{ color: COLORS.textSecondary }}>
            ALERTS
          </Text>
          {loadingStats ? (
            <ActivityIndicator color={COLORS.teal} />
          ) : (
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => router.push('/low-stock')}
                className="flex-1 rounded-2xl p-4"
                style={{
                  backgroundColor: COLORS.navyCard,
                  borderWidth: 1,
                  borderColor: stats?.lowStock || stats?.outOfStock ? `${COLORS.warning}44` : COLORS.border,
                }}>
                <View
                  className="mb-3 self-start rounded-xl p-2"
                  style={{ backgroundColor: `${COLORS.warning}22` }}>
                  <AlertTriangle color={COLORS.warning} size={18} />
                </View>
                <Text className="text-2xl font-bold text-white" style={{ fontWeight: '800' }}>
                  {(stats?.lowStock ?? 0) + (stats?.outOfStock ?? 0)}
                </Text>
                <Text className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>
                  Low / Out of Stock
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/activity-log')}
                className="flex-1 rounded-2xl p-4"
                style={{ backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.border }}>
                <View
                  className="mb-3 self-start rounded-xl p-2"
                  style={{ backgroundColor: `${COLORS.teal}22` }}>
                  <Activity color={COLORS.teal} size={18} />
                </View>
                <Text className="text-2xl font-bold text-white" style={{ fontWeight: '800' }}>
                  {stats?.activityToday ?? 0}
                </Text>
                <Text className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>
                  Actions Today
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Menu items */}
        <View className="mx-5 mb-4">
          <Text className="mb-3 text-sm font-semibold" style={{ color: COLORS.textSecondary }}>
            TOOLS
          </Text>
          <View className="rounded-2xl overflow-hidden" style={{ backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.border }}>
            <MenuRow
              icon={<AlertTriangle color={COLORS.warning} size={18} />}
              iconBg={`${COLORS.warning}22`}
              label="Low Stock Alerts"
              subtitle={stats?.outOfStock ? `${stats.outOfStock} out of stock` : undefined}
              onPress={() => router.push('/low-stock')}
            />
            <Divider />
            <MenuRow
              icon={<Activity color={COLORS.teal} size={18} />}
              iconBg={`${COLORS.teal}22`}
              label="Activity Log"
              onPress={() => router.push('/activity-log')}
            />
            <Divider />
            <MenuRow
              icon={<Package color="#3B82F6" size={18} />}
              iconBg="#3B82F622"
              label="All Inventory"
              onPress={() => router.push('/(tabs)/inventory')}
            />
          </View>
        </View>

        <View className="mx-5 mb-4">
          <Text className="mb-3 text-sm font-semibold" style={{ color: COLORS.textSecondary }}>
            ACCOUNT
          </Text>
          <View className="rounded-2xl overflow-hidden" style={{ backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.border }}>
            <MenuRow
              icon={<Settings color={COLORS.textSecondary} size={18} />}
              iconBg={`${COLORS.textSecondary}22`}
              label="Settings"
              subtitle="Profile, PIN, tags"
              onPress={() => router.push('/settings')}
            />
            <Divider />
            <MenuRow
              icon={<Tag color={COLORS.textSecondary} size={18} />}
              iconBg={`${COLORS.textSecondary}22`}
              label="Manage Tags"
              onPress={() => router.push('/settings?tab=tags')}
            />
            <Divider />
            <MenuRow
              icon={<LogOut color={COLORS.destructive} size={18} />}
              iconBg={`${COLORS.destructive}22`}
              label="Sign Out"
              labelColor={COLORS.destructive}
              onPress={handleSignOut}
              showChevron={false}
            />
          </View>
        </View>

        <Text className="text-center text-xs mb-8" style={{ color: COLORS.textSecondary }}>
          Inventory Manager v1.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: COLORS.border, marginLeft: 56 }} />;
}

function MenuRow({
  icon,
  iconBg,
  label,
  subtitle,
  labelColor,
  onPress,
  showChevron = true,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  subtitle?: string;
  labelColor?: string;
  onPress: () => void;
  showChevron?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center gap-3 px-4 py-3.5">
      <View
        className="items-center justify-center rounded-xl"
        style={{ width: 36, height: 36, backgroundColor: iconBg }}>
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-sm font-medium" style={{ color: labelColor ?? COLORS.textPrimary }}>
          {label}
        </Text>
        {subtitle && (
          <Text className="text-xs mt-0.5" style={{ color: COLORS.textSecondary }}>
            {subtitle}
          </Text>
        )}
      </View>
      {showChevron && <ChevronRight color={COLORS.textSecondary} size={16} />}
    </TouchableOpacity>
  );
}
