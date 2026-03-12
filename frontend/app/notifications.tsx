import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { Notification } from '@/lib/types';
import { formatRelativeTime } from '@/lib/utils';
import { router, useFocusEffect } from 'expo-router';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  BellOff,
  CheckCheck,
  ClipboardList,
  Package,
  Trash2,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

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
      case 'pick_list_issue': return <AlertTriangle color={colors.warning} size={18} />;
      case 'item': return <Package color={colors.accent} size={18} />;
      default: return <Bell color={colors.accent} size={18} />;
    }
  };

  const getNotifIconBg = (type: string) => {
    switch (type) {
      case 'low_stock': return colors.warningMuted;
      case 'pick_list': return `${colors.statusReady}22`;
      case 'pick_list_issue': return colors.warningMuted;
      case 'item': return colors.accentMuted;
      default: return colors.accentMuted;
    }
  };

  const dismissNotification = async (notifId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    await supabase.from('notifications').delete().eq('id', notifId);
  };

  const clearAll = () => {
    if (!user || notifications.length === 0) return;
    Alert.alert('Clear All', 'Delete all notifications?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          setNotifications([]);
          await supabase.from('notifications').delete().eq('user_id', user.id);
        },
      },
    ]);
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
        {notifications.length > 0 && (
          <TouchableOpacity
            onPress={clearAll}
            className="rounded-xl p-2 mr-1"
            style={{ backgroundColor: colors.destructiveMuted }}>
            <Trash2 color={colors.destructive} size={16} />
          </TouchableOpacity>
        )}
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
              style={cardStyle}>
              <View
                className="items-center justify-center rounded-xl mt-0.5 mr-3"
                style={{ width: 36, height: 36, backgroundColor: getNotifIconBg(notif.type) }}>
                {getNotifIcon(notif.type)}
              </View>
              <View className="flex-1" style={{ flexShrink: 1 }}>
                <View className="flex-row items-start gap-2">
                  <Text className="font-semibold text-sm" style={{ color: colors.textPrimary, flex: 1, flexWrap: 'wrap' }}>
                    {notif.title}
                  </Text>
                  {!notif.is_read && (
                    <View className="rounded-full mt-1.5" style={{ width: 8, height: 8, backgroundColor: colors.accent, flexShrink: 0 }} />
                  )}
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation(); dismissNotification(notif.id); }}
                    hitSlop={8}
                    className="rounded-lg p-1"
                    style={{ backgroundColor: colors.background, flexShrink: 0 }}>
                    <X color={colors.textSecondary} size={12} />
                  </TouchableOpacity>
                </View>
                {notif.message && (
                  <Text className="text-xs mt-1" style={{ color: colors.textSecondary, flexWrap: 'wrap' }}>
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
