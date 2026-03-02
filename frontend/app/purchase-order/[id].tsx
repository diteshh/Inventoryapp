import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { Item, PurchaseOrder, PurchaseOrderItem } from '@/lib/types';
import {
  formatCurrency,
  getPOStatusColor,
  getPOStatusLabel,
  logActivity,
} from '@/lib/utils';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Check,
  Minus,
  Plus,
  Truck,
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

type POItemWithItem = PurchaseOrderItem & { items: Item | null };

export default function PurchaseOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const [po, setPO] = useState<PurchaseOrder | null>(null);
  const [items, setItems] = useState<POItemWithItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [receivingId, setReceivingId] = useState<string | null>(null);

  const cardStyle = {
    backgroundColor: colors.surface,
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? colors.borderLight : 'transparent',
    ...getCardShadow(isDark),
  };

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [poRes, itemsRes] = await Promise.all([
        supabase.from('purchase_orders').select('*').eq('id', id).single(),
        supabase.from('purchase_order_items').select('*, items(*)').eq('po_id', id),
      ]);
      setPO(poRes.data as PurchaseOrder);
      setItems((itemsRes.data ?? []) as POItemWithItem[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const receiveItem = async (poi: POItemWithItem, qty: number) => {
    const newReceived = Math.min(poi.quantity_received + qty, poi.quantity_ordered);
    if (newReceived <= poi.quantity_received) return;

    const actualReceived = newReceived - poi.quantity_received;
    setReceivingId(poi.id);

    try {
      // Update PO item
      await supabase
        .from('purchase_order_items')
        .update({
          quantity_received: newReceived,
          received_at: new Date().toISOString(),
          received_by: user?.id,
        })
        .eq('id', poi.id);

      // Increment item quantity
      const currentItem = poi.items;
      if (currentItem) {
        const newQty = currentItem.quantity + actualReceived;
        await supabase.from('items').update({ quantity: newQty }).eq('id', poi.item_id);

        // Log transaction
        await supabase.from('transactions').insert({
          item_id: poi.item_id,
          transaction_type: 'receive',
          quantity_before: currentItem.quantity,
          quantity_after: newQty,
          quantity_change: actualReceived,
          reference_id: id,
          reference_type: 'purchase_order',
          performed_by: user?.id,
          item_name: currentItem.name,
          notes: `PO: ${po?.po_number}`,
        });
      }

      await logActivity(user?.id, 'item_received', {
        itemId: poi.item_id,
        details: { poNumber: po?.po_number, quantity: actualReceived },
      });

      // Check if all items fully received and update PO status
      const updatedItems = items.map(i =>
        i.id === poi.id ? { ...i, quantity_received: newReceived } : i
      );
      setItems(updatedItems as POItemWithItem[]);

      const allFullyReceived = updatedItems.every(i => i.quantity_received >= i.quantity_ordered);
      const someReceived = updatedItems.some(i => i.quantity_received > 0);

      let newStatus = po?.status;
      if (allFullyReceived) {
        newStatus = 'received';
      } else if (someReceived) {
        newStatus = 'partially_received';
      }

      if (newStatus && newStatus !== po?.status) {
        await supabase.from('purchase_orders').update({ status: newStatus }).eq('id', id);
        setPO(prev => prev ? { ...prev, status: newStatus! } : prev);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setReceivingId(null);
    }
  };

  const markOrdered = async () => {
    if (!po || po.status !== 'draft') return;
    await supabase.from('purchase_orders').update({ status: 'ordered', order_date: new Date().toISOString() }).eq('id', id);
    setPO(prev => prev ? { ...prev, status: 'ordered' } : prev);
    await logActivity(user?.id, 'po_updated', { details: { poNumber: po.po_number, status: 'ordered' } });
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (!po) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
        <Text style={{ color: colors.textSecondary }}>Purchase order not found</Text>
      </SafeAreaView>
    );
  }

  const statusColor = getPOStatusColor(po.status, colors);
  const totalOrdered = items.reduce((acc, i) => acc + i.quantity_ordered, 0);
  const totalReceived = items.reduce((acc, i) => acc + i.quantity_received, 0);
  const progress = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;
  const isTerminal = po.status === 'received' || po.status === 'cancelled';

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="flex-row items-center px-5 py-3 gap-3">
        <TouchableOpacity onPress={() => router.back()} className="rounded-xl p-2" style={cardStyle}>
          <ArrowLeft color={colors.textPrimary} size={20} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="font-bold text-sm" style={{ color: colors.accent }}>{po.po_number}</Text>
          <Text className="text-lg font-bold" numberOfLines={1} style={{ color: colors.textPrimary }}>
            {po.supplier_name}
          </Text>
        </View>
        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: `${statusColor}22` }}>
          <Text className="text-xs font-semibold" style={{ color: statusColor }}>
            {getPOStatusLabel(po.status)}
          </Text>
        </View>
      </View>

      {/* Progress */}
      <View className="px-5 mb-2">
        <View className="flex-row justify-between mb-1">
          <Text className="text-xs" style={{ color: colors.textSecondary }}>
            {totalReceived}/{totalOrdered} received ({progress}%)
          </Text>
        </View>
        <View className="rounded-full overflow-hidden" style={{ height: 4, backgroundColor: colors.border }}>
          <View style={{ height: 4, width: `${progress}%` as any, backgroundColor: statusColor, borderRadius: 2 }} />
        </View>
      </View>

      {/* Mark as ordered button for drafts */}
      {po.status === 'draft' && (
        <View className="px-5 mb-3">
          <TouchableOpacity
            onPress={markOrdered}
            className="rounded-xl py-3 flex-row items-center justify-center gap-2"
            style={{ backgroundColor: colors.accentMuted }}>
            <Truck color={colors.accent} size={16} />
            <Text className="font-semibold text-sm" style={{ color: colors.accent }}>Mark as Ordered</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Items */}
      <FlatList
        data={items}
        keyExtractor={(poi) => poi.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} />}
        renderItem={({ item: poi }) => {
          const remaining = poi.quantity_ordered - poi.quantity_received;
          const isFullyReceived = remaining <= 0;

          return (
            <View className="mb-3 rounded-2xl p-4" style={cardStyle}>
              <View className="flex-row items-start justify-between mb-3">
                <View className="flex-1">
                  <Text className="text-xs" style={{ color: colors.textSecondary }}>{poi.items?.sku || 'NO SKU'}</Text>
                  <Text className="font-semibold text-sm" style={{ color: colors.textPrimary }} numberOfLines={1}>
                    {poi.items?.name ?? 'Unknown'}
                  </Text>
                  {poi.unit_cost != null && (
                    <Text className="text-xs mt-0.5" style={{ color: colors.textTertiary }}>
                      Unit cost: {formatCurrency(poi.unit_cost)}
                    </Text>
                  )}
                </View>
                {isFullyReceived && (
                  <View className="rounded-full p-1" style={{ backgroundColor: colors.successMuted }}>
                    <Check color={colors.success} size={14} />
                  </View>
                )}
              </View>

              <View className="flex-row items-center justify-between">
                <View className="flex-row gap-4">
                  <View>
                    <Text className="text-xs" style={{ color: colors.textSecondary }}>Ordered</Text>
                    <Text className="text-base font-bold" style={{ color: colors.textPrimary }}>{poi.quantity_ordered}</Text>
                  </View>
                  <View>
                    <Text className="text-xs" style={{ color: colors.textSecondary }}>Received</Text>
                    <Text className="text-base font-bold" style={{ color: isFullyReceived ? colors.success : colors.accent }}>
                      {poi.quantity_received}
                    </Text>
                  </View>
                </View>

                {!isTerminal && !isFullyReceived && (
                  <View>
                    <Text className="text-xs mb-1 text-center" style={{ color: colors.textSecondary }}>Receive</Text>
                    <View className="flex-row items-center gap-1">
                      <TouchableOpacity
                        disabled={receivingId === poi.id}
                        onPress={() => receiveItem(poi, 1)}
                        className="items-center justify-center rounded-lg"
                        style={{ width: 36, height: 36, backgroundColor: colors.successMuted }}>
                        {receivingId === poi.id ? (
                          <ActivityIndicator color={colors.success} size="small" />
                        ) : (
                          <Plus color={colors.success} size={16} />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        disabled={receivingId === poi.id}
                        onPress={() => receiveItem(poi, remaining)}
                        className="items-center justify-center rounded-lg px-2"
                        style={{ height: 36, backgroundColor: colors.accentMuted }}>
                        <Text className="text-xs font-semibold" style={{ color: colors.accent }}>All ({remaining})</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
