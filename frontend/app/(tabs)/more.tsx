import { useAuth } from '@/lib/auth-context';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import { router } from 'expo-router';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  ChevronRight,
  LogOut,
  Moon,
  Settings,
  Sun,
  Tag,
  Upload,
  User,
  Users,
} from 'lucide-react-native';
import React from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MenuScreen() {
  const { user, profile, signOut } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
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
            Menu
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

        {/* Account section */}
        <View className="mx-5 mb-4">
          <Text className="mb-3" style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' }}>
            ACCOUNT
          </Text>
          <View className="rounded-2xl overflow-hidden" style={cardStyle}>
            <MenuRow
              icon={<Settings color={colors.textSecondary} size={18} />}
              iconBg={`${colors.textSecondary}22`}
              label="User Profile"
              subtitle="Profile, PIN, preferences"
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
          </View>
        </View>

        {/* Tools section */}
        <View className="mx-5 mb-4">
          <Text className="mb-3" style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' }}>
            TOOLS
          </Text>
          <View className="rounded-2xl overflow-hidden" style={cardStyle}>
            <MenuRow
              icon={<BarChart3 color={colors.accent} size={18} />}
              iconBg={colors.accentMuted}
              label="Reports"
              subtitle="Inventory summary, activity, transactions"
              onPress={() => router.push('/reports')}
              colors={colors}
            />
            <Divider colors={colors} />
            <MenuRow
              icon={<Tag color={colors.statusInProgress} size={18} />}
              iconBg={`${colors.statusInProgress}22`}
              label="Tags Management"
              onPress={() => router.push('/tags')}
              colors={colors}
            />
            <Divider colors={colors} />
            <MenuRow
              icon={<Users color={colors.statusReady} size={18} />}
              iconBg={`${colors.statusReady}22`}
              label="Manage Team"
              onPress={() => router.push('/team')}
              colors={colors}
            />
            <Divider colors={colors} />
            <MenuRow
              icon={<Bell color={colors.accent} size={18} />}
              iconBg={colors.accentMuted}
              label="Notifications"
              onPress={() => router.push('/notifications')}
              colors={colors}
            />
          </View>
        </View>

        {/* Alerts section */}
        <View className="mx-5 mb-4">
          <Text className="mb-3" style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' }}>
            ALERTS
          </Text>
          <View className="rounded-2xl overflow-hidden" style={cardStyle}>
            <MenuRow
              icon={<AlertTriangle color={colors.warning} size={18} />}
              iconBg={colors.warningMuted}
              label="Low Stock Alerts"
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
          </View>
        </View>

        {/* Data section */}
        <View className="mx-5 mb-4">
          <Text className="mb-3" style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' }}>
            DATA
          </Text>
          <View className="rounded-2xl overflow-hidden" style={cardStyle}>
            <MenuRow
              icon={<Upload color={colors.textSecondary} size={18} />}
              iconBg={`${colors.textSecondary}22`}
              label="Bulk Import"
              subtitle="Coming soon"
              onPress={() => Alert.alert('Coming Soon', 'Bulk import will be available in a future update.')}
              colors={colors}
            />
          </View>
        </View>

        {/* Sign out */}
        <View className="mx-5 mb-4">
          <View className="rounded-2xl overflow-hidden" style={cardStyle}>
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
