import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { ThemeColors } from '@/lib/theme-context';
import type { Item } from '@/lib/types';
import { impactLight, notificationSuccess } from '@/lib/haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Check, Package, Search, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface SelectedItem {
  item: Item;
  quantity: number;
  locationHint: string;
}

export default function AddItemToPickListScreen() {
  const { pickListId } = useLocalSearchParams<{ pickListId: string }>();
  const { colors, isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Map<string, SelectedItem>>(new Map());
  const [saving, setSaving] = useState(false);
  const [existingItemIds, setExistingItemIds] = useState<Set<string>>(new Set());

  // Load existing pick list items to avoid duplicates
  useEffect(() => {
    if (!pickListId) return;
    supabase
      .from('pick_list_items')
      .select('item_id')
      .eq('pick_list_id', pickListId)
      .then(({ data }) => {
        setExistingItemIds(new Set((data ?? []).map((r) => r.item_id)));
      });
  }, [pickListId]);

  const searchItems = useCallback(async (q: string) => {
    setLoading(true);
    let query = supabase
      .from('items')
      .select('*')
      .eq('status', 'active')
      .order('name', { ascending: true })
      .limit(50);

    if (q.trim()) {
      query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,barcode.ilike.%${q}%`);
    }

    const { data } = await query;
    setItems((data ?? []) as Item[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    searchItems(searchQuery);
  }, [searchItems, searchQuery]);

  const toggleItem = (item: Item) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.set(item.id, { item, quantity: 1, locationHint: item.location ?? '' });
      }
      return next;
    });
    impactLight();
  };

  const updateQty = (itemId: string, delta: number) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const entry = next.get(itemId);
      if (!entry) return prev;
      const newQty = Math.max(1, entry.quantity + delta);
      next.set(itemId, { ...entry, quantity: newQty });
      return next;
    });
  };

  const addToPickList = async () => {
    if (!pickListId || selected.size === 0) return;
    setSaving(true);

    // Get max sort_order
    const { data: existingItems } = await supabase
      .from('pick_list_items')
      .select('sort_order')
      .eq('pick_list_id', pickListId)
      .order('sort_order', { ascending: false })
      .limit(1);

    let sortOrder = (existingItems?.[0]?.sort_order ?? 0) + 1;

    const inserts = Array.from(selected.values()).map((s) => ({
      pick_list_id: pickListId,
      item_id: s.item.id,
      quantity_requested: s.quantity,
      quantity_picked: 0,
      location_hint: s.locationHint || null,
      unit_price: s.item.sell_price ?? s.item.cost_price ?? null,
      sort_order: sortOrder++,
    }));

    const { error } = await supabase.from('pick_list_items').insert(inserts);

    if (!error) {
      // Update pick list updated_at
      await supabase
        .from('pick_lists')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', pickListId);

        notificationSuccess();
      router.back();
    } else {
      Alert.alert('Error', 'Failed to add items to pick list.');
    }
    setSaving(false);
  };

  const selectedArray = Array.from(selected.values());

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="px-5 py-3 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.back()} className="rounded-xl p-2" style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
          <ArrowLeft color={colors.textPrimary} size={20} />
        </TouchableOpacity>
        <Text className="text-base font-bold flex-1 mx-3" style={{ color: colors.textPrimary }}>Add Items</Text>
        <TouchableOpacity
          onPress={addToPickList}
          disabled={selected.size === 0 || saving}
          className="flex-row items-center gap-1.5 rounded-xl px-3 py-2.5"
          style={{ backgroundColor: selected.size > 0 ? colors.accent : colors.surface }}>
          {saving ? (
            <ActivityIndicator size="small" color={colors.accentOnAccent} />
          ) : (
            <>
              <Check color={selected.size > 0 ? colors.accentOnAccent : colors.textSecondary} size={16} />
              <Text
                className="text-sm font-bold"
                style={{ color: selected.size > 0 ? colors.accentOnAccent : colors.textSecondary }}>
                Add {selected.size > 0 ? `(${selected.size})` : ''}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View
        className="mx-5 mb-3 flex-row items-center rounded-xl px-3 py-2.5"
        style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
        <Search color={colors.textSecondary} size={16} />
        <TextInput
          className="ml-2 flex-1 text-sm"
          style={{ color: colors.textPrimary }}
          placeholder="Search by name, SKU or barcode..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoFocus
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X color={colors.textSecondary} size={16} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Selected items summary */}
      {selectedArray.length > 0 && (
        <View className="mx-5 mb-3">
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={selectedArray}
            keyExtractor={(s) => s.item.id}
            renderItem={({ item: s }) => (
              <View
                className="mr-2 flex-row items-center gap-1.5 rounded-xl px-3 py-1.5"
                style={{ backgroundColor: colors.accentMuted, borderWidth: 1, borderColor: `${colors.accent}44` }}>
                <Text className="text-xs font-semibold" style={{ color: colors.accent }}>
                  {s.item.name.length > 18 ? s.item.name.slice(0, 18) + '\u2026' : s.item.name} x{s.quantity}
                </Text>
                <TouchableOpacity onPress={() => toggleItem(s.item)}>
                  <X color={colors.accent} size={12} />
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      )}

      {/* Items list */}
      {loading ? (
        <ActivityIndicator color={colors.accent} className="mt-8" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="items-center py-12">
              <Package color={colors.textSecondary} size={32} />
              <Text className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
                {searchQuery ? 'No items match your search' : 'No items found'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isSelected = selected.has(item.id);
            const alreadyAdded = existingItemIds.has(item.id);
            const selectedEntry = selected.get(item.id);

            return (
              <ItemRow
                item={item}
                isSelected={isSelected}
                alreadyAdded={alreadyAdded}
                selectedEntry={selectedEntry}
                colors={colors}
                isDark={isDark}
                onToggle={toggleItem}
                onUpdateQty={updateQty}
              />
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function ItemRow({
  item,
  isSelected,
  alreadyAdded,
  selectedEntry,
  colors,
  isDark,
  onToggle,
  onUpdateQty,
}: {
  item: Item;
  isSelected: boolean;
  alreadyAdded: boolean;
  selectedEntry: SelectedItem | undefined;
  colors: ThemeColors;
  isDark: boolean;
  onToggle: (item: Item) => void;
  onUpdateQty: (itemId: string, delta: number) => void;
}) {
  return (
    <TouchableOpacity
      onPress={() => !alreadyAdded && onToggle(item)}
      activeOpacity={alreadyAdded ? 1 : 0.7}
      className="mb-2.5 rounded-2xl p-4"
      style={{
        backgroundColor: isSelected ? colors.accentMuted : colors.surface,
        borderWidth: 1,
        borderColor: isSelected ? `${colors.accent}55` : isDark ? colors.borderLight : colors.border,
        opacity: alreadyAdded ? 0.4 : 1,
        ...(!isSelected ? getCardShadow(isDark) : {}),
      }}>
      <View className="flex-row items-center gap-3">
        {/* Checkbox */}
        <View
          className="items-center justify-center rounded-full"
          style={{
            width: 24,
            height: 24,
            backgroundColor: isSelected ? colors.accent : colors.background,
            borderWidth: 2,
            borderColor: isSelected ? colors.accent : colors.border,
          }}>
          {isSelected && <Check size={13} color={colors.accentOnAccent} />}
        </View>

        {/* Icon */}
        <View
          className="items-center justify-center rounded-xl p-2"
          style={{ backgroundColor: colors.accentMuted }}>
          <Package color={colors.accent} size={16} />
        </View>

        {/* Info */}
        <View className="flex-1">
          <Text className="font-semibold" numberOfLines={1} style={{ color: colors.textPrimary }}>
            {item.name}
          </Text>
          <View className="flex-row items-center gap-2 mt-0.5">
            {item.sku && (
              <Text className="text-xs" style={{ color: colors.textSecondary }}>
                {item.sku}
              </Text>
            )}
            {item.location && (
              <Text className="text-xs" style={{ color: colors.accent }}>
                {'\uD83D\uDCCD'} {item.location}
              </Text>
            )}
          </View>
          {alreadyAdded && (
            <Text className="text-xs mt-0.5" style={{ color: colors.warning }}>
              Already in list
            </Text>
          )}
        </View>

        {/* Stock + Qty */}
        <View className="items-end gap-1">
          <Text
            className="text-xs font-semibold"
            style={{ color: item.quantity <= item.min_quantity ? colors.destructive : colors.success }}>
            {item.quantity} in stock
          </Text>
          {isSelected && selectedEntry && (
            <View className="flex-row items-center gap-1.5 mt-1">
              <TouchableOpacity
                onPress={() => onUpdateQty(item.id, -1)}
                className="items-center justify-center rounded-md"
                style={{ width: 24, height: 24, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                <Text className="font-bold text-sm" style={{ color: colors.textPrimary }}>{'\u2212'}</Text>
              </TouchableOpacity>
              <Text className="text-sm font-bold" style={{ minWidth: 20, textAlign: 'center', color: colors.textPrimary }}>
                {selectedEntry.quantity}
              </Text>
              <TouchableOpacity
                onPress={() => onUpdateQty(item.id, 1)}
                className="items-center justify-center rounded-md"
                style={{ width: 24, height: 24, backgroundColor: colors.accent }}>
                <Text style={{ color: colors.accentOnAccent }} className="font-bold text-sm">+</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
