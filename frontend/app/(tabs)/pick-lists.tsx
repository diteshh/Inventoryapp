import { supabase } from '@/lib/supabase';
import { COLORS } from '@/lib/theme';
import type { PickList } from '@/lib/types';
import { formatRelativeTime, getPickListStatusColor, getPickListStatusLabel } from '@/lib/utils';
import { router } from 'expo-router';
import { ClipboardList, Plus, Search, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/Badge';

const STATUS_FILTERS = ['all', 'draft', 'ready_to_pick', 'in_progress', 'partially_complete', 'complete'] as const;

export default function PickListsScreen() {
  const [pickLists, setPickLists] = useState<PickList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const loadPickLists = useCallback(async () => {
    let query = supabase
      .from('pick_lists')
      .select('*')
      .order('updated_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    if (searchQuery.trim()) {
      query = query.ilike('name', `%${searchQuery}%`);
    }

    const { data } = await query;
    setPickLists((data ?? []) as PickList[]);
    setLoading(false);
    setRefreshing(false);
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    loadPickLists();
  }, [loadPickLists]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('pick_lists_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pick_lists' }, () => {
        loadPickLists();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadPickLists]);

  const onRefresh = () => {
    setRefreshing(true);
    loadPickLists();
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.navy }}>
      {/* Header */}
      <View className="px-5 pt-4 pb-3">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-xl font-bold text-white" style={{ fontWeight: '800' }}>
            Pick Lists
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/pick-list/new')}
            className="flex-row items-center gap-1.5 rounded-xl px-3 py-2.5"
            style={{ backgroundColor: COLORS.teal }}>
            <Plus color={COLORS.navy} size={16} />
            <Text className="text-sm font-semibold" style={{ color: COLORS.navy }}>New</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View
          className="mb-3 flex-row items-center rounded-xl px-3 py-2.5"
          style={{ backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.border }}>
          <Search color={COLORS.textSecondary} size={16} />
          <TextInput
            className="ml-2 flex-1 text-sm text-white"
            placeholder="Search pick lists..."
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X color={COLORS.textSecondary} size={16} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Status filter */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_FILTERS}
          keyExtractor={(s) => s}
          renderItem={({ item: s }) => (
            <TouchableOpacity
              onPress={() => setStatusFilter(s)}
              className="mr-2 rounded-full px-3.5 py-1.5"
              style={{
                backgroundColor: statusFilter === s ? `${COLORS.teal}22` : COLORS.navyCard,
                borderWidth: 1,
                borderColor: statusFilter === s ? `${COLORS.teal}66` : COLORS.border,
              }}>
              <Text
                className="text-xs font-medium"
                style={{ color: statusFilter === s ? COLORS.teal : COLORS.textSecondary }}>
                {s === 'all' ? 'All' : getPickListStatusLabel(s)}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator color={COLORS.teal} className="mt-8" />
      ) : (
        <FlatList
          data={pickLists}
          keyExtractor={(pl) => pl.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.teal} />}
          ListEmptyComponent={
            <EmptyState
              icon={<ClipboardList color={COLORS.textSecondary} size={32} />}
              title="No pick lists"
              message="Create your first pick list to start picking inventory."
              actionLabel="New Pick List"
              onAction={() => router.push('/pick-list/new')}
            />
          }
          renderItem={({ item }) => <PickListCard pickList={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function PickListCard({ pickList }: { pickList: PickList }) {
  const statusColor = getPickListStatusColor(pickList.status);
  return (
    <TouchableOpacity
      onPress={() => router.push(`/pick-list/${pickList.id}`)}
      className="mb-3 rounded-2xl p-4"
      style={{ backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.border }}>
      <View className="mb-3 flex-row items-start justify-between">
        <View className="flex-row items-center gap-3 flex-1">
          <View
            className="items-center justify-center rounded-xl p-2.5"
            style={{ backgroundColor: `${statusColor}22` }}>
            <ClipboardList color={statusColor} size={20} />
          </View>
          <View className="flex-1">
            <Text className="font-semibold text-white" numberOfLines={2}>{pickList.name}</Text>
            {pickList.notes && (
              <Text className="text-xs mt-0.5" style={{ color: COLORS.textSecondary }} numberOfLines={1}>
                {pickList.notes}
              </Text>
            )}
          </View>
        </View>
        <StatusBadge status={pickList.status} size="sm" />
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="text-xs" style={{ color: COLORS.textSecondary }}>
          Updated {formatRelativeTime(pickList.updated_at)}
        </Text>
        {pickList.status !== 'draft' && pickList.status !== 'complete' && (
          <TouchableOpacity
            onPress={() => router.push(`/pick-list/${pickList.id}?mode=picking`)}
            className="rounded-lg px-3 py-1.5"
            style={{ backgroundColor: `${statusColor}22` }}>
            <Text className="text-xs font-semibold" style={{ color: statusColor }}>
              Pick Now →
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}
