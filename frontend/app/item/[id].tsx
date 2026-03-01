import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { ThemeColors } from '@/lib/theme-context';
import type { ActivityLog, Folder, Item, Tag } from '@/lib/types';
import { formatCurrency, formatDate, formatRelativeTime, getActionLabel, getPhotoUrl, logActivity } from '@/lib/utils';
import { router, useLocalSearchParams } from 'expo-router';
import { impactLight, notificationSuccess } from '@/lib/haptics';
import {
  ArrowLeft,
  BarChart2,
  Edit2,
  MapPin,
  Minus,
  MoreVertical,
  Package,
  Plus,
  Tag as TagIcon,
  Trash2,
  ClipboardList,
  FolderOpen,
  Activity,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LowStockBadge } from '@/components/ui/Badge';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const [item, setItem] = useState<Item | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [folder, setFolder] = useState<Folder | null>(null);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [qtyAdjust, setQtyAdjust] = useState(0);
  const [qtyReason, setQtyReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const loadItem = useCallback(async () => {
    if (!id) return;
    const [itemRes, activityRes] = await Promise.all([
      supabase.from('items').select('*').eq('id', id).single(),
      supabase.from('activity_log').select('*').eq('item_id', id).order('timestamp', { ascending: false }).limit(20),
    ]);
    if (itemRes.data) {
      setItem(itemRes.data as Item);
      // Load tags
      const { data: tagData } = await supabase
        .from('item_tags')
        .select('tag_id, tags(*)')
        .eq('item_id', id);
      setTags((tagData?.map((t: any) => t.tags).filter(Boolean) ?? []) as Tag[]);
      // Load folder
      if (itemRes.data.folder_id) {
        const { data: folderData } = await supabase.from('folders').select('*').eq('id', itemRes.data.folder_id).single();
        setFolder(folderData as Folder);
      }
    }
    setActivity((activityRes.data ?? []) as ActivityLog[]);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  const adjustQuantity = async () => {
    if (!item || qtyAdjust === 0) return;
    setAdjusting(true);
    const newQty = Math.max(0, item.quantity + qtyAdjust);
    const { error } = await supabase
      .from('items')
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq('id', item.id);
    if (!error) {
      await logActivity(user?.id, 'quantity_adjusted', {
        itemId: item.id,
        details: { item_name: item.name, old_qty: item.quantity, new_qty: newQty, reason: qtyReason, adjustment: qtyAdjust },
      });
        notificationSuccess();
      setItem({ ...item, quantity: newQty });
      setShowQuantityModal(false);
      setQtyAdjust(0);
      setQtyReason('');
    }
    setAdjusting(false);
  };

  const deleteItem = () => {
    Alert.alert('Delete Item', `Delete "${item?.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!item) return;
          await supabase.from('items').update({ status: 'deleted' }).eq('id', item.id);
          await logActivity(user?.id, 'item_deleted', { itemId: item.id, details: { item_name: item.name } });
          router.back();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
        <Text style={{ color: colors.textPrimary }}>Item not found</Text>
      </SafeAreaView>
    );
  }

  const photos = item.photos ?? [];

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-3">
        <TouchableOpacity onPress={() => router.back()} className="rounded-xl p-2" style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
          <ArrowLeft color={colors.textPrimary} size={20} />
        </TouchableOpacity>
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => router.push(`/item/edit/${item.id}`)}
            className="flex-row items-center gap-1.5 rounded-xl px-3 py-2"
            style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
            <Edit2 color={colors.accent} size={16} />
            <Text className="text-sm font-medium" style={{ color: colors.accent }}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={deleteItem} className="rounded-xl p-2" style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
            <Trash2 color={colors.destructive} size={18} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Photo Carousel */}
        {photos.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
              }}>
              {photos.map((photo, idx) => (
                <Image
                  key={idx}
                  source={{ uri: getPhotoUrl(photo) ?? photo }}
                  style={{ width: SCREEN_WIDTH, height: 260 }}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
            {photos.length > 1 && (
              <View className="absolute bottom-3 left-0 right-0 flex-row items-center justify-center gap-1.5">
                {photos.map((_, idx) => (
                  <View
                    key={idx}
                    style={{
                      width: idx === photoIndex ? 18 : 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: idx === photoIndex ? colors.accent : 'rgba(255,255,255,0.4)',
                    }}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View className="mx-5 mb-2 items-center justify-center rounded-2xl" style={{ height: 180, backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
            <Package color={colors.textSecondary} size={48} />
          </View>
        )}

        <View className="px-5 pt-4">
          {/* Title & SKU */}
          <Text className="text-2xl font-bold" style={{ color: colors.textPrimary, fontWeight: '800' }} numberOfLines={2}>
            {item.name}
          </Text>
          {item.sku && (
            <Text className="mt-1 text-sm font-mono" style={{ color: colors.textSecondary }}>
              SKU: {item.sku}
            </Text>
          )}
          {item.barcode && (
            <Text className="text-xs font-mono mt-0.5" style={{ color: colors.textSecondary }}>
              Barcode: {item.barcode}
            </Text>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <View className="mt-3 flex-row flex-wrap gap-2">
              {tags.map((tag) => (
                <View
                  key={tag.id}
                  className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
                  style={{ backgroundColor: `${tag.colour ?? colors.accent}22` }}>
                  <TagIcon color={tag.colour ?? colors.accent} size={10} />
                  <Text className="text-xs font-medium" style={{ color: tag.colour ?? colors.accent }}>
                    {tag.name}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Quantity Card */}
          <View
            className="mt-5 rounded-2xl p-4"
            style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xs font-medium" style={{ color: colors.textSecondary }}>Current Stock</Text>
                <Text className="text-4xl font-bold mt-1" style={{ color: colors.textPrimary, fontWeight: '900' }}>
                  {item.quantity}
                </Text>
                {item.min_quantity > 0 && (
                  <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                    Min: {item.min_quantity}
                  </Text>
                )}
              </View>
              <View className="items-end gap-2">
                <LowStockBadge quantity={item.quantity} minQuantity={item.min_quantity} />
                <TouchableOpacity
                  onPress={() => setShowQuantityModal(true)}
                  className="flex-row items-center gap-1.5 rounded-xl px-3 py-2.5"
                  style={{ backgroundColor: colors.accent }}>
                  <BarChart2 color={colors.accentOnAccent} size={16} />
                  <Text className="text-sm font-semibold" style={{ color: colors.accentOnAccent }}>Adjust</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Details Grid */}
          <View className="mt-4 rounded-2xl overflow-hidden" style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
            <SectionTitle title="Details" colors={colors} />
            <DetailRow label="Description" value={item.description} colors={colors} />
            <DetailRow label="Location" value={item.location} icon={<MapPin color={colors.textSecondary} size={14} />} colors={colors} />
            <DetailRow label="Cost Price" value={formatCurrency(item.cost_price)} colors={colors} />
            <DetailRow label="Sell Price" value={formatCurrency(item.sell_price)} colors={colors} />
            <DetailRow label="Weight" value={item.weight ? `${item.weight} kg` : null} colors={colors} />
            <DetailRow label="Folder" value={folder?.name} icon={<FolderOpen color={colors.textSecondary} size={14} />} colors={colors} />
            <DetailRow label="Notes" value={item.notes} colors={colors} />
            <DetailRow label="Added" value={formatDate(item.created_at)} colors={colors} />
            <DetailRow label="Updated" value={formatRelativeTime(item.updated_at)} isLast colors={colors} />
          </View>

          {/* Actions */}
          <View className="mt-4 flex-row gap-3">
            <TouchableOpacity
              onPress={() => router.push(`/pick-list/add-item?item_id=${item.id}`)}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl py-3.5"
              style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
              <ClipboardList color={colors.accent} size={18} />
              <Text className="font-semibold" style={{ color: colors.accent }}>Add to Pick List</Text>
            </TouchableOpacity>
          </View>

          {/* Activity History */}
          {activity.length > 0 && (
            <View className="mt-6">
              <Text className="mb-3 text-base font-semibold" style={{ color: colors.textPrimary }}>Item History</Text>
                {activity.map((log) => {
                  const details = log.details as any;
                  const isPicked = log.action_type === 'item_picked';
                  return (
                    <View key={log.id} className="mb-2 flex-row items-start gap-3">
                      <View className="mt-1 items-center justify-center rounded-lg p-1.5" style={{ backgroundColor: colors.accentMuted }}>
                        {isPicked ? <ClipboardList color={colors.accent} size={12} /> : <Activity color={colors.accent} size={12} />}
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                          {isPicked ? `Picked ${details?.quantity} units` : getActionLabel(log.action_type)}
                        </Text>
                        {isPicked ? (
                          <Text className="text-xs" style={{ color: colors.textSecondary }}>
                            For: {details?.pick_list_name} • Left: {details?.inventory_remaining}
                          </Text>
                        ) : (
                          <>
                            {details?.reason && (
                              <Text className="text-xs" style={{ color: colors.textSecondary }}>
                                {details.reason}
                              </Text>
                            )}
                            {details?.adjustment != null && (
                              <Text className="text-xs" style={{ color: details.adjustment > 0 ? colors.success : colors.destructive }}>
                                {details.adjustment > 0 ? '+' : ''}{details.adjustment} units
                              </Text>
                            )}
                          </>
                        )}
                      </View>
                      <Text className="text-xs" style={{ color: colors.textSecondary }}>
                        {formatRelativeTime(log.timestamp)}
                      </Text>
                    </View>
                  );
                })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Quantity Adjust Modal */}
      <Modal visible={showQuantityModal} animationType="slide" transparent>
        <View className="flex-1 justify-end" style={{ backgroundColor: colors.overlay }}>
          <View className="rounded-t-3xl p-6" style={{ backgroundColor: colors.surface }}>
            <Text className="mb-4 text-lg font-bold" style={{ color: colors.textPrimary }}>Adjust Quantity</Text>
            <Text className="mb-4 text-sm" style={{ color: colors.textSecondary }}>
              Current: <Text className="font-bold" style={{ color: colors.textPrimary }}>{item.quantity}</Text>
              {qtyAdjust !== 0 && (
                <Text style={{ color: qtyAdjust > 0 ? colors.success : colors.destructive }}>
                  {' '}→ {Math.max(0, item.quantity + qtyAdjust)}
                </Text>
              )}
            </Text>
            <View className="mb-4 flex-row items-center justify-center gap-6">
              <TouchableOpacity
                  onPress={() => { setQtyAdjust(q => q - 1); impactLight(); }}
                className="items-center justify-center rounded-2xl"
                style={{ width: 52, height: 52, backgroundColor: colors.destructiveMuted, borderWidth: 1, borderColor: `${colors.destructive}44` }}>
                <Minus color={colors.destructive} size={22} />
              </TouchableOpacity>
              <Text className="w-20 text-center text-4xl font-bold" style={{ color: colors.textPrimary, fontWeight: '800' }}>
                {qtyAdjust > 0 ? `+${qtyAdjust}` : qtyAdjust}
              </Text>
              <TouchableOpacity
                  onPress={() => { setQtyAdjust(q => q + 1); impactLight(); }}
                className="items-center justify-center rounded-2xl"
                style={{ width: 52, height: 52, backgroundColor: colors.accentMuted, borderWidth: 1, borderColor: `${colors.accent}44` }}>
                <Plus color={colors.accent} size={22} />
              </TouchableOpacity>
            </View>
            <TextInput
              className="mb-5 rounded-xl px-4 py-3.5 text-sm"
              style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary }}
              placeholder="Reason (optional)"
              placeholderTextColor={colors.textSecondary}
              value={qtyReason}
              onChangeText={setQtyReason}
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => { setShowQuantityModal(false); setQtyAdjust(0); }}
                className="flex-1 items-center justify-center rounded-xl py-3.5"
                style={{ backgroundColor: colors.background }}>
                <Text className="font-semibold" style={{ color: colors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={adjustQuantity}
                disabled={qtyAdjust === 0 || adjusting}
                className="flex-1 items-center justify-center rounded-xl py-3.5"
                style={{ backgroundColor: qtyAdjust !== 0 ? colors.accent : colors.border }}>
                {adjusting ? (
                  <ActivityIndicator color={colors.accentOnAccent} size="small" />
                ) : (
                  <Text className="font-bold" style={{ color: qtyAdjust !== 0 ? colors.accentOnAccent : colors.textSecondary }}>
                    Confirm
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SectionTitle({ title, colors }: { title: string; colors: ThemeColors }) {
  return (
    <View className="border-b px-4 py-3" style={{ borderBottomColor: colors.border }}>
      <Text className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.textSecondary }}>
        {title}
      </Text>
    </View>
  );
}

function DetailRow({
  label,
  value,
  icon,
  isLast,
  colors,
}: {
  label: string;
  value: string | null | undefined;
  icon?: React.ReactNode;
  isLast?: boolean;
  colors: ThemeColors;
}) {
  if (!value) return null;
  return (
    <View
      className="flex-row items-start px-4 py-3"
      style={{ borderBottomWidth: isLast ? 0 : 1, borderBottomColor: colors.border }}>
      <Text className="w-28 text-sm" style={{ color: colors.textSecondary }}>{label}</Text>
      <View className="flex-1 flex-row items-center gap-1.5">
        {icon}
        <Text className="flex-1 text-sm" style={{ color: colors.textPrimary }}>{value}</Text>
      </View>
    </View>
  );
}
