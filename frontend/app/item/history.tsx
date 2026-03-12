import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { ActivityLog } from '@/lib/types';
import { formatRelativeTime, getActionLabel } from '@/lib/utils';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Activity,
  ArrowLeft,
  ClipboardList,
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type EnrichedLog = ActivityLog & { userName?: string | null };

export default function ItemHistoryScreen() {
  const { itemId, itemName } = useLocalSearchParams<{ itemId: string; itemName: string }>();
  const { colors, isDark } = useTheme();
  const [logs, setLogs] = useState<EnrichedLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const profileCache = useRef<Record<string, string | null>>({});
  const pageRef = useRef(0);
  const PAGE_SIZE = 30;

  const load = async (reset = false) => {
    if (!itemId) return;
    try {
      const currentPage = reset ? 0 : pageRef.current;
      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data } = await supabase
        .from('activity_log')
        .select('*')
        .eq('item_id', itemId)
        .order('timestamp', { ascending: false })
        .range(from, to);

      const rows = (data ?? []) as ActivityLog[];

      // Resolve user names
      const unknownIds = [...new Set(rows.map((r) => r.user_id).filter((uid): uid is string => !!uid && !(uid in profileCache.current)))];
      if (unknownIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', unknownIds);
        for (const p of profiles ?? []) profileCache.current[p.id] = p.full_name;
      }

      const enriched = rows.map((r) => ({
        ...r,
        userName: r.user_id ? (profileCache.current[r.user_id] ?? null) : null,
      }));

      if (reset) {
        setLogs(enriched);
        pageRef.current = 1;
      } else {
        setLogs((prev) => [...prev, ...enriched]);
        pageRef.current += 1;
      }
      setHasMore(rows.length === PAGE_SIZE);
    } catch (e) {
      console.error('Failed to load item history:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(true); }, [itemId]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="flex-row items-center px-5 py-3 gap-3">
        <TouchableOpacity onPress={() => router.back()} className="rounded-xl p-2" style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
          <ArrowLeft color={colors.textPrimary} size={20} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>Item History</Text>
          <Text className="text-xs" numberOfLines={1} style={{ color: colors.textSecondary }}>
            {decodeURIComponent(itemName ?? '')}
          </Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} className="mt-8" />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.accent} />}
          onEndReached={() => hasMore && load()}
          onEndReachedThreshold={0.3}
          ListFooterComponent={hasMore ? <ActivityIndicator color={colors.accent} className="py-4" /> : null}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Activity color={colors.textSecondary} size={32} />
              <Text className="mt-3 text-sm" style={{ color: colors.textSecondary }}>No history yet</Text>
            </View>
          }
          renderItem={({ item: log }) => {
            const details = (log.details ?? {}) as any;
            const isPicked = log.action_type === 'item_picked';
            return (
              <View
                className="mb-2 rounded-2xl px-4 py-3.5 flex-row items-start gap-3"
                style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
                <View className="mt-0.5 items-center justify-center rounded-xl" style={{ width: 36, height: 36, backgroundColor: colors.accentMuted }}>
                  {isPicked ? <ClipboardList color={colors.accent} size={15} /> : <Activity color={colors.accent} size={15} />}
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
                    {isPicked ? `Picked ${details?.quantity} units` : getActionLabel(log.action_type)}
                  </Text>
                  {isPicked ? (
                    <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
                      For: {details?.pick_list_name}{details?.inventory_remaining != null ? ` \u2022 Left: ${details.inventory_remaining}` : ''}
                    </Text>
                  ) : (
                    <>
                      {details?.reason && (
                        <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>{details.reason}</Text>
                      )}
                      {details?.old_qty != null && details?.new_qty != null && (
                        <Text className="text-xs font-semibold mt-0.5" style={{ color: details.new_qty - details.old_qty > 0 ? colors.success : colors.destructive }}>
                          {details.new_qty - details.old_qty > 0 ? '+' : ''}{details.new_qty - details.old_qty} (was {details.old_qty}, now {details.new_qty})
                        </Text>
                      )}
                      {details?.adjustment != null && details?.old_qty == null && (
                        <Text className="text-xs font-semibold mt-0.5" style={{ color: details.adjustment > 0 ? colors.success : colors.destructive }}>
                          {details.adjustment > 0 ? '+' : ''}{details.adjustment} units
                        </Text>
                      )}
                    </>
                  )}
                  {log.userName && (
                    <Text className="text-[10px] mt-1" style={{ color: colors.accent }}>by {log.userName}</Text>
                  )}
                </View>
                <Text className="text-xs" style={{ color: colors.textSecondary }}>
                  {formatRelativeTime(log.timestamp)}
                </Text>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
