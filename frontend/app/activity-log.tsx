import { supabase } from '@/lib/supabase';
import { COLORS } from '@/lib/theme';
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

function getActionIcon(actionType: string) {
  if (actionType.startsWith('pick_list') || actionType === 'item_picked') {
    return <ClipboardList color={COLORS.teal} size={15} />;
  }
  if (actionType === 'quantity_adjusted') {
    return <Activity color={COLORS.warning} size={15} />;
  }
  return <Package color={COLORS.teal} size={15} />;
}

function getActionColor(actionType: string): string {
  if (actionType === 'item_deleted') return COLORS.destructive;
  if (actionType === 'quantity_adjusted') return COLORS.warning;
  if (actionType === 'pick_list_completed') return COLORS.success;
  return COLORS.teal;
}

export default function ActivityLogScreen() {
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
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.navy }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-3">
        <TouchableOpacity onPress={() => router.back()} className="rounded-xl p-2" style={{ backgroundColor: COLORS.navyCard }}>
          <ArrowLeft color={COLORS.textPrimary} size={20} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-white">Activity Log</Text>
        <TouchableOpacity
          onPress={onRefresh}
          className="rounded-xl p-2"
          style={{ backgroundColor: COLORS.navyCard }}>
          <RefreshCw color={COLORS.textSecondary} size={18} />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View className="mx-5 mb-4 flex-row rounded-xl p-1" style={{ backgroundColor: COLORS.navyCard }}>
        {ACTION_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            className="flex-1 items-center rounded-lg py-2"
            style={{ backgroundColor: filter === f.key ? `${COLORS.teal}22` : 'transparent' }}>
            <Text
              className="text-xs font-semibold"
              style={{ color: filter === f.key ? COLORS.teal : COLORS.textSecondary }}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.teal} className="mt-8" />
      ) : (
        <FlatList
          data={filteredLogs}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.teal} />}
          onEndReached={() => hasMore && load()}
          onEndReachedThreshold={0.3}
          ListFooterComponent={hasMore ? <ActivityIndicator color={COLORS.teal} className="py-4" /> : null}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Activity color={COLORS.textSecondary} size={32} />
              <Text className="mt-3 text-sm" style={{ color: COLORS.textSecondary }}>
                No activity yet
              </Text>
            </View>
          }
          renderItem={({ item: log }) => <ActivityLogRow log={log} />}
        />
      )}
    </SafeAreaView>
  );
}

function ActivityLogRow({ log }: { log: ActivityLog }) {
  const actionColor = getActionColor(log.action_type);
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
      style={{ backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.border }}>
      <View
        className="items-center justify-center rounded-xl"
        style={{ width: 36, height: 36, backgroundColor: `${actionColor}22` }}>
        {getActionIcon(log.action_type)}
      </View>

      <View className="flex-1">
        <Text className="text-sm font-semibold text-white">
          {log.action_type === 'item_picked' && quantity != null && itemName && pickListName
            ? `Picked ${quantity} units of ${itemName}`
            : getActionLabel(log.action_type)}
        </Text>
        
        {log.action_type === 'item_picked' ? (
          <Text className="text-xs mt-0.5" style={{ color: COLORS.textSecondary }}>
            For pick list: {pickListName}{remaining != null ? ` • Remaining: ${remaining}` : ''}
          </Text>
        ) : (
          <>
            {(itemName || pickListName) && (
              <Text className="text-xs mt-0.5" style={{ color: COLORS.textSecondary }} numberOfLines={1}>
                {itemName ?? pickListName}
              </Text>
            )}
            {details?.quantity != null && (
              <Text className="text-xs mt-0.5" style={{ color: COLORS.teal }}>
                Qty: {details.old_quantity != null ? `${details.old_quantity} → ` : ''}{String(details.quantity)}
              </Text>
            )}
          </>
        )}
      </View>

      <View className="items-end gap-1">
        <Text className="text-xs" style={{ color: COLORS.textSecondary }}>
          {formatRelativeTime(log.timestamp)}
        </Text>
        {(log.item_id || log.pick_list_id) && (
          <ChevronRight color={COLORS.textSecondary} size={14} />
        )}
      </View>
    </TouchableOpacity>
  );
}
