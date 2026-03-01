import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { ThemeColors } from '@/lib/theme-context';
import type { ActivityLog } from '@/lib/types';
import { formatRelativeTime, getActionLabel } from '@/lib/utils';
import { router } from 'expo-router';
import {
  Activity,
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  Package,
  RefreshCw,
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ACTION_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'item', label: 'Items' },
  { key: 'pick_list', label: 'Pick Lists' },
  { key: 'quantity', label: 'Qty Changes' },
] as const;

type ActionFilter = (typeof ACTION_FILTERS)[number]['key'];

function matchesFilter(log: ActivityLog, filter: ActionFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'item') return log.action_type.startsWith('item_') && log.action_type !== 'item_picked';
  if (filter === 'pick_list') return log.action_type.startsWith('pick_list_') || log.action_type === 'item_picked';
  if (filter === 'quantity') return log.action_type === 'quantity_adjusted';
  return true;
}

function getActionIcon(actionType: string, colors: ThemeColors) {
  if (actionType.startsWith('pick_list') || actionType === 'item_picked') {
    return <ClipboardList color={colors.accent} size={15} />;
  }
  if (actionType === 'quantity_adjusted') {
    return <Activity color={colors.warning} size={15} />;
  }
  return <Package color={colors.accent} size={15} />;
}

function getActionColor(actionType: string, colors: ThemeColors): string {
  if (actionType === 'item_deleted') return colors.destructive;
  if (actionType === 'quantity_adjusted') return colors.warning;
  if (actionType === 'pick_list_completed') return colors.success;
  return colors.accent;
}

export default function ActivityLogScreen() {
  const { colors, isDark } = useTheme();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<ActionFilter>('all');
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  const PAGE_SIZE = 30;

  const load = async (reset = false) => {
    const currentPage = reset ? 0 : pageRef.current;
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data } = await supabase
      .from('activity_log')
      .select('*')
      .order('timestamp', { ascending: false })
      .range(from, to);

    const rows = (data ?? []) as ActivityLog[];
    if (reset) {
      setLogs(rows);
      pageRef.current = 1;
    } else {
      setLogs((prev) => [...prev, ...rows]);
      pageRef.current += 1;
    }
    setHasMore(rows.length === PAGE_SIZE);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    setLoading(true);
    pageRef.current = 0;
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const filteredLogs = logs.filter((l) => matchesFilter(l, filter));

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-3">
        <TouchableOpacity onPress={() => router.back()} className="rounded-xl p-2" style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
          <ArrowLeft color={colors.textPrimary} size={20} />
        </TouchableOpacity>
        <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>Activity Log</Text>
        <TouchableOpacity
          onPress={onRefresh}
          className="rounded-xl p-2"
          style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
          <RefreshCw color={colors.textSecondary} size={18} />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View className="mx-5 mb-4 flex-row rounded-xl p-1" style={{ backgroundColor: colors.surface }}>
        {ACTION_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            className="flex-1 items-center rounded-lg py-2"
            style={{ backgroundColor: filter === f.key ? colors.accentMuted : 'transparent' }}>
            <Text
              className="text-xs font-semibold"
              style={{ color: filter === f.key ? colors.accent : colors.textSecondary }}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} className="mt-8" />
      ) : (
        <FlatList
          data={filteredLogs}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          onEndReached={() => hasMore && load()}
          onEndReachedThreshold={0.3}
          ListFooterComponent={hasMore ? <ActivityIndicator color={colors.accent} className="py-4" /> : null}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Activity color={colors.textSecondary} size={32} />
              <Text className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
                No activity yet
              </Text>
            </View>
          }
          renderItem={({ item: log }) => <ActivityLogRow log={log} colors={colors} isDark={isDark} />}
        />
      )}
    </SafeAreaView>
  );
}

function ActivityLogRow({ log, colors, isDark }: { log: ActivityLog; colors: ThemeColors; isDark: boolean }) {
  const actionColor = getActionColor(log.action_type, colors);
  const details = log.details as Record<string, any>;
  const itemName = (details?.item_name ?? details?.name) as string | undefined;
  const pickListName = details?.pick_list_name as string | undefined;
  const quantity = details?.quantity as number | undefined;
  const remaining = details?.inventory_remaining as number | undefined;

  return (
    <TouchableOpacity
      onPress={() => {
        if (log.item_id) router.push(`/item/${log.item_id}`);
        else if (log.pick_list_id) router.push(`/pick-list/${log.pick_list_id}`);
      }}
      activeOpacity={log.item_id || log.pick_list_id ? 0.7 : 1}
      className="mb-2 rounded-2xl px-4 py-3.5 flex-row items-center gap-3"
      style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
      <View
        className="items-center justify-center rounded-xl"
        style={{ width: 36, height: 36, backgroundColor: actionColor === colors.warning ? colors.warningMuted : actionColor === colors.destructive ? colors.destructiveMuted : actionColor === colors.success ? colors.successMuted : colors.accentMuted }}>
        {getActionIcon(log.action_type, colors)}
      </View>

      <View className="flex-1">
        <Text className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
          {log.action_type === 'item_picked' && quantity != null && itemName && pickListName
            ? `Picked ${quantity} units of ${itemName}`
            : getActionLabel(log.action_type)}
        </Text>

        {log.action_type === 'item_picked' ? (
          <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
            For pick list: {pickListName}{remaining != null ? ` \u2022 Remaining: ${remaining}` : ''}
          </Text>
        ) : (
          <>
            {(itemName || pickListName) && (
              <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }} numberOfLines={1}>
                {itemName ?? pickListName}
              </Text>
            )}
            {details?.quantity != null && (
              <Text className="text-xs mt-0.5" style={{ color: colors.accent }}>
                Qty: {details.old_quantity != null ? `${details.old_quantity} \u2192 ` : ''}{String(details.quantity)}
              </Text>
            )}
          </>
        )}
      </View>

      <View className="items-end gap-1">
        <Text className="text-xs" style={{ color: colors.textSecondary }}>
          {formatRelativeTime(log.timestamp)}
        </Text>
        {(log.item_id || log.pick_list_id) && (
          <ChevronRight color={colors.textSecondary} size={14} />
        )}
      </View>
    </TouchableOpacity>
  );
}
