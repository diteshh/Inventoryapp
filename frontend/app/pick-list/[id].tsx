import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/lib/theme';
import type { Item, PickList, PickListComment, PickListItem } from '@/lib/types';
import {
  formatCurrency,
  formatRelativeTime,
  getPickListStatusColor,
  getPickListStatusLabel,
  logActivity,
} from '@/lib/utils';
import { impactLight, impactMedium, notificationSuccess } from '@/lib/haptics';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  CheckCircle,
  ClipboardList,
  MessageCircle,
  MoreVertical,
  Package,
  Plus,
  Send,
  Trash2,
  ZapIcon,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBadge } from '@/components/ui/Badge';

type PickListItemWithItem = PickListItem & { items: Item | null };

const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['ready_to_pick'],
  ready_to_pick: ['in_progress', 'draft'],
  in_progress: ['partially_complete', 'complete'],
  partially_complete: ['in_progress', 'complete'],
  complete: [],
};

export default function PickListDetailScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const { user } = useAuth();
  const [pickList, setPickList] = useState<PickList | null>(null);
  const [items, setItems] = useState<PickListItemWithItem[]>([]);
  const [comments, setComments] = useState<PickListComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'items' | 'comments'>('items');
  const [pickingMode, setPickingMode] = useState(mode === 'picking');
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const commentsRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const [plRes, itemsRes, commentsRes] = await Promise.all([
      supabase.from('pick_lists').select('*').eq('id', id).single(),
      supabase
        .from('pick_list_items')
        .select('*, items(*)')
        .eq('pick_list_id', id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('pick_list_comments')
        .select('*')
        .eq('pick_list_id', id)
        .order('created_at', { ascending: true }),
    ]);

    if (plRes.data) setPickList(plRes.data as PickList);
    setItems((itemsRes.data ?? []) as unknown as PickListItemWithItem[]);
    setComments((commentsRes.data ?? []) as PickListComment[]);
    setLoading(false);
    setRefreshing(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime subscription
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`pick_list_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pick_list_items', filter: `pick_list_id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pick_lists', filter: `id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pick_list_comments', filter: `pick_list_id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, load]);

  const updateStatus = async (newStatus: string) => {
    if (!pickList) return;
    setStatusUpdating(true);
    const { error } = await supabase
      .from('pick_lists')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', pickList.id);
    if (!error) {
      await logActivity(user?.id, 'pick_list_updated', {
        pickListId: pickList.id,
        details: { name: pickList.name, status: newStatus },
      });
      if (newStatus === 'complete') {
        await logActivity(user?.id, 'pick_list_completed', { pickListId: pickList.id, details: { name: pickList.name } });
      }
        notificationSuccess();
        load();
      } else {
      Alert.alert('Error', 'Failed to update status.');
    }
    setStatusUpdating(false);
  };

  const pickItem = async (pli: PickListItemWithItem, qty: number) => {
    if (!user || !pickList) return;
    
    // Call the atomic pick_item RPC function
    const { data, error } = await supabase.rpc('pick_item', {
      p_pick_list_item_id: pli.id,
      p_quantity_picked: qty,
      p_picked_by: user.id
    });

    if (error) {
      console.error('Pick error:', error);
      Alert.alert('Cannot Pick Item', error.message);
      return;
    }

    impactLight();
    load();
  };

  const removePickListItem = async (pliId: string) => {
    await supabase.from('pick_list_items').delete().eq('id', pliId);
    impactMedium();
    load();
  };

  const sendComment = async () => {
    if (!commentText.trim() || !id || !user) return;
    setSendingComment(true);
    await supabase.from('pick_list_comments').insert({
      pick_list_id: id,
      user_id: user.id,
      content: commentText.trim(),
    });
    setCommentText('');
    setSendingComment(false);
    impactLight();
  };

  const deletePickList = () => {
    Alert.alert('Delete Pick List', `Delete "${pickList?.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('pick_list_items').delete().eq('pick_list_id', id!);
          await supabase.from('pick_list_comments').delete().eq('pick_list_id', id!);
            await supabase.from('pick_lists').delete().eq('id', id!);
            notificationSuccess();
          router.replace('/(tabs)/pick-lists');
        },
      },
    ]);
  };

  const showOptions = () => {
    Alert.alert('Options', 'Choose an action', [
      { text: 'Delete Pick List', style: 'destructive', onPress: deletePickList },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: COLORS.navy }}>
        <ActivityIndicator color={COLORS.teal} size="large" />
      </SafeAreaView>
    );
  }

  if (!pickList) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: COLORS.navy }}>
        <Text style={{ color: COLORS.textSecondary }}>Pick list not found.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 px-4 py-2 rounded-xl" style={{ backgroundColor: COLORS.navyCard }}>
          <Text style={{ color: COLORS.teal }}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const pickedCount = items.filter((i) => i.quantity_picked >= i.quantity_requested).length;
  const progressPct = items.length > 0 ? (pickedCount / items.length) * 100 : 0;
  const nextStatuses = STATUS_TRANSITIONS[pickList.status] ?? [];
  const statusColor = getPickListStatusColor(pickList.status);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.navy }}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View className="px-5 py-3 flex-row items-center justify-between">
          <TouchableOpacity onPress={() => router.back()} className="rounded-xl p-2" style={{ backgroundColor: COLORS.navyCard }}>
            <ArrowLeft color={COLORS.textPrimary} size={20} />
          </TouchableOpacity>
          <Text className="text-base font-bold text-white flex-1 mx-3" numberOfLines={1}>
            {pickList.name}
          </Text>
          <View className="flex-row items-center gap-2">
            {pickList.status !== 'complete' && pickList.status !== 'draft' && (
              <TouchableOpacity
                onPress={() => setPickingMode(!pickingMode)}
                className="rounded-xl px-3 py-2"
                style={{ backgroundColor: pickingMode ? COLORS.teal : COLORS.navyCard }}>
                <Text className="text-xs font-bold" style={{ color: pickingMode ? COLORS.navy : COLORS.teal }}>
                  {pickingMode ? 'Stop' : 'Pick'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={showOptions} className="rounded-xl p-2" style={{ backgroundColor: COLORS.navyCard }}>
              <MoreVertical color={COLORS.textPrimary} size={18} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Info Strip */}
        <View className="mx-5 mb-4 rounded-2xl p-4" style={{ backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.border }}>
          <View className="flex-row items-center justify-between mb-3">
            <StatusBadge status={pickList.status} size="sm" />
            <Text className="text-xs" style={{ color: COLORS.textSecondary }}>
              {formatRelativeTime(pickList.updated_at)}
            </Text>
          </View>

          {/* Progress bar */}
          {items.length > 0 && (
            <View className="mb-3">
              <View className="flex-row justify-between mb-1.5">
                <Text className="text-xs" style={{ color: COLORS.textSecondary }}>
                  {pickedCount} / {items.length} items picked
                </Text>
                <Text className="text-xs font-semibold" style={{ color: progressPct === 100 ? COLORS.success : COLORS.teal }}>
                  {Math.round(progressPct)}%
                </Text>
              </View>
              <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: COLORS.navy }}>
                <View
                  className="h-2 rounded-full"
                  style={{ width: `${progressPct}%`, backgroundColor: progressPct === 100 ? COLORS.success : COLORS.teal }}
                />
              </View>
            </View>
          )}

          {pickList.notes ? (
            <Text className="text-xs mb-3" style={{ color: COLORS.textSecondary }}>
              {pickList.notes}
            </Text>
          ) : null}

          {/* Status Actions */}
          {nextStatuses.length > 0 && (
            <View className="flex-row gap-2">
              {nextStatuses.map((ns) => {
                const nsColor = getPickListStatusColor(ns);
                const isForward = ['ready_to_pick', 'in_progress', 'partially_complete', 'complete'].indexOf(ns) >
                  ['ready_to_pick', 'in_progress', 'partially_complete', 'complete'].indexOf(pickList.status);
                return (
                  <TouchableOpacity
                    key={ns}
                    onPress={() => updateStatus(ns)}
                    disabled={statusUpdating}
                    className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2.5 px-3"
                    style={{ backgroundColor: isForward ? `${nsColor}22` : COLORS.navy, borderWidth: 1, borderColor: isForward ? `${nsColor}55` : COLORS.border }}>
                    {statusUpdating ? (
                      <ActivityIndicator size="small" color={nsColor} />
                    ) : (
                      <>
                        {ns === 'complete' ? <CheckCircle size={14} color={nsColor} /> : <ZapIcon size={14} color={nsColor} />}
                        <Text className="text-xs font-semibold" style={{ color: nsColor }}>
                          {getPickListStatusLabel(ns)}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Tabs */}
        <View className="mx-5 mb-3 flex-row rounded-xl p-1" style={{ backgroundColor: COLORS.navyCard }}>
          {(['items', 'comments'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className="flex-1 items-center rounded-lg py-2"
              style={{ backgroundColor: activeTab === tab ? COLORS.teal : 'transparent' }}>
              <Text className="text-sm font-semibold" style={{ color: activeTab === tab ? COLORS.navy : COLORS.textSecondary }}>
                {tab === 'items' ? `Items (${items.length})` : `Comments (${comments.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'items' ? (
          <>
            <FlatList
              data={items}
              keyExtractor={(i) => i.id}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                  pickList.status === 'complete' ? (
                    <View className="mb-6 rounded-2xl p-4" style={{ backgroundColor: `${COLORS.teal}11`, borderWidth: 1, borderColor: `${COLORS.teal}33` }}>
                      <View className="flex-row items-center gap-2 mb-3">
                        <CheckCircle size={16} color={COLORS.success} />
                        <Text className="text-sm font-bold text-white">Inventory Deduction Summary</Text>
                      </View>
                      <View className="flex-row items-center justify-between mb-2 px-1">
                        <Text className="text-[10px] font-bold flex-1" style={{ color: COLORS.textSecondary }}>ITEM NAME</Text>
                        <Text className="text-[10px] font-bold w-14 text-center" style={{ color: COLORS.textSecondary }}>PICKED</Text>
                        <Text className="text-[10px] font-bold w-16 text-right" style={{ color: COLORS.textSecondary }}>REMAINING</Text>
                      </View>
                      {items.filter(pli => pli.quantity_picked > 0).map(pli => (
                        <View key={pli.id} className="flex-row items-center justify-between py-2 border-t" style={{ borderColor: `${COLORS.border}33` }}>
                          <Text className="text-xs text-white flex-1 pr-2" numberOfLines={1}>{pli.items?.name ?? 'Unknown'}</Text>
                          <Text className="text-xs text-white font-bold w-14 text-center">{pli.quantity_picked}</Text>
                          <Text className="text-xs font-bold w-16 text-right" style={{ color: COLORS.teal }}>{pli.items?.quantity ?? 0}</Text>
                        </View>
                      ))}
                      <View className="mt-3 pt-3 border-t" style={{ borderColor: `${COLORS.teal}33` }}>
                        <Text className="text-[10px] italic text-center" style={{ color: COLORS.textSecondary }}>
                          * All quantities were automatically deducted from main inventory.
                        </Text>
                      </View>
                    </View>
                  ) : pickList.status !== 'complete' ? (
                    <TouchableOpacity
                      onPress={() => router.push(`/pick-list/add-item?pickListId=${id}`)}
                      className="mb-3 flex-row items-center justify-center gap-2 rounded-2xl py-3.5"
                      style={{ backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: `${COLORS.teal}44`, borderStyle: 'dashed' }}>
                      <Plus color={COLORS.teal} size={16} />
                      <Text className="text-sm font-semibold" style={{ color: COLORS.teal }}>
                        Add Items
                      </Text>
                    </TouchableOpacity>
                  ) : null
                }
              ListEmptyComponent={
                <View className="items-center py-12">
                  <ClipboardList color={COLORS.textSecondary} size={32} />
                  <Text className="mt-3 text-sm" style={{ color: COLORS.textSecondary }}>
                    No items in this pick list
                  </Text>
                </View>
              }
              renderItem={({ item: pli }) => (
                <PickListItemRow
                  pli={pli}
                  pickingMode={pickingMode && pickList.status !== 'complete'}
                  canEdit={pickList.status !== 'complete'}
                  onPick={(qty) => pickItem(pli, qty)}
                  onRemove={() => removePickListItem(pli.id)}
                />
              )}
            />
          </>
        ) : (
          <>
            <FlatList
              ref={commentsRef}
              data={comments}
              keyExtractor={(c) => c.id}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => commentsRef.current?.scrollToEnd({ animated: true })}
              ListEmptyComponent={
                <View className="items-center py-12">
                  <MessageCircle color={COLORS.textSecondary} size={32} />
                  <Text className="mt-3 text-sm" style={{ color: COLORS.textSecondary }}>
                    No comments yet
                  </Text>
                </View>
              }
              renderItem={({ item: comment }) => (
                <View
                  className="mb-2 rounded-xl p-3"
                  style={{
                    backgroundColor: comment.user_id === user?.id ? `${COLORS.teal}22` : COLORS.navyCard,
                    borderWidth: 1,
                    borderColor: comment.user_id === user?.id ? `${COLORS.teal}44` : COLORS.border,
                    alignSelf: comment.user_id === user?.id ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                  }}>
                  <Text className="text-sm text-white">{comment.content}</Text>
                  <Text className="mt-1 text-xs" style={{ color: COLORS.textSecondary }}>
                    {formatRelativeTime(comment.created_at)}
                  </Text>
                </View>
              )}
            />
            {/* Comment input */}
            <View
              className="mx-5 mb-2 flex-row items-center gap-2 rounded-2xl px-4 py-2"
              style={{ backgroundColor: COLORS.navyCard, borderWidth: 1, borderColor: COLORS.border }}>
              <TextInput
                className="flex-1 text-sm text-white py-1.5"
                placeholder="Add a comment..."
                placeholderTextColor={COLORS.textSecondary}
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                onPress={sendComment}
                disabled={!commentText.trim() || sendingComment}
                className="rounded-xl p-2"
                style={{ backgroundColor: commentText.trim() ? COLORS.teal : COLORS.navy }}>
                {sendingComment ? (
                  <ActivityIndicator size="small" color={COLORS.navy} />
                ) : (
                  <Send size={16} color={commentText.trim() ? COLORS.navy : COLORS.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PickListItemRow({
  pli,
  pickingMode,
  canEdit,
  onPick,
  onRemove,
}: {
  pli: PickListItemWithItem;
  pickingMode: boolean;
  canEdit: boolean;
  onPick: (qty: number) => void;
  onRemove: () => void;
}) {
  const isPicked = pli.quantity_picked >= pli.quantity_requested;
  const isPartial = pli.quantity_picked > 0 && !isPicked;

  const rowBg = isPicked ? `${COLORS.success}11` : isPartial ? `${COLORS.warning}11` : COLORS.navyCard;
  const borderColor = isPicked ? `${COLORS.success}44` : isPartial ? `${COLORS.warning}44` : COLORS.border;

  return (
    <View
      className="mb-3 rounded-2xl p-4"
      style={{ backgroundColor: rowBg, borderWidth: 1, borderColor }}>
      <View className="flex-row items-start gap-3">
        {/* Pick checkbox */}
        {pickingMode && (
          <TouchableOpacity
            onPress={() => onPick(isPicked ? 0 : pli.quantity_requested)}
            className="mt-0.5 items-center justify-center rounded-full"
            style={{
              width: 26,
              height: 26,
              backgroundColor: isPicked ? COLORS.success : COLORS.navy,
              borderWidth: 2,
              borderColor: isPicked ? COLORS.success : COLORS.border,
            }}>
            {isPicked && <CheckCircle size={14} color={COLORS.navy} fill={COLORS.navy} />}
          </TouchableOpacity>
        )}

        {/* Item icon */}
        <View
          className="items-center justify-center rounded-xl p-2.5"
          style={{ backgroundColor: `${COLORS.teal}22` }}>
          <Package color={COLORS.teal} size={18} />
        </View>

        {/* Info */}
        <View className="flex-1">
          <Text className="font-semibold text-white" numberOfLines={2} style={{ opacity: isPicked && pickingMode ? 0.5 : 1 }}>
            {pli.items?.name ?? 'Unknown Item'}
          </Text>
          {pli.items?.sku && (
            <Text className="text-xs mt-0.5" style={{ color: COLORS.textSecondary }}>
              SKU: {pli.items.sku}
            </Text>
          )}
          {(pli.location_hint ?? pli.items?.location) && (
            <Text className="text-xs mt-0.5" style={{ color: COLORS.teal }}>
              📍 {pli.location_hint ?? pli.items?.location}
            </Text>
          )}
        </View>

        {/* Right side */}
        <View className="items-end gap-1.5">
          {canEdit && !pickingMode && (
            <TouchableOpacity onPress={onRemove} className="p-1.5 rounded-lg" style={{ backgroundColor: `${COLORS.destructive}22` }}>
              <Trash2 size={13} color={COLORS.destructive} />
            </TouchableOpacity>
          )}
          <View className="items-end">
            <Text className="text-sm font-bold text-white">
              {pli.quantity_picked} / {pli.quantity_requested}
            </Text>
            <Text className="text-xs" style={{ color: COLORS.textSecondary }}>picked</Text>
            {pli.items != null && (
              <Text className="text-[10px] mt-0.5" style={{ color: COLORS.teal }}>
                Stock: {pli.items.quantity}
              </Text>
            )}
          </View>
          {pli.unit_price != null && (
            <Text className="text-xs" style={{ color: COLORS.textSecondary }}>
              {formatCurrency(pli.unit_price)}
            </Text>
          )}
        </View>
      </View>

      {/* Picking quantity stepper */}
      {pickingMode && !isPicked && (
        <View className="mt-3 flex-row items-center gap-3">
          <Text className="text-xs" style={{ color: COLORS.textSecondary }}>Qty picked:</Text>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => onPick(Math.max(0, pli.quantity_picked - 1))}
              className="items-center justify-center rounded-lg"
              style={{ width: 30, height: 30, backgroundColor: COLORS.navy, borderWidth: 1, borderColor: COLORS.border }}>
              <Text className="text-white font-bold text-base">−</Text>
            </TouchableOpacity>
            <Text className="text-sm font-bold text-white" style={{ minWidth: 28, textAlign: 'center' }}>
              {pli.quantity_picked}
            </Text>
            <TouchableOpacity
              onPress={() => onPick(Math.min(pli.quantity_requested, pli.quantity_picked + 1))}
              className="items-center justify-center rounded-lg"
              style={{ width: 30, height: 30, backgroundColor: COLORS.teal }}>
              <Text style={{ color: COLORS.navy }} className="font-bold text-base">+</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => onPick(pli.quantity_requested)}
            className="flex-1 items-center rounded-lg py-1.5"
            style={{ backgroundColor: `${COLORS.success}22`, borderWidth: 1, borderColor: `${COLORS.success}55` }}>
            <Text className="text-xs font-semibold" style={{ color: COLORS.success }}>Pick All</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
