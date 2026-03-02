import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { Notification } from '@/lib/types';
import { formatRelativeTime } from '@/lib/utils';
import { router } from 'expo-router';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  BellOff,
  CheckCheck,
  ClipboardList,
  Package,
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

export default function NotificationsScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cardStyle = {
    backgroundColor: colors.surface,
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? colors.borderLight : 'transparent',
    ...getCardShadow(isDark),
  };

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setNotifications((data ?? []) as Notification[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    loadNotifications();
  };

  const handlePress = async (notif: Notification) => {
    if (!notif.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
    }
    if (notif.related_item_id) {
      router.push(`/item/${notif.related_item_id}`);
    } else if (notif.related_pick_list_id) {
      router.push(`/pick-list/${notif.related_pick_list_id}`);
    }
    loadNotifications();
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'low_stock': return <AlertTriangle color={colors.warning} size={18} />;
      case 'pick_list': return <ClipboardList color={colors.statusReady} size={18} />;
      case 'item': return <Package color={colors.accent} size={18} />;
      default: return <Bell color={colors.accent} size={18} />;
    }
  };

  const getNotifIconBg = (type: string) => {
    switch (type) {
      case 'low_stock': return colors.warningMuted;
      case 'pick_list': return `${colors.statusReady}22`;
      case 'item': return colors.accentMuted;
      default: return colors.accentMuted;
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="flex-row items-center px-5 py-3 gap-3">
        <TouchableOpacity onPress={() => router.back()} className="rounded-xl p-2" style={cardStyle}>
          <ArrowLeft color={colors.textPrimary} size={20} />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold" style={{ color: colors.textPrimary }}>
          Notifications
        </Text>
        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={markAllRead}
            className="flex-row items-center gap-1.5 rounded-xl px-3 py-2"
            style={{ backgroundColor: colors.accentMuted }}>
            <CheckCheck color={colors.accent} size={14} />
            <Text className="text-xs font-semibold" style={{ color: colors.accent }}>Mark All Read</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} className="mt-8" />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadNotifications(); }} tintColor={colors.accent} />}
          ListEmptyComponent={
            <View className="items-center mt-20">
              <BellOff color={colors.textSecondary} size={40} />
              <Text className="text-base font-semibold mt-4" style={{ color: colors.textPrimary }}>
                Nothing to see here
              </Text>
              <Text className="text-sm mt-1 text-center px-8" style={{ color: colors.textSecondary }}>
                You're all caught up! Notifications will appear here when there's activity.
              </Text>
            </View>
          }
          renderItem={({ item: notif }) => (
            <TouchableOpacity
              onPress={() => handlePress(notif)}
              className="mb-2 flex-row items-start rounded-2xl px-4 py-3"
              style={{
                ...cardStyle,
                opacity: notif.is_read ? 0.7 : 1,
              }}>
              <View
                className="items-center justify-center rounded-xl mt-0.5 mr-3"
                style={{ width: 36, height: 36, backgroundColor: getNotifIconBg(notif.type) }}>
                {getNotifIcon(notif.type)}
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="font-semibold text-sm flex-1" style={{ color: colors.textPrimary }}>
                    {notif.title}
                  </Text>
                  {!notif.is_read && (
                    <View className="rounded-full" style={{ width: 8, height: 8, backgroundColor: colors.accent }} />
                  )}
                </View>
                {notif.message && (
                  <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }} numberOfLines={2}>
                    {notif.message}
                  </Text>
                )}
                <Text className="text-xs mt-1" style={{ color: colors.textTertiary }}>
                  {formatRelativeTime(notif.created_at)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}
