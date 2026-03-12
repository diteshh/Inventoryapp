import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useTeam } from '@/lib/team-context';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { ThemeColors } from '@/lib/theme-context';
import type { Item, PickList, PickListComment, PickListItem, PickListIssue } from '@/lib/types';
import {
  formatCurrency,
  formatRelativeTime,
  getPhotoUrl,
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
  AlertTriangle,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { teamId } = useTeam();
  const { colors, isDark } = useTheme();
  const [pickList, setPickList] = useState<PickList | null>(null);
  const [items, setItems] = useState<PickListItemWithItem[]>([]);
  const [comments, setComments] = useState<PickListComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const refetchingRef = useRef(false);
  const [issues, setIssues] = useState<(PickListIssue & { pick_list_items?: { items?: Item | null } | null })[]>([]);
  const [activeTab, setActiveTab] = useState<'items' | 'comments' | 'issues'>('items');
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [assignedName, setAssignedName] = useState<string | null>(null);
  const [completedByName, setCompletedByName] = useState<string | null>(null);
  const commentsRef = useRef<FlatList>(null);
  const loadRef = useRef<() => Promise<void>>(async () => {});

  const load = useCallback(async () => {
    if (!id) return;
    const [plRes, itemsRes, commentsRes, issuesRes] = await Promise.all([
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
      supabase
        .from('pick_list_issues')
        .select('*, pick_list_items(items(*))')
        .eq('pick_list_id', id)
        .order('created_at', { ascending: false }),
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
    const loadedItems = (itemsRes.data ?? []) as unknown as PickListItemWithItem[];
    setItems(loadedItems);
    setComments((commentsRes.data ?? []) as PickListComment[]);
    setIssues((issuesRes.data ?? []) as any);

    // Resolve who completed the pick list
    if (plRes.data && ((plRes.data as PickList).status === 'complete' || (plRes.data as PickList).status === 'partially_complete')) {
      const lastPicked = [...loadedItems]
        .filter((i) => i.picked_by)
        .sort((a, b) => new Date(b.picked_at ?? 0).getTime() - new Date(a.picked_at ?? 0).getTime())[0];
      if (lastPicked?.picked_by) {
        const { data: pickerProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', lastPicked.picked_by)
          .single();
        setCompletedByName(pickerProfile?.full_name ?? 'Unknown');
      }
    } else {
      setCompletedByName(null);
    }

    setLoading(false);
    setRefreshing(false);
    refetchingRef.current = false;
  }, [id]);

  loadRef.current = load;

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      refetchingRef.current = true;
      load();
    }, [load])
  );

  // Realtime subscription
  useEffect(() => {
    if (!id) return;
    const safeLoad = () => { loadRef.current(); };
    const channel = supabase
      .channel(`pick_list_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pick_list_items', filter: `pick_list_id=eq.${id}` }, safeLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pick_lists', filter: `id=eq.${id}` }, safeLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pick_list_comments', filter: `pick_list_id=eq.${id}` }, safeLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pick_list_issues', filter: `pick_list_id=eq.${id}` }, safeLoad)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

        // Notify owners/admins if there are reported issues
        if (newStatus === 'complete' || newStatus === 'partially_complete') {
          try {
            const { data: issueRows } = await supabase
              .from('pick_list_issues')
              .select('*, pick_list_items(items(name))')
              .eq('pick_list_id', pickList.id);

            if (issueRows && issueRows.length > 0 && user) {
              const recipientSet = new Set<string>([user.id]);
              if (teamId) {
                const { data: members } = await supabase
                  .from('team_members')
                  .select('user_id')
                  .eq('team_id', teamId)
                  .in('role', ['owner', 'admin']);
                for (const m of members ?? []) recipientSet.add(m.user_id);
              }
              const recipients = [...recipientSet];

              if (recipients.length > 0) {
                const issueLines = (issueRows as any[]).map((iss) => {
                  const itemName = iss.pick_list_items?.items?.name ?? 'Unknown item';
                  const typeLabel = (iss.issue_type as string).replace(/_/g, ' ');
                  return `• ${itemName}: ${typeLabel} (picked ${iss.quantity_actually_picked}/${iss.quantity_affected + iss.quantity_actually_picked})`;
                });

                await supabase.from('notifications').insert(
                  recipients.map((uid) => ({
                    user_id: uid,
                    type: 'pick_list_issue',
                    title: `Issues reported on "${pickList.name}"`,
                    message: issueLines.join('\n'),
                    related_pick_list_id: pickList.id,
                  }))
                );
              }
            }
          } catch {
            // Non-critical
          }
        }

        notificationSuccess();
        load();
      } else {
      Alert.alert('Error', 'Failed to update status.');
    }
    setStatusUpdating(false);
  };

  // Local-only pick (no DB call until commit)
  const startPicking = () => {
    router.push(`/pick-list/picking?pickListId=${id}`);
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
          await supabase.from('pick_list_issues').delete().eq('pick_list_id', id!);
          await supabase.from('pick_list_items').delete().eq('pick_list_id', id!);
          await supabase.from('pick_list_comments').delete().eq('pick_list_id', id!);
          await supabase.from('pick_lists').delete().eq('id', id!);
          notificationSuccess();
          router.back();
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

            {/* Assigned to / Completed by */}
            <Text className="text-xs mb-3" style={{ color: colors.textSecondary }}>
              Assigned to: {assignedName ?? 'Everyone'}
            </Text>
            {(pickList.status === 'complete' || pickList.status === 'partially_complete') && completedByName && (
              <Text className="text-xs mb-3" style={{ color: pickList.status === 'complete' ? colors.success : colors.warning }}>
                {pickList.status === 'complete' ? 'Completed' : 'Partially completed'} by: {completedByName}
              </Text>
            )}

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
          {(['items', 'comments', ...(issues.length > 0 ? ['issues'] : [])] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab as any)}
              className="flex-1 items-center rounded-lg py-2"
              style={{ backgroundColor: activeTab === tab ? colors.accent : 'transparent' }}>
              <Text className="text-xs font-semibold" style={{ color: activeTab === tab ? colors.accentOnAccent : colors.textSecondary }}>
                {tab === 'items' ? `Items (${items.length})` : tab === 'comments' ? `Comments (${comments.length})` : `Issues (${issues.length})`}
              </Text>
            </Pressable>
          ))}
        </View>

        {activeTab === 'issues' ? (
          <FlatList
            data={issues}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View className="items-center py-12">
                <AlertTriangle color={colors.textSecondary} size={32} />
                <Text className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
                  No issues reported
                </Text>
              </View>
            }
            renderItem={({ item: issue }) => (
              <IssueRow issue={issue} colors={colors} isDark={isDark} />
            )}
          />
        ) : activeTab === 'items' ? (
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
                !refetchingRef.current ? (
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
                ) : null
              }
              renderItem={({ item: pli }) => (
                <PickListItemRow
                  pli={pli}
                  canEdit={pickList.status === 'draft'}
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
                <TouchableOpacity
                  onPress={startPicking}
                  className="flex-row items-center justify-center gap-2 rounded-2xl py-3.5"
                  style={{ backgroundColor: colors.accent, ...getCardShadow(isDark) }}>
                  <ClipboardList size={18} color={colors.accentOnAccent} />
                  <Text className="text-sm font-bold" style={{ color: colors.accentOnAccent }}>Start Picking</Text>
                </TouchableOpacity>
            ) : null}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PickListItemRow({
  pli,
  canEdit,
  onUpdateRequested,
  onRemove,
  colors,
  isDark,
}: {
  pli: PickListItemWithItem;
  canEdit: boolean;
  onUpdateRequested: (qty: number) => void;
  onRemove: () => void;
  colors: ThemeColors;
  isDark: boolean;
}) {
  const [reqText, setReqText] = useState(String(pli.quantity_requested));
  const [isEditingReq, setIsEditingReq] = useState(false);

  useEffect(() => {
    if (!isEditingReq) setReqText(String(pli.quantity_requested));
  }, [pli.quantity_requested, isEditingReq]);

  const isPicked = pli.quantity_picked >= pli.quantity_requested;

  const rowBg = isPicked ? colors.successMuted : colors.surface;
  const borderColor = isPicked ? `${colors.success}44` : isDark ? colors.borderLight : colors.border;

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
        {/* Item photo */}
        {pli.items?.photos && pli.items.photos.length > 0 ? (
          <Image
            source={{ uri: getPhotoUrl(pli.items.photos[0]) ?? undefined }}
            className="rounded-xl"
            style={{ width: 48, height: 48, borderRadius: 12 }}
            resizeMode="cover"
          />
        ) : (
          <View
            className="items-center justify-center rounded-xl"
            style={{ width: 48, height: 48, backgroundColor: colors.accentMuted }}>
            <Package color={colors.accent} size={20} />
          </View>
        )}

        {/* Info */}
        <View className="flex-1">
          <Text className="font-semibold" numberOfLines={2} style={{ color: colors.textPrimary }}>
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
          {canEdit && (
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
          {canEdit && (
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

    </View>
  );
}

const ISSUE_TYPE_LABELS: Record<string, string> = {
  damaged_stock: 'Damaged Stock',
  missing_unit: 'Missing Unit',
  wrong_stock_at_location: 'Wrong Stock at Location',
  barcode_mismatch: 'Barcode Mismatch',
  other: 'Other',
};

function IssueRow({
  issue,
  colors,
  isDark,
}: {
  issue: PickListIssue & { pick_list_items?: { items?: Item | null } | null };
  colors: ThemeColors;
  isDark: boolean;
}) {
  const itemName = (issue as any).pick_list_items?.items?.name ?? 'Unknown Item';
  return (
    <View
      className="mb-3 rounded-2xl p-4"
      style={{
        backgroundColor: colors.warningMuted,
        borderWidth: 1,
        borderColor: `${colors.warning}44`,
      }}>
      <View className="flex-row items-start gap-3">
        <View
          className="items-center justify-center rounded-xl mt-0.5"
          style={{ width: 36, height: 36, backgroundColor: `${colors.warning}22` }}>
          <AlertTriangle size={18} color={colors.warning} />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
            {ISSUE_TYPE_LABELS[issue.issue_type] ?? issue.issue_type}
          </Text>
          <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
            {itemName}
          </Text>
          <View className="flex-row items-center gap-3 mt-2">
            <Text className="text-xs" style={{ color: colors.textSecondary }}>
              Affected: <Text style={{ fontWeight: '700', color: colors.warning }}>{issue.quantity_affected}</Text>
            </Text>
            <Text className="text-xs" style={{ color: colors.textSecondary }}>
              Picked: <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{issue.quantity_actually_picked}</Text>
            </Text>
          </View>
          {issue.notes && (
            <Text className="text-xs mt-2 italic" style={{ color: colors.textSecondary }}>
              "{issue.notes}"
            </Text>
          )}
          <Text className="text-[10px] mt-2" style={{ color: colors.textTertiary }}>
            {formatRelativeTime(issue.created_at)}
          </Text>
        </View>
      </View>
    </View>
  );
}
