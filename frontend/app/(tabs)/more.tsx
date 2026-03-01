import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import { router } from 'expo-router';
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  LogOut,
  Moon,
  Package,
  Settings,
  Sun,
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

export default function MoreScreen() {
  const { user, profile, signOut } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
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

  const cardStyle = {
    backgroundColor: colors.surface,
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? colors.borderLight : 'transparent',
    ...getCardShadow(isDark),
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 pt-4 pb-3">
          <Text className="text-xl font-bold" style={{ color: colors.textPrimary, fontWeight: '700' }}>
            More
          </Text>
        </View>

        {/* Profile card */}
        <TouchableOpacity
          onPress={() => router.push('/settings')}
          className="mx-5 mb-4 flex-row items-center gap-4 rounded-2xl p-4"
          style={cardStyle}>
          <View
            className="items-center justify-center rounded-2xl"
            style={{ width: 52, height: 52, backgroundColor: colors.accentMuted }}>
            <User color={colors.accent} size={26} />
          </View>
          <View className="flex-1">
            <Text className="font-bold text-base" style={{ color: colors.textPrimary }}>
              {profile?.full_name ?? 'User'}
            </Text>
            <Text className="text-sm mt-0.5" style={{ color: colors.textSecondary }}>
              {user?.email}
            </Text>
            <View
              className="mt-1.5 self-start rounded-full px-2.5 py-0.5"
              style={{ backgroundColor: colors.accentMuted }}>
              <Text className="text-xs font-semibold capitalize" style={{ color: colors.accent }}>
                {profile?.role ?? 'member'}
              </Text>
            </View>
          </View>
          <ChevronRight color={colors.textSecondary} size={18} />
        </TouchableOpacity>

        {/* Quick stats */}
        <View className="mx-5 mb-4">
          <Text className="mb-3" style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' }}>
            ALERTS
          </Text>
          {loadingStats ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => router.push('/low-stock')}
                className="flex-1 rounded-2xl p-4"
                style={{
                  ...cardStyle,
                  borderColor: stats?.lowStock || stats?.outOfStock
                    ? `${colors.warning}44`
                    : isDark ? colors.borderLight : 'transparent',
                }}>
                <View
                  className="mb-3 self-start rounded-xl p-2"
                  style={{ backgroundColor: colors.warningMuted }}>
                  <AlertTriangle color={colors.warning} size={18} />
                </View>
                <Text className="text-2xl font-bold" style={{ color: colors.textPrimary, fontWeight: '800' }}>
                  {(stats?.lowStock ?? 0) + (stats?.outOfStock ?? 0)}
                </Text>
                <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                  Low / Out of Stock
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/activity-log')}
                className="flex-1 rounded-2xl p-4"
                style={cardStyle}>
                <View
                  className="mb-3 self-start rounded-xl p-2"
                  style={{ backgroundColor: colors.accentMuted }}>
                  <Activity color={colors.accent} size={18} />
                </View>
                <Text className="text-2xl font-bold" style={{ color: colors.textPrimary, fontWeight: '800' }}>
                  {stats?.activityToday ?? 0}
                </Text>
                <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                  Actions Today
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Menu items */}
        <View className="mx-5 mb-4">
          <Text className="mb-3" style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' }}>
            TOOLS
          </Text>
          <View className="rounded-2xl overflow-hidden" style={cardStyle}>
            <MenuRow
              icon={<AlertTriangle color={colors.warning} size={18} />}
              iconBg={colors.warningMuted}
              label="Low Stock Alerts"
              subtitle={stats?.outOfStock ? `${stats.outOfStock} out of stock` : undefined}
              onPress={() => router.push('/low-stock')}
              colors={colors}
            />
            <Divider colors={colors} />
            <MenuRow
              icon={<Activity color={colors.accent} size={18} />}
              iconBg={colors.accentMuted}
              label="Activity Log"
              onPress={() => router.push('/activity-log')}
              colors={colors}
            />
            <Divider colors={colors} />
            <MenuRow
              icon={<Package color={colors.statusReady} size={18} />}
              iconBg={`${colors.statusReady}22`}
              label="All Inventory"
              onPress={() => router.push('/(tabs)/inventory')}
              colors={colors}
            />
          </View>
        </View>

        <View className="mx-5 mb-4">
          <Text className="mb-3" style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' }}>
            ACCOUNT
          </Text>
          <View className="rounded-2xl overflow-hidden" style={cardStyle}>
            <MenuRow
              icon={<Settings color={colors.textSecondary} size={18} />}
              iconBg={`${colors.textSecondary}22`}
              label="Settings"
              subtitle="Profile, PIN, tags"
              onPress={() => router.push('/settings')}
              colors={colors}
            />
            <Divider colors={colors} />
            <MenuRow
              icon={isDark ? <Moon color={colors.accent} size={18} /> : <Sun color={colors.accent} size={18} />}
              iconBg={colors.accentMuted}
              label="Appearance"
              subtitle={isDark ? 'Dark mode' : 'Light mode'}
              onPress={toggleTheme}
              colors={colors}
              showChevron={false}
            />
            <Divider colors={colors} />
            <MenuRow
              icon={<Tag color={colors.textSecondary} size={18} />}
              iconBg={`${colors.textSecondary}22`}
              label="Manage Tags"
              onPress={() => router.push('/settings?tab=tags')}
              colors={colors}
            />
            <Divider colors={colors} />
            <MenuRow
              icon={<LogOut color={colors.destructive} size={18} />}
              iconBg={colors.destructiveMuted}
              label="Sign Out"
              labelColor={colors.destructive}
              onPress={handleSignOut}
              showChevron={false}
              colors={colors}
            />
          </View>
        </View>

        <Text className="text-center text-xs mb-8" style={{ color: colors.textTertiary }}>
          Imperial Inventory v1.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Divider({ colors }: { colors: any }) {
  return <View style={{ height: 1, backgroundColor: colors.borderLight, marginLeft: 56 }} />;
}

function MenuRow({
  icon,
  iconBg,
  label,
  subtitle,
  labelColor,
  onPress,
  showChevron = true,
  colors,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  subtitle?: string;
  labelColor?: string;
  onPress: () => void;
  showChevron?: boolean;
  colors: any;
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
        <Text className="text-sm font-medium" style={{ color: labelColor ?? colors.textPrimary }}>
          {label}
        </Text>
        {subtitle && (
          <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
            {subtitle}
          </Text>
        )}
      </View>
      {showChevron && <ChevronRight color={colors.textSecondary} size={16} />}
    </TouchableOpacity>
  );
}
