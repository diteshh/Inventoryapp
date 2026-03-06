import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useTeam } from '@/lib/team-context';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { ThemeColors } from '@/lib/theme-context';
import type { Item, PickList, PickListComment, PickListItem } from '@/lib/types';
import {
  formatCurrency,
  formatRelativeTime,
  getPickListStatusColor,
  getPickListStatusLabel,
  logActivity,
} from '@/lib/utils';
import { impactLight, impactMedium, notificationSuccess } from '@/lib/haptics';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  CheckCircle,
  ClipboardList,
  MessageCircle,
  MoreVertical,
  Package,
  Pencil,
  Plus,
  Send,
  Trash2,
  ZapIcon,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
  ready_to_pick: ['complete'],
  partially_complete: ['complete'],
  complete: [],
};

export default function PickListDetailScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const { user } = useAuth();
  const { teamId } = useTeam();
  const { colors, isDark } = useTheme();
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
  const [assignedName, setAssignedName] = useState<string | null>(null);
  const [pickedFloor, setPickedFloor] = useState<Record<string, number>>({});
  const pickingRef = useRef(false);
  const pickingModeRef = useRef(false);
  const commentsRef = useRef<FlatList>(null);
  const loadRef = useRef<() => Promise<void>>(async () => {});

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

    if (plRes.data) {
      setPickList(plRes.data as PickList);
      const pl = plRes.data as PickList;
      if (pl.assigned_to) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', pl.assigned_to)
          .single();
        setAssignedName(profile?.full_name ?? 'Unknown');
      } else {
        setAssignedName(null);
      }
    }
    setItems((itemsRes.data ?? []) as unknown as PickListItemWithItem[]);
    setComments((commentsRes.data ?? []) as PickListComment[]);
    setLoading(false);
    setRefreshing(false);
  }, [id]);

  loadRef.current = load;

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Realtime subscription
  useEffect(() => {
    if (!id) return;
    const safeLoad = () => { if (!pickingRef.current && !pickingModeRef.current) loadRef.current(); };
    const channel = supabase
      .channel(`pick_list_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pick_list_items', filter: `pick_list_id=eq.${id}` }, safeLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pick_lists', filter: `id=eq.${id}` }, safeLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pick_list_comments', filter: `pick_list_id=eq.${id}` }, safeLoad)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { pickingModeRef.current = pickingMode; }, [pickingMode]);

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
        teamId,
      });
      if (newStatus === 'complete') {
        await logActivity(user?.id, 'pick_list_completed', { pickListId: pickList.id, details: { name: pickList.name }, teamId });
      }
        notificationSuccess();
        load();
      } else {
      Alert.alert('Error', 'Failed to update status.');
    }
    setStatusUpdating(false);
  };

  // Local-only pick (no DB call until commit)
  const pickItem = (pli: PickListItemWithItem, newQty: number) => {
    if (newQty === pli.quantity_picked) return;
    setItems((prev) =>
      prev.map((i) => (i.id === pli.id ? { ...i, quantity_picked: newQty } : i))
    );
    impactLight();
  };

  // Batch commit picks to DB
  const commitPicks = async () => {
    if (!user || !pickList) return;
    pickingRef.current = true;
    try {
      for (const item of items) {
        const floor = pickedFloor[item.id] ?? 0;
        const delta = item.quantity_picked - floor;
        if (delta === 0) continue;
        if (delta > 0) {
          const { data: stockBefore } = await supabase
            .from('items')
            .select('quantity')
            .eq('id', item.item_id!)
            .single();
          const qtyBefore = stockBefore?.quantity ?? 0;
          const { error } = await supabase.rpc('pick_item', {
            p_pick_list_item_id: item.id,
            p_quantity_picked: item.quantity_picked,
            p_picked_by: user.id,
          });
          if (!error) {
            await supabase.from('transactions').insert({
              item_id: item.item_id,
              type: 'pick',
              quantity_change: -delta,
              quantity_before: qtyBefore,
              quantity_after: qtyBefore - delta,
              reference_type: 'pick_list',
              reference_id: pickList.id,
              notes: `Picked for: ${pickList.name}`,
              created_by: user.id,
              team_id: teamId ?? null,
            });
            await logActivity(user.id, 'quantity_adjusted', {
              itemId: item.item_id,
              details: {
                item_name: item.items?.name,
                old_qty: qtyBefore,
                new_qty: qtyBefore - delta,
                reason: `Picked for pick list: ${pickList.name}`,
              },
              teamId,
            });
          }
        }
      }
    } finally {
      pickingRef.current = false;
    }
  };

  const startPicking = () => {
    // Capture current DB quantities as floor
    const floor: Record<string, number> = {};
    for (const item of items) {
      floor[item.id] = item.quantity_picked;
    }
    setPickedFloor(floor);
    setPickingMode(true);
  };

  const stopPicking = async () => {
    await commitPicks();
    setPickingMode(false);
    load();
  };

  const completePickList = async (status: 'complete' | 'partially_complete') => {
    await commitPicks();
    // Optimistically update status so the bottom bar hides immediately
    setPickList((prev) => prev ? { ...prev, status } : prev);
    setPickingMode(false);
    await updateStatus(status);
    load();
  };

  const updateRequestedQty = async (pliId: string, qty: number) => {
    await supabase.from('pick_list_items').update({ quantity_requested: qty }).eq('id', pliId);
    setItems((prev) => prev.map((i) => i.id === pliId ? { ...i, quantity_requested: qty } : i));
    impactLight();
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
      team_id: teamId ?? null,
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
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  if (!pickList) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
        <Text style={{ color: colors.textSecondary }}>Pick list not found.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 px-4 py-2 rounded-xl" style={{ backgroundColor: colors.surface }}>
          <Text style={{ color: colors.accent }}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const pickedCount = items.filter((i) => i.quantity_picked >= i.quantity_requested).length;
  const progressPct = items.length > 0 ? (pickedCount / items.length) * 100 : 0;
  const nextStatuses = STATUS_TRANSITIONS[pickList.status] ?? [];
  const statusColor = getPickListStatusColor(pickList.status, colors);
  const isDraft = pickList.status === 'draft';
  const canPick = pickList.assigned_to === null || pickList.assigned_to === user?.id;
  const allPicked = items.length > 0 && items.every((i) => i.quantity_picked >= i.quantity_requested);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View className="px-5 py-3 flex-row items-center justify-between">
          <TouchableOpacity onPress={() => router.back()} className="rounded-xl p-2" style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
            <ArrowLeft color={colors.textPrimary} size={20} />
          </TouchableOpacity>
          <View className="flex-1 mx-3 flex-row items-center">
            <Text className="text-base font-bold" numberOfLines={1} style={{ color: colors.textPrimary }}>
              {pickList.name}
            </Text>
            {isDraft && (
              <View className="ml-2 rounded-full px-2 py-0.5" style={{ backgroundColor: colors.warningMuted }}>
                <Text style={{ color: colors.warning, fontSize: 10, fontWeight: '700' }}>Draft</Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={showOptions} className="rounded-xl p-2" style={{ backgroundColor: colors.surface }}>
            <MoreVertical color={colors.textPrimary} size={18} />
          </TouchableOpacity>
        </View>

        {/* Info Strip — hidden for drafts */}
        {!isDraft && (
          <View className="mx-5 mb-4 rounded-2xl p-4" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: isDark ? colors.border : colors.borderLight, ...getCardShadow(isDark) }}>
            <View className="flex-row items-center justify-between mb-3">
              <StatusBadge status={pickList.status} size="sm" />
              <Text className="text-xs" style={{ color: colors.textSecondary }}>
                {formatRelativeTime(pickList.updated_at)}
              </Text>
            </View>

            {/* Assigned to */}
            <Text className="text-xs mb-3" style={{ color: colors.textSecondary }}>
              Assigned to: {assignedName ?? 'Everyone'}
            </Text>

            {/* Progress bar */}
            {items.length > 0 && (
              <View className="mb-3">
                <View className="flex-row justify-between mb-1.5">
                  <Text className="text-xs" style={{ color: colors.textSecondary }}>
                    {pickedCount} / {items.length} items picked
                  </Text>
                  <Text className="text-xs font-semibold" style={{ color: progressPct === 100 ? colors.success : colors.accent }}>
                    {Math.round(progressPct)}%
                  </Text>
                </View>
                <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.background }}>
                  <View
                    className="h-2 rounded-full"
                    style={{ width: `${progressPct}%`, backgroundColor: progressPct === 100 ? colors.success : colors.accent }}
                  />
                </View>
              </View>
            )}

            {pickList.notes ? (
              <Text className="text-xs mb-3" style={{ color: colors.textSecondary }}>
                {pickList.notes}
              </Text>
            ) : null}

          </View>
        )}

        {/* Tabs */}
        <View className="mx-5 mb-3 flex-row rounded-xl p-1" style={{ backgroundColor: colors.surface }}>
          {(['items', 'comments'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className="flex-1 items-center rounded-lg py-2"
              style={{ backgroundColor: activeTab === tab ? colors.accent : 'transparent' }}>
              <Text className="text-sm font-semibold" style={{ color: activeTab === tab ? colors.accentOnAccent : colors.textSecondary }}>
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
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }}
              showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                  pickList.status === 'complete' ? (
                    <View className="mb-6 rounded-2xl p-4" style={{ backgroundColor: colors.accentMuted, borderWidth: 1, borderColor: `${colors.accent}33` }}>
                      <View className="flex-row items-center gap-2 mb-3">
                        <CheckCircle size={16} color={colors.success} />
                        <Text className="text-sm font-bold" style={{ color: colors.textPrimary }}>Inventory Deduction Summary</Text>
                      </View>
                      <View className="flex-row items-center justify-between mb-2 px-1">
                        <Text className="text-[10px] font-bold flex-1" style={{ color: colors.textSecondary }}>ITEM NAME</Text>
                        <Text className="text-[10px] font-bold w-14 text-center" style={{ color: colors.textSecondary }}>PICKED</Text>
                        <Text className="text-[10px] font-bold w-16 text-right" style={{ color: colors.textSecondary }}>REMAINING</Text>
                      </View>
                      {items.filter(pli => pli.quantity_picked > 0).map(pli => (
                        <View key={pli.id} className="flex-row items-center justify-between py-2 border-t" style={{ borderColor: `${colors.border}33` }}>
                          <Text className="text-xs flex-1 pr-2" numberOfLines={1} style={{ color: colors.textPrimary }}>{pli.items?.name ?? 'Unknown'}</Text>
                          <Text className="text-xs font-bold w-14 text-center" style={{ color: colors.textPrimary }}>{pli.quantity_picked}</Text>
                          <Text className="text-xs font-bold w-16 text-right" style={{ color: colors.accent }}>{pli.items?.quantity ?? 0}</Text>
                        </View>
                      ))}
                      <View className="mt-3 pt-3 border-t" style={{ borderColor: `${colors.accent}33` }}>
                        <Text className="text-[10px] italic text-center" style={{ color: colors.textSecondary }}>
                          * All quantities were automatically deducted from main inventory.
                        </Text>
                      </View>
                    </View>
                  ) : null
                }
              ListEmptyComponent={
                <View className="items-center justify-center" style={{ paddingTop: 150 }}>
                  <ClipboardList color={colors.textSecondary} size={32} />
                  <Text className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
                    No items in this pick list
                  </Text>
                  {pickList.status !== 'complete' && (
                    <TouchableOpacity
                      onPress={() => router.push(`/pick-list/add-item?pickListId=${id}`)}
                      className="mt-5 flex-row items-center justify-center gap-2 rounded-2xl py-4 px-10"
                      style={{ backgroundColor: colors.accent }}>
                      <Plus color={colors.accentOnAccent} size={20} />
                      <Text className="text-base font-bold" style={{ color: colors.accentOnAccent }}>Add Items</Text>
                    </TouchableOpacity>
                  )}
                </View>
              }
              renderItem={({ item: pli }) => (
                <PickListItemRow
                  pli={pli}
                  pickingMode={pickingMode && pickList.status !== 'complete'}
                  canEdit={pickList.status === 'draft'}
                  pickedFloor={pickedFloor[pli.id] ?? 0}
                  onPick={(qty) => pickItem(pli, qty)}
                  onUpdateRequested={(qty) => updateRequestedQty(pli.id, qty)}
                  onRemove={() => removePickListItem(pli.id)}
                  colors={colors}
                  isDark={isDark}
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
                  <MessageCircle color={colors.textSecondary} size={32} />
                  <Text className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
                    No comments yet
                  </Text>
                </View>
              }
              renderItem={({ item: comment }) => (
                <View
                  className="mb-2 rounded-xl p-3"
                  style={{
                    backgroundColor: comment.user_id === user?.id ? colors.accentMuted : colors.surface,
                    borderWidth: 1,
                    borderColor: comment.user_id === user?.id ? `${colors.accent}44` : colors.border,
                    alignSelf: comment.user_id === user?.id ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                  }}>
                  <Text className="text-sm" style={{ color: colors.textPrimary }}>{comment.content}</Text>
                  <Text className="mt-1 text-xs" style={{ color: colors.textSecondary }}>
                    {formatRelativeTime(comment.created_at)}
                  </Text>
                </View>
              )}
            />
            {/* Comment input */}
            <View
              className="mx-5 mb-2 flex-row items-center gap-2 rounded-2xl px-4 py-2"
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
              <TextInput
                className="flex-1 text-sm py-1.5"
                style={{ color: colors.textPrimary }}
                placeholder="Add a comment..."
                placeholderTextColor={colors.textSecondary}
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                onPress={sendComment}
                disabled={!commentText.trim() || sendingComment}
                className="rounded-xl p-2"
                style={{ backgroundColor: commentText.trim() ? colors.accent : colors.background }}>
                {sendingComment ? (
                  <ActivityIndicator size="small" color={colors.accentOnAccent} />
                ) : (
                  <Send size={16} color={commentText.trim() ? colors.accentOnAccent : colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Bottom bar */}
        {activeTab === 'items' && pickList.status !== 'complete' && (
          <View className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-3" style={{ backgroundColor: colors.background }}>
            {isDraft ? (
              items.length > 0 ? (
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => router.push(`/pick-list/add-item?pickListId=${id}`)}
                    className="flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl py-3.5"
                    style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...getCardShadow(isDark) }}>
                    <Pencil size={16} color={colors.accent} />
                    <Text className="text-sm font-bold" style={{ color: colors.textPrimary }}>Manage Items</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => router.push(`/pick-list/ready-confirm?pickListId=${id}`)}
                    disabled={statusUpdating}
                    className="flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl py-3.5"
                    style={{ backgroundColor: colors.accent, ...getCardShadow(isDark) }}>
                    <ZapIcon size={16} color={colors.accentOnAccent} />
                    <Text className="text-sm font-bold" style={{ color: colors.accentOnAccent }}>Mark Ready</Text>
                  </TouchableOpacity>
                </View>
              ) : null
            ) : canPick ? (
              !pickingMode ? (
                <TouchableOpacity
                  onPress={startPicking}
                  className="flex-row items-center justify-center gap-2 rounded-2xl py-3.5"
                  style={{ backgroundColor: colors.accent, ...getCardShadow(isDark) }}>
                  <ClipboardList size={18} color={colors.accentOnAccent} />
                  <Text className="text-sm font-bold" style={{ color: colors.accentOnAccent }}>Start Picking</Text>
                </TouchableOpacity>
              ) : (
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={stopPicking}
                    className="flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl py-3.5"
                    style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...getCardShadow(isDark) }}>
                    <Text className="text-sm font-bold" style={{ color: colors.textPrimary }}>Stop Picking</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => completePickList(allPicked ? 'complete' : 'partially_complete')}
                    disabled={statusUpdating}
                    className="flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl py-3.5"
                    style={{ backgroundColor: allPicked ? colors.success : colors.warning, ...getCardShadow(isDark) }}>
                    {statusUpdating ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <CheckCircle size={16} color="#fff" />
                        <Text className="text-sm font-bold" style={{ color: '#fff' }}>
                          {allPicked ? 'Complete' : 'Partially Complete'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )
            ) : null}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PickListItemRow({
  pli,
  pickingMode,
  canEdit,
  pickedFloor,
  onPick,
  onUpdateRequested,
  onRemove,
  colors,
  isDark,
}: {
  pli: PickListItemWithItem;
  pickingMode: boolean;
  canEdit: boolean;
  pickedFloor: number;
  onPick: (qty: number) => void;
  onUpdateRequested: (qty: number) => void;
  onRemove: () => void;
  colors: ThemeColors;
  isDark: boolean;
}) {
  const [qtyText, setQtyText] = useState(String(pli.quantity_picked));
  const [isEditingQty, setIsEditingQty] = useState(false);
  const [reqText, setReqText] = useState(String(pli.quantity_requested));
  const [isEditingReq, setIsEditingReq] = useState(false);

  // Sync qtyText with pli.quantity_picked when not editing
  useEffect(() => {
    if (!isEditingQty) setQtyText(String(pli.quantity_picked));
  }, [pli.quantity_picked, isEditingQty]);

  useEffect(() => {
    if (!isEditingReq) setReqText(String(pli.quantity_requested));
  }, [pli.quantity_requested, isEditingReq]);

  const isPicked = pli.quantity_picked >= pli.quantity_requested;
  const isPartial = pli.quantity_picked > 0 && !isPicked;

  const rowBg = isPicked ? colors.successMuted : colors.surface;
  const borderColor = isPicked ? `${colors.success}44` : isDark ? colors.borderLight : colors.border;

  const atMin = pli.quantity_picked <= pickedFloor;
  const atMax = pli.quantity_picked >= pli.quantity_requested;

  const commitQtyText = () => {
    setIsEditingQty(false);
    const num = parseInt(qtyText, 10);
    if (isNaN(num) || num < pickedFloor) {
      setQtyText(String(pickedFloor));
      onPick(pickedFloor);
    } else {
      const clamped = Math.min(num, pli.quantity_requested);
      setQtyText(String(clamped));
      onPick(clamped);
    }
  };

  const commitReqText = () => {
    setIsEditingReq(false);
    const num = parseInt(reqText, 10);
    if (isNaN(num) || num < 1) {
      setReqText('1');
      onUpdateRequested(1);
    } else {
      const clamped = Math.min(num, pli.items?.quantity ?? 9999);
      setReqText(String(clamped));
      onUpdateRequested(clamped);
    }
  };

  return (
    <View
      className="mb-3 rounded-2xl p-4"
      style={{ backgroundColor: rowBg, borderWidth: 1, borderColor, ...(!isPicked ? getCardShadow(isDark) : {}) }}>
      <View className="flex-row items-start gap-3">
        {/* Pick checkbox */}
        {pickingMode && (
          <TouchableOpacity
            onPress={() => onPick(isPicked ? pickedFloor : pli.quantity_requested)}
            className="mt-0.5 items-center justify-center rounded-full"
            style={{
              width: 26,
              height: 26,
              backgroundColor: isPicked ? colors.success : colors.background,
              borderWidth: 2,
              borderColor: isPicked ? colors.success : colors.border,
            }}>
            {isPicked && <CheckCircle size={14} color={colors.accentOnAccent} fill={colors.accentOnAccent} />}
          </TouchableOpacity>
        )}

        {/* Item icon */}
        <View
          className="items-center justify-center rounded-xl p-2.5"
          style={{ backgroundColor: colors.accentMuted }}>
          <Package color={colors.accent} size={18} />
        </View>

        {/* Info */}
        <View className="flex-1">
          <Text className="font-semibold" numberOfLines={2} style={{ opacity: isPicked && pickingMode ? 0.5 : 1, color: colors.textPrimary }}>
            {pli.items?.name ?? 'Unknown Item'}
          </Text>
          {pli.items?.sku && (
            <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
              SKU: {pli.items.sku}
            </Text>
          )}
          {(pli.location_hint ?? pli.items?.location) && (
            <Text className="text-xs mt-0.5" style={{ color: colors.accent }}>
              {'\uD83D\uDCCD'} {pli.location_hint ?? pli.items?.location}
            </Text>
          )}

          {/* Quantity requested stepper — inline in edit mode */}
          {canEdit && !pickingMode && (
            <View className="mt-6 items-start">
              <View className="flex-row items-center gap-3">
                <Pressable
                  onPress={() => { if (pli.quantity_requested > 1) onUpdateRequested(pli.quantity_requested - 1); }}
                  className="items-center justify-center rounded-xl"
                  style={{ width: 40, height: 40, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, opacity: pli.quantity_requested <= 1 ? 0.4 : 1 }}>
                  <Text className="font-bold text-lg" style={{ color: colors.textPrimary }}>{'\u2212'}</Text>
                </Pressable>
                <TextInput
                  style={{
                    minWidth: 56,
                    textAlign: 'center',
                    color: colors.textPrimary,
                    fontWeight: '800',
                    fontSize: 18,
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                  }}
                  keyboardType="number-pad"
                  value={reqText}
                  onFocus={() => setIsEditingReq(true)}
                  onChangeText={(text) => setReqText(text.replace(/[^0-9]/g, ''))}
                  onBlur={commitReqText}
                  onSubmitEditing={commitReqText}
                  selectTextOnFocus
                />
                <Pressable
                  onPress={() => { if (pli.quantity_requested < (pli.items?.quantity ?? 9999)) onUpdateRequested(pli.quantity_requested + 1); }}
                  className="items-center justify-center rounded-xl"
                  style={{ width: 40, height: 40, backgroundColor: colors.accent, opacity: pli.quantity_requested >= (pli.items?.quantity ?? 9999) ? 0.4 : 1 }}>
                  <Text style={{ color: colors.accentOnAccent }} className="font-bold text-lg">+</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* Right side */}
        <View className="items-end gap-1.5">
          {canEdit && !pickingMode && (
            <TouchableOpacity onPress={onRemove} className="p-1.5 rounded-lg" style={{ backgroundColor: colors.destructiveMuted }}>
              <Trash2 size={13} color={colors.destructive} />
            </TouchableOpacity>
          )}
          <View className="items-end">
            <Text className="text-sm font-bold" style={{ color: colors.textPrimary }}>
              {pli.quantity_picked} / {pli.quantity_requested}
            </Text>
            <Text className="text-xs" style={{ color: colors.textSecondary }}>picked</Text>
            {pli.items != null && (
              <Text className="text-[10px] mt-0.5" style={{ color: colors.accent }}>
                Stock: {pli.items.quantity}
              </Text>
            )}
          </View>
          {pli.unit_price != null && (
            <Text className="text-xs" style={{ color: colors.textSecondary }}>
              {formatCurrency(pli.unit_price)}
            </Text>
          )}
        </View>
      </View>

      {/* Picking quantity stepper */}
      {pickingMode && (
        <View className="mt-3 flex-row items-center justify-between">
          <Text className="text-xs" style={{ color: colors.textSecondary }}>Qty picked:</Text>
          <View className="flex-row items-center gap-1.5">
            <Pressable
              onPress={() => { if (!atMin) onPick(pli.quantity_picked - 1); }}
              className="items-center justify-center rounded-lg"
              style={{ width: 32, height: 32, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, opacity: atMin ? 0.4 : 1 }}>
              <Text className="font-bold text-base" style={{ color: colors.textPrimary }}>{'\u2212'}</Text>
            </Pressable>
            <TextInput
              style={{
                minWidth: 40,
                textAlign: 'center',
                color: colors.textPrimary,
                fontWeight: '700',
                fontSize: 14,
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                paddingVertical: 4,
                paddingHorizontal: 6,
              }}
              keyboardType="number-pad"
              value={qtyText}
              onFocus={() => setIsEditingQty(true)}
              onChangeText={(text) => setQtyText(text.replace(/[^0-9]/g, ''))}
              onBlur={commitQtyText}
              onSubmitEditing={commitQtyText}
              selectTextOnFocus
            />
            <Pressable
              onPress={() => { if (!atMax) onPick(pli.quantity_picked + 1); }}
              className="items-center justify-center rounded-lg"
              style={{ width: 32, height: 32, backgroundColor: colors.accent, opacity: atMax ? 0.4 : 1 }}>
              <Text style={{ color: colors.accentOnAccent }} className="font-bold text-base">+</Text>
            </Pressable>
            <TouchableOpacity
              onPress={() => onPick(pli.quantity_requested)}
              className="items-center rounded-lg py-1.5 px-3 ml-1"
              style={{ backgroundColor: colors.successMuted, borderWidth: 1, borderColor: `${colors.success}55` }}>
              <Text className="text-xs font-semibold" style={{ color: colors.success }}>Pick All</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
