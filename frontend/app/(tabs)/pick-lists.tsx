import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import { router, useFocusEffect } from 'expo-router';
import {
  ClipboardList,
  ClipboardCheck,
  Truck,
  ChevronRight,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WorkflowsScreen() {
  const { colors, isDark } = useTheme();
  const [stats, setStats] = useState({ pickLists: 0, stockCounts: 0, purchaseOrders: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const [plRes, scRes, poRes] = await Promise.all([
        supabase
          .from('pick_lists')
          .select('id', { count: 'exact', head: true })
          .in('status', ['draft', 'ready_to_pick', 'in_progress', 'partially_complete']),
        supabase
          .from('stock_counts')
          .select('id', { count: 'exact', head: true })
          .in('status', ['draft', 'in_progress']),
        supabase
          .from('purchase_orders')
          .select('id', { count: 'exact', head: true })
          .in('status', ['draft', 'ordered', 'partially_received']),
      ]);
      setStats({
        pickLists: plRes.count ?? 0,
        stockCounts: scRes.count ?? 0,
        purchaseOrders: poRes.count ?? 0,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  const onRefresh = () => { setRefreshing(true); loadStats(); };

  const cardStyle = {
    backgroundColor: colors.surface,
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? colors.borderLight : 'transparent',
    ...getCardShadow(isDark),
  };

  const workflows = [
    {
      title: 'Pick Lists',
      description: 'Pick items from inventory for orders and fulfillment',
      icon: <ClipboardList color={colors.statusReady} size={24} />,
      iconBg: `${colors.statusReady}22`,
      count: stats.pickLists,
      countLabel: 'active',
      onPress: () => router.push('/pick-list/'),
    },
    {
      title: 'Stock Counts',
      description: 'Verify inventory accuracy with physical counts',
      icon: <ClipboardCheck color={colors.textSecondary} size={24} />,
      iconBg: `${colors.textSecondary}22`,
      count: 0,
      countLabel: 'active',
      comingSoon: true,
    },
    {
      title: 'Purchase Orders',
      description: 'Track orders from suppliers and receive items',
      icon: <Truck color={colors.textSecondary} size={24} />,
      iconBg: `${colors.textSecondary}22`,
      count: 0,
      countLabel: 'open',
      comingSoon: true,
    },
  ];

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}>
        <View className="px-5 pt-4 pb-3">
          <Text className="text-xl font-bold" style={{ fontWeight: '800', color: colors.textPrimary }}>
            Functions
          </Text>
          <Text className="text-sm mt-1" style={{ color: colors.textSecondary }}>
            Manage your inventory operations
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} className="mt-8" />
        ) : (
          <View className="px-5 gap-3 pb-8">
            {workflows.map((wf) => (
              <TouchableOpacity
                key={wf.title}
                onPress={wf.comingSoon ? undefined : wf.onPress}
                activeOpacity={wf.comingSoon ? 1 : 0.2}
                disabled={wf.comingSoon}
                className="rounded-2xl p-4"
                style={[cardStyle, wf.comingSoon && { opacity: 0.55 }]}>
                <View className="flex-row items-center">
                  <View
                    className="items-center justify-center rounded-2xl"
                    style={{ width: 52, height: 52, backgroundColor: wf.iconBg }}>
                    {wf.icon}
                  </View>
                  <View className="flex-1 ml-4">
                    <View className="flex-row items-center gap-2">
                      <Text className="font-bold text-base" style={{ color: wf.comingSoon ? colors.textSecondary : colors.textPrimary }}>
                        {wf.title}
                      </Text>
                      {wf.comingSoon && (
                        <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: colors.border }}>
                          <Text className="text-[10px] font-bold" style={{ color: colors.textSecondary }}>
                            COMING SOON
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
                      {wf.description}
                    </Text>
                    {!wf.comingSoon && wf.count > 0 && (
                      <View
                        className="mt-2 self-start rounded-full px-2.5 py-0.5"
                        style={{ backgroundColor: colors.accentMuted }}>
                        <Text className="text-xs font-semibold" style={{ color: colors.accent }}>
                          {wf.count} {wf.countLabel}
                        </Text>
                      </View>
                    )}
                  </View>
                  {!wf.comingSoon && <ChevronRight color={colors.textSecondary} size={18} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
