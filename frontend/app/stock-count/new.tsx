import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { Item } from '@/lib/types';
import { logActivity } from '@/lib/utils';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Check,
  Package,
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

export default function NewStockCountScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedItems, setSelectedItems] = useState<Item[]>([]);
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

  const toggleItem = (item: Item) => {
    setSelectedItems(prev =>
      prev.find(i => i.id === item.id)
        ? prev.filter(i => i.id !== item.id)
        : [...prev, item]
    );
  };

  const addAllItems = async () => {
    setLoadingItems(true);
    const { data } = await supabase.from('items').select('*').eq('status', 'active');
    setSelectedItems((data ?? []) as Item[]);
    setItemPickerVisible(false);
    setLoadingItems(false);
  };

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a name for the stock count.');
      return;
    }
    if (selectedItems.length === 0) {
      Alert.alert('Error', 'Please add at least one item.');
      return;
    }

    setSaving(true);
    try {
      const { data: sc, error } = await supabase
        .from('stock_counts')
        .insert({
          name: name.trim(),
          notes: notes.trim() || null,
          created_by: user?.id,
          status: 'draft',
        })
        .select()
        .single();
      if (error) throw error;

      const itemRows = selectedItems.map(item => ({
        stock_count_id: sc.id,
        item_id: item.id,
        expected_quantity: item.quantity,
      }));

      const { error: itemsError } = await supabase.from('stock_count_items').insert(itemRows);
      if (itemsError) throw itemsError;

      await logActivity(user?.id, 'stock_count_created', { details: { name: name.trim(), itemCount: selectedItems.length } });

      router.replace(`/stock-count/${sc.id}`);
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
          New Stock Count
        </Text>
        <TouchableOpacity
          onPress={save}
          disabled={saving}
          className="flex-row items-center gap-1.5 rounded-xl px-3 py-2.5"
          style={{ backgroundColor: name.trim() && selectedItems.length > 0 ? colors.accent : colors.border }}>
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
        <Text className="text-sm mb-2 mt-2" style={{ color: colors.textSecondary }}>Name</Text>
        <TextInput
          className="rounded-xl px-4 py-3 mb-4 text-sm"
          style={{ backgroundColor: colors.surface, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border }}
          placeholder="e.g. Monthly Stock Count - March"
          placeholderTextColor={colors.textSecondary}
          value={name}
          onChangeText={setName}
        />

        <Text className="text-sm mb-2" style={{ color: colors.textSecondary }}>Notes (optional)</Text>
        <TextInput
          className="rounded-xl px-4 py-3 mb-4 text-sm"
          style={{ backgroundColor: colors.surface, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border }}
          placeholder="Any notes about this count..."
          placeholderTextColor={colors.textSecondary}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />

        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
            Items ({selectedItems.length})
          </Text>
          <TouchableOpacity
            onPress={() => setItemPickerVisible(true)}
            className="flex-row items-center gap-1 rounded-xl px-3 py-2"
            style={{ backgroundColor: colors.accentMuted }}>
            <Plus color={colors.accent} size={14} />
            <Text className="text-xs font-semibold" style={{ color: colors.accent }}>Add Items</Text>
          </TouchableOpacity>
        </View>

        {selectedItems.map(item => (
          <View
            key={item.id}
            className="mb-2 flex-row items-center rounded-xl px-4 py-3"
            style={cardStyle}>
            <View className="flex-1">
              <Text className="font-medium text-sm" style={{ color: colors.textPrimary }} numberOfLines={1}>{item.name}</Text>
              <Text className="text-xs" style={{ color: colors.textSecondary }}>
                Expected: {item.quantity} | SKU: {item.sku || '—'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedItems(prev => prev.filter(i => i.id !== item.id))} className="p-2">
              <Trash2 color={colors.destructive} size={16} />
            </TouchableOpacity>
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
              <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>Add Items</Text>
              <View className="flex-row gap-2">
                <TouchableOpacity onPress={addAllItems} className="rounded-xl px-3 py-2" style={{ backgroundColor: colors.accentMuted }}>
                  <Text className="text-xs font-semibold" style={{ color: colors.accent }}>Add All</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setItemPickerVisible(false)}>
                  <X color={colors.textSecondary} size={20} />
                </TouchableOpacity>
              </View>
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
                data={allItems}
                keyExtractor={i => i.id}
                renderItem={({ item }) => {
                  const isSelected = selectedItems.some(s => s.id === item.id);
                  return (
                    <TouchableOpacity
                      onPress={() => toggleItem(item)}
                      className="flex-row items-center py-3 px-2"
                      style={{ borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                      <View
                        className="items-center justify-center rounded-lg mr-3"
                        style={{
                          width: 24, height: 24,
                          backgroundColor: isSelected ? colors.accent : colors.background,
                          borderWidth: isSelected ? 0 : 1,
                          borderColor: colors.border,
                        }}>
                        {isSelected && <Check color={colors.accentOnAccent} size={14} />}
                      </View>
                      <View className="flex-1">
                        <Text className="font-medium text-sm" style={{ color: colors.textPrimary }}>{item.name}</Text>
                        <Text className="text-xs" style={{ color: colors.textSecondary }}>
                          Qty: {item.quantity} | {item.sku || 'No SKU'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
