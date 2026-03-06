import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { ThemeColors } from '@/lib/theme-context';
import type { PickList, Profile } from '@/lib/types';
import { formatRelativeTime, getPickListStatusColor, getPickListStatusLabel } from '@/lib/utils';
import { User } from 'lucide-react-native';

type PickListWithAssignee = PickList & { assignee?: Profile | null };
import { router, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  ClipboardList,
  Plus,
  Search,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBadge } from '@/components/ui/Badge';

const STATUS_FILTERS = ['all', 'draft', 'ready_to_pick', 'partially_complete', 'complete'] as const;

export default function PickListListScreen() {
  const { colors, isDark } = useTheme();
  const [pickLists, setPickLists] = useState<PickListWithAssignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const cardStyle = {
    backgroundColor: colors.surface,
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? colors.borderLight : 'transparent',
    ...getCardShadow(isDark),
  };

  const loadPickLists = useCallback(async () => {
    let query = supabase
      .from('pick_lists')
      .select('*, assignee:profiles!pick_lists_assigned_to_fkey(*)')
      .order('updated_at', { ascending: false });

    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (searchQuery.trim()) query = query.ilike('name', `%${searchQuery}%`);

    const { data, error } = await query;
    if (error) {
      // Fallback without join if FK doesn't exist
      const fallback = supabase
        .from('pick_lists')
        .select('*')
        .order('updated_at', { ascending: false });
      if (statusFilter !== 'all') fallback.eq('status', statusFilter);
      if (searchQuery.trim()) fallback.ilike('name', `%${searchQuery}%`);
      const { data: fbData } = await fallback;
      setPickLists((fbData ?? []) as PickListWithAssignee[]);
    } else {
      setPickLists((data ?? []) as unknown as PickListWithAssignee[]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [statusFilter, searchQuery]);

  useEffect(() => { loadPickLists(); }, [loadPickLists]);

  useFocusEffect(
    useCallback(() => {
      loadPickLists();
    }, [loadPickLists])
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="px-5 pt-4 pb-3">
        <View className="mb-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity onPress={() => router.back()} className="rounded-xl p-2" style={cardStyle}>
              <ArrowLeft color={colors.textPrimary} size={20} />
            </TouchableOpacity>
            <Text className="text-xl font-bold" style={{ fontWeight: '800', color: colors.textPrimary }}>
              Pick Lists
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/pick-list/new')}
            className="flex-row items-center gap-1.5 rounded-xl px-3 py-2.5"
            style={{ backgroundColor: colors.accent }}>
            <Plus color={colors.accentOnAccent} size={16} />
            <Text className="text-sm font-semibold" style={{ color: colors.accentOnAccent }}>New</Text>
          </TouchableOpacity>
        </View>

        <View
          className="mb-3 flex-row items-center rounded-xl px-3 py-2.5"
          style={cardStyle}>
          <Search color={colors.textSecondary} size={16} />
          <TextInput
            className="ml-2 flex-1 text-sm"
            style={{ color: colors.textPrimary }}
            placeholder="Search pick lists..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X color={colors.textSecondary} size={16} />
            </TouchableOpacity>
          ) : null}
        </View>

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
                backgroundColor: statusFilter === s ? colors.accentMuted : colors.surface,
                borderWidth: 1,
                borderColor: statusFilter === s ? `${colors.accent}66` : colors.border,
              }}>
              <Text
                className="text-xs font-medium"
                style={{ color: statusFilter === s ? colors.accent : colors.textSecondary }}>
                {s === 'all' ? 'All' : getPickListStatusLabel(s)}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} className="mt-8" />
      ) : (
        <FlatList
          data={pickLists}
          keyExtractor={(pl) => pl.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPickLists(); }} tintColor={colors.accent} />}
          ListEmptyComponent={
            <View className="items-center mt-12">
              <ClipboardList color={colors.textSecondary} size={32} />
              <Text className="text-base font-semibold mt-3" style={{ color: colors.textPrimary }}>No pick lists</Text>
              <Text className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                Create your first pick list to start picking inventory.
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/pick-list/new')}
                className="mt-4 rounded-xl px-5 py-2.5"
                style={{ backgroundColor: colors.accent }}>
                <Text className="font-semibold" style={{ color: colors.accentOnAccent }}>New Pick List</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const statusColor = getPickListStatusColor(item.status, colors);
            return (
              <Pressable
                onPress={() => router.push(`/pick-list/${item.id}`)}
                className="mb-3 rounded-2xl p-4"
                style={cardStyle}>
                <View className="mb-3 flex-row items-start justify-between">
                  <View className="flex-row items-center gap-3 flex-1">
                    <View
                      className="items-center justify-center rounded-xl p-2.5"
                      style={{ backgroundColor: `${statusColor}22` }}>
                      <ClipboardList color={statusColor} size={20} />
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold" style={{ color: colors.textPrimary }} numberOfLines={2}>{item.name}</Text>
                      {item.notes && (
                        <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }} numberOfLines={1}>
                          {item.notes}
                        </Text>
                      )}
                    </View>
                  </View>
                  <StatusBadge status={item.status} size="sm" />
                </View>
                {item.status !== 'draft' && (
                  <View className="flex-row items-center gap-1.5 mb-2">
                    <User color={colors.textSecondary} size={12} />
                    <Text className="text-xs" style={{ color: colors.textSecondary }}>
                      {item.assignee?.full_name ? `Assigned to ${item.assignee.full_name}` : 'Assigned to Everyone'}
                    </Text>
                  </View>
                )}
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs" style={{ color: colors.textSecondary }}>
                    Updated {formatRelativeTime(item.updated_at)}
                  </Text>
                  {item.status !== 'draft' && item.status !== 'complete' && (
                    <TouchableOpacity
                      onPress={() => router.push(`/pick-list/${item.id}?mode=picking`)}
                      className="rounded-lg px-3 py-1.5"
                      style={{ backgroundColor: `${statusColor}22` }}>
                      <Text className="text-xs font-semibold" style={{ color: statusColor }}>Pick Now</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
