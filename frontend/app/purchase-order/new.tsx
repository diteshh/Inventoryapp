import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { Item } from '@/lib/types';
import { generatePONumber, logActivity } from '@/lib/utils';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Check,
  Minus,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type POLineItem = {
  item: Item;
  quantity: number;
  unitCost: number;
};

export default function NewPurchaseOrderScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const [poNumber] = useState(generatePONumber());
  const [supplierName, setSupplierName] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<POLineItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [itemPickerVisible, setItemPickerVisible] = useState(false);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingItems, setLoadingItems] = useState(false);

  const cardStyle = {
    backgroundColor: colors.surface,
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? colors.borderLight : 'transparent',
    ...getCardShadow(isDark),
  };

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      let query = supabase.from('items').select('*').eq('status', 'active').order('name');
      if (searchQuery.trim()) {
        query = query.or(`name.ilike.%${searchQuery}%,sku.ilike.%${searchQuery}%`);
      }
      const { data } = await query;
      setAllItems((data ?? []) as Item[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingItems(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (itemPickerVisible) loadItems();
  }, [itemPickerVisible, loadItems]);

  const addItem = (item: Item) => {
    if (lineItems.find(li => li.item.id === item.id)) return;
    setLineItems(prev => [...prev, { item, quantity: 1, unitCost: item.cost_price ?? 0 }]);
    setItemPickerVisible(false);
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setLineItems(prev =>
      prev.map(li =>
        li.item.id === itemId ? { ...li, quantity: Math.max(1, li.quantity + delta) } : li
      )
    );
  };

  const updateCost = (itemId: string, cost: string) => {
    const numCost = parseFloat(cost) || 0;
    setLineItems(prev =>
      prev.map(li => (li.item.id === itemId ? { ...li, unitCost: numCost } : li))
    );
  };

  const removeItem = (itemId: string) => {
    setLineItems(prev => prev.filter(li => li.item.id !== itemId));
  };

  const save = async () => {
    if (!supplierName.trim()) {
      Alert.alert('Error', 'Please enter a supplier name.');
      return;
    }
    if (lineItems.length === 0) {
      Alert.alert('Error', 'Please add at least one item.');
      return;
    }

    setSaving(true);
    try {
      const { data: po, error } = await supabase
        .from('purchase_orders')
        .insert({
          po_number: poNumber,
          supplier_name: supplierName.trim(),
          notes: notes.trim() || null,
          created_by: user?.id,
          status: 'draft',
        })
        .select()
        .single();
      if (error) throw error;

      const itemRows = lineItems.map(li => ({
        po_id: po.id,
        item_id: li.item.id,
        quantity_ordered: li.quantity,
        unit_cost: li.unitCost,
      }));

      const { error: itemsError } = await supabase.from('purchase_order_items').insert(itemRows);
      if (itemsError) throw itemsError;

      await logActivity(user?.id, 'po_created', { details: { poNumber, supplier: supplierName.trim() } });

      router.replace(`/purchase-order/${po.id}`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="flex-row items-center px-5 py-3 gap-3">
        <TouchableOpacity onPress={() => router.back()} className="rounded-xl p-2" style={cardStyle}>
          <ArrowLeft color={colors.textPrimary} size={20} />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold" style={{ color: colors.textPrimary }}>
          New Purchase Order
        </Text>
        <TouchableOpacity
          onPress={save}
          disabled={saving}
          className="flex-row items-center gap-1.5 rounded-xl px-3 py-2.5"
          style={{ backgroundColor: supplierName.trim() && lineItems.length > 0 ? colors.accent : colors.border }}>
          {saving ? (
            <ActivityIndicator color={colors.accentOnAccent} size="small" />
          ) : (
            <>
              <Check color={colors.accentOnAccent} size={16} />
              <Text className="text-sm font-semibold" style={{ color: colors.accentOnAccent }}>Create</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        <View className="rounded-xl px-4 py-3 mb-4" style={{ backgroundColor: colors.accentMuted }}>
          <Text className="text-xs" style={{ color: colors.textSecondary }}>PO Number</Text>
          <Text className="font-bold text-base" style={{ color: colors.accent }}>{poNumber}</Text>
        </View>

        <Text className="text-sm mb-2" style={{ color: colors.textSecondary }}>Supplier Name</Text>
        <TextInput
          className="rounded-xl px-4 py-3 mb-4 text-sm"
          style={{ backgroundColor: colors.surface, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border }}
          placeholder="Enter supplier name"
          placeholderTextColor={colors.textSecondary}
          value={supplierName}
          onChangeText={setSupplierName}
        />

        <Text className="text-sm mb-2" style={{ color: colors.textSecondary }}>Notes (optional)</Text>
        <TextInput
          className="rounded-xl px-4 py-3 mb-4 text-sm"
          style={{ backgroundColor: colors.surface, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border }}
          placeholder="Any notes..."
          placeholderTextColor={colors.textSecondary}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />

        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
            Items ({lineItems.length})
          </Text>
          <TouchableOpacity
            onPress={() => setItemPickerVisible(true)}
            className="flex-row items-center gap-1 rounded-xl px-3 py-2"
            style={{ backgroundColor: colors.accentMuted }}>
            <Plus color={colors.accent} size={14} />
            <Text className="text-xs font-semibold" style={{ color: colors.accent }}>Add Items</Text>
          </TouchableOpacity>
        </View>

        {lineItems.map(li => (
          <View key={li.item.id} className="mb-3 rounded-2xl p-4" style={cardStyle}>
            <View className="flex-row items-start justify-between mb-3">
              <View className="flex-1">
                <Text className="font-semibold text-sm" style={{ color: colors.textPrimary }} numberOfLines={1}>
                  {li.item.name}
                </Text>
                <Text className="text-xs" style={{ color: colors.textSecondary }}>{li.item.sku || 'No SKU'}</Text>
              </View>
              <TouchableOpacity onPress={() => removeItem(li.item.id)} className="p-1">
                <Trash2 color={colors.destructive} size={16} />
              </TouchableOpacity>
            </View>

            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xs mb-1" style={{ color: colors.textSecondary }}>Quantity</Text>
                <View className="flex-row items-center gap-2">
                  <TouchableOpacity
                    onPress={() => updateQuantity(li.item.id, -1)}
                    className="items-center justify-center rounded-lg"
                    style={{ width: 32, height: 32, backgroundColor: colors.destructiveMuted }}>
                    <Minus color={colors.destructive} size={14} />
                  </TouchableOpacity>
                  <Text className="text-base font-bold min-w-[30px] text-center" style={{ color: colors.textPrimary }}>
                    {li.quantity}
                  </Text>
                  <TouchableOpacity
                    onPress={() => updateQuantity(li.item.id, 1)}
                    className="items-center justify-center rounded-lg"
                    style={{ width: 32, height: 32, backgroundColor: colors.successMuted }}>
                    <Plus color={colors.success} size={14} />
                  </TouchableOpacity>
                </View>
              </View>

              <View>
                <Text className="text-xs mb-1" style={{ color: colors.textSecondary }}>Unit Cost</Text>
                <TextInput
                  className="rounded-lg px-3 py-1.5 text-sm text-right"
                  style={{ backgroundColor: colors.background, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, width: 90 }}
                  keyboardType="decimal-pad"
                  value={li.unitCost.toString()}
                  onChangeText={(v) => updateCost(li.item.id, v)}
                />
              </View>
            </View>
          </View>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Item picker modal */}
      <Modal visible={itemPickerVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <TouchableOpacity
            className="flex-1"
            activeOpacity={1}
            onPress={() => setItemPickerVisible(false)}
            style={{ backgroundColor: colors.overlay }}
          />
          <View className="rounded-t-3xl p-5 pb-10" style={{ backgroundColor: colors.surface, maxHeight: '70%' }}>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>Add Item</Text>
              <TouchableOpacity onPress={() => setItemPickerVisible(false)}>
                <X color={colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>

            <View
              className="flex-row items-center rounded-xl px-3 py-2.5 mb-3"
              style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
              <Search color={colors.textSecondary} size={16} />
              <TextInput
                className="ml-2 flex-1 text-sm"
                placeholder="Search items..."
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={{ color: colors.textPrimary }}
              />
            </View>

            {loadingItems ? (
              <ActivityIndicator color={colors.accent} className="mt-4" />
            ) : (
              <FlatList
                data={allItems.filter(i => !lineItems.some(li => li.item.id === i.id))}
                keyExtractor={i => i.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => addItem(item)}
                    className="flex-row items-center py-3 px-2"
                    style={{ borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                    <View className="flex-1">
                      <Text className="font-medium text-sm" style={{ color: colors.textPrimary }}>{item.name}</Text>
                      <Text className="text-xs" style={{ color: colors.textSecondary }}>
                        Stock: {item.quantity} | {item.sku || 'No SKU'}
                      </Text>
                    </View>
                    <Plus color={colors.accent} size={18} />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
