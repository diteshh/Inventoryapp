import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { ThemeColors } from '@/lib/theme-context';
import type { Folder, Item, Tag } from '@/lib/types';
import { logActivity, generateSku } from '@/lib/utils';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { notificationSuccess } from '@/lib/haptics';
import {
  ArrowLeft,
  Camera,
  FolderOpen,
  Image as ImageIcon,
  Plus,
  QrCode,
  Save,
  Tag as TagIcon,
  Trash2,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ItemForm {
  name: string;
  description: string;
  sku: string;
  barcode: string;
  quantity: string;
  min_quantity: string;
  cost_price: string;
  sell_price: string;
  weight: string;
  location: string;
  notes: string;
  folder_id: string | null;
}

const EMPTY_FORM: ItemForm = {
  name: '',
  description: '',
  sku: '',
  barcode: '',
  quantity: '0',
  min_quantity: '0',
  cost_price: '',
  sell_price: '',
  weight: '',
  location: '',
  notes: '',
  folder_id: null,
};

export default function AddEditItemScreen() {
  const { id, folder_id: paramFolderId } = useLocalSearchParams<{ id?: string; barcode?: string; folder_id?: string }>();
  const params = useLocalSearchParams<{ barcode?: string }>();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const isEdit = !!id;
  const [form, setForm] = useState<ItemForm>({
    ...EMPTY_FORM,
    barcode: params.barcode ?? '',
    folder_id: paramFolderId ?? null,
  });
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [allFolders, setAllFolders] = useState<Folder[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  useEffect(() => {
    supabase.from('tags').select('*').order('name').then(({ data }) => setAllTags((data ?? []) as Tag[]));
    supabase.from('folders').select('*').order('name').then(({ data }) => setAllFolders((data ?? []) as Folder[]));

    if (!isEdit && !form.sku) {
      generateSku('item').then(sku => f('sku', sku));
    }

    if (isEdit && id) {
      supabase.from('items').select('*').eq('id', id).single().then(({ data }) => {
        if (data) {
          const item = data as Item;
          setForm({
            name: item.name,
            description: item.description ?? '',
            sku: item.sku ?? '',
            barcode: item.barcode ?? '',
            quantity: String(item.quantity),
            min_quantity: String(item.min_quantity),
            cost_price: item.cost_price != null ? String(item.cost_price) : '',
            sell_price: item.sell_price != null ? String(item.sell_price) : '',
            weight: item.weight != null ? String(item.weight) : '',
            location: item.location ?? '',
            notes: item.notes ?? '',
            folder_id: item.folder_id,
          });
          setPhotos(item.photos ?? []);
        }
      });
      supabase.from('item_tags').select('tag_id, tags(*)').eq('item_id', id).then(({ data }) => {
        setSelectedTags((data?.map((t: any) => t.tags).filter(Boolean) ?? []) as Tag[]);
      });
    }
  }, [id, isEdit]);

  const f = (field: keyof ItemForm, value: string | null) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      uploadPhotos(result.assets.map((a) => a.uri));
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });
    if (!result.canceled) {
      uploadPhotos([result.assets[0].uri]);
    }
  };

  const uploadPhotos = async (uris: string[]) => {
    setUploadingPhotos(true);
    const uploaded: string[] = [];
    for (const uri of uris) {
      try {
        const ext = uri.split('.').pop() ?? 'jpg';
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const formData = new FormData();
        formData.append('file', { uri, name: filename, type: `image/${ext}` } as any);
        const { data, error } = await supabase.storage.from('item-photos').upload(filename, formData, {
          contentType: `image/${ext}`,
          upsert: false,
        });
        if (!error && data) {
          const { data: urlData } = supabase.storage.from('item-photos').getPublicUrl(data.path);
          uploaded.push(urlData.publicUrl);
        } else {
          // Fall back to local URI for preview
          uploaded.push(uri);
        }
      } catch {
        uploaded.push(uri);
      }
    }
    setPhotos((prev) => [...prev, ...uploaded]);
    setUploadingPhotos(false);
  };

  const createTag = async () => {
    if (!newTagName.trim()) return;
    const { data } = await supabase.from('tags').insert({ name: newTagName.trim(), colour: colors.accent }).select().single();
    if (data) {
      const tag = data as Tag;
      setAllTags((prev) => [...prev, tag]);
      setSelectedTags((prev) => [...prev, tag]);
      setNewTagName('');
    }
  };

  const save = async () => {
    if (!form.name.trim()) {
      Alert.alert('Required', 'Item name is required.');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      quantity: parseInt(form.quantity) || 0,
      min_quantity: parseInt(form.min_quantity) || 0,
      cost_price: form.cost_price ? parseFloat(form.cost_price) : null,
      sell_price: form.sell_price ? parseFloat(form.sell_price) : null,
      weight: form.weight ? parseFloat(form.weight) : null,
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
      folder_id: form.folder_id,
      photos,
      updated_at: new Date().toISOString(),
      created_by: user?.id,
    };

    let itemId = id;
    if (isEdit && id) {
      await supabase.from('items').update(payload).eq('id', id);
      await logActivity(user?.id, 'item_updated', { itemId: id, details: { item_name: form.name } });
    } else {
      const { data } = await supabase.from('items').insert({ ...payload, status: 'active' }).select().single();
      itemId = data?.id;
      await logActivity(user?.id, 'item_created', { itemId, details: { item_name: form.name } });
    }

    // Update tags
    if (itemId) {
      await supabase.from('item_tags').delete().eq('item_id', itemId);
      if (selectedTags.length > 0) {
        await supabase.from('item_tags').insert(selectedTags.map((t) => ({ item_id: itemId!, tag_id: t.id })));
      }
    }

      notificationSuccess();
    setSaving(false);
    if (itemId) {
      router.replace(`/item/${itemId}`);
    } else {
      router.back();
    }
  };

  const selectedFolder = allFolders.find((f) => f.id === form.folder_id);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-3">
        <TouchableOpacity onPress={() => router.back()} className="rounded-xl p-2" style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
          <ArrowLeft color={colors.textPrimary} size={20} />
        </TouchableOpacity>
        <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>{isEdit ? 'Edit Item' : 'Add Item'}</Text>
        <TouchableOpacity
          onPress={save}
          disabled={saving}
          className="flex-row items-center gap-1.5 rounded-xl px-3 py-2.5"
          style={{ backgroundColor: colors.accent }}>
          {saving ? (
            <ActivityIndicator color={colors.accentOnAccent} size="small" />
          ) : (
            <>
              <Save color={colors.accentOnAccent} size={16} />
              <Text className="font-bold text-sm" style={{ color: colors.accentOnAccent }}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Photos */}
          <View className="px-5 mb-4">
            <Text className="mb-2 text-sm font-medium" style={{ color: colors.textSecondary }}>Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-3">
                {photos.map((photo, idx) => (
                  <View key={idx} className="relative">
                    <Image
                      source={{ uri: photo }}
                      style={{ width: 90, height: 90, borderRadius: 12 }}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      onPress={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute -right-1.5 -top-1.5 rounded-full p-1"
                      style={{ backgroundColor: colors.destructive }}>
                      <X color="#fff" size={12} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={takePhoto}
                  className="items-center justify-center rounded-xl"
                  style={{ width: 90, height: 90, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' }}>
                  {uploadingPhotos ? (
                    <ActivityIndicator color={colors.accent} size="small" />
                  ) : (
                    <>
                      <Camera color={colors.accent} size={22} />
                      <Text className="mt-1 text-xs" style={{ color: colors.textSecondary }}>Camera</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={pickImage}
                  className="items-center justify-center rounded-xl"
                  style={{ width: 90, height: 90, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' }}>
                  <ImageIcon color={colors.accent} size={22} />
                  <Text className="mt-1 text-xs" style={{ color: colors.textSecondary }}>Library</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>

          {/* Basic Info */}
          <FormSection title="Basic Information" colors={colors} isDark={isDark}>
            <FormField label="Name *" value={form.name} onChangeText={(v) => f('name', v)} placeholder="Item name" colors={colors} />
            <FormField label="Description" value={form.description} onChangeText={(v) => f('description', v)} placeholder="Optional description" multiline colors={colors} />
            <FormField label="SKU" value={form.sku} onChangeText={(v) => f('sku', v)} placeholder="Stock keeping unit" colors={colors} />
            <View>
              <Text className="mb-1.5 text-xs font-medium" style={{ color: colors.textSecondary }}>Barcode</Text>
              <View className="flex-row items-center gap-2">
                <TextInput
                  className="flex-1 rounded-xl px-4 py-3.5 text-sm"
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary }}
                  placeholder="Scan or enter barcode"
                  placeholderTextColor={colors.textSecondary}
                  value={form.barcode}
                  onChangeText={(v) => f('barcode', v)}
                />
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/scanner')}
                  className="items-center justify-center rounded-xl p-3.5"
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                  <QrCode color={colors.accent} size={20} />
                </TouchableOpacity>
              </View>
            </View>
          </FormSection>

          {/* Quantity */}
          <FormSection title="Stock" colors={colors} isDark={isDark}>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <FormField label="Quantity" value={form.quantity} onChangeText={(v) => f('quantity', v)} placeholder="0" keyboardType="numeric" colors={colors} />
              </View>
              <View className="flex-1">
                <FormField label="Min Quantity" value={form.min_quantity} onChangeText={(v) => f('min_quantity', v)} placeholder="0" keyboardType="numeric" colors={colors} />
              </View>
            </View>
            <FormField label="Location" value={form.location} onChangeText={(v) => f('location', v)} placeholder="e.g. Aisle 3, Shelf B" colors={colors} />
          </FormSection>

          {/* Pricing */}
          <FormSection title="Pricing" colors={colors} isDark={isDark}>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <FormField label="Cost Price (£)" value={form.cost_price} onChangeText={(v) => f('cost_price', v)} placeholder="0.00" keyboardType="decimal-pad" colors={colors} />
              </View>
              <View className="flex-1">
                <FormField label="Sell Price (£)" value={form.sell_price} onChangeText={(v) => f('sell_price', v)} placeholder="0.00" keyboardType="decimal-pad" colors={colors} />
              </View>
            </View>
            <FormField label="Weight (kg)" value={form.weight} onChangeText={(v) => f('weight', v)} placeholder="0.000" keyboardType="decimal-pad" colors={colors} />
          </FormSection>

          {/* Organisation */}
          <FormSection title="Organisation" colors={colors} isDark={isDark}>
            {/* Folder Picker */}
            <View className="mb-3">
              <Text className="mb-1.5 text-xs font-medium" style={{ color: colors.textSecondary }}>Folder</Text>
              <TouchableOpacity
                onPress={() => setShowFolderModal(true)}
                className="flex-row items-center justify-between rounded-xl px-4 py-3.5"
                style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                <View className="flex-row items-center gap-2">
                  <FolderOpen color={colors.textSecondary} size={16} />
                  <Text className="text-sm" style={{ color: selectedFolder ? colors.textPrimary : colors.textSecondary }}>
                    {selectedFolder?.name ?? 'No folder (root)'}
                  </Text>
                </View>
                {selectedFolder && (
                  <TouchableOpacity onPress={() => f('folder_id', null)}>
                    <X color={colors.textSecondary} size={16} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </View>

            {/* Tags */}
            <View>
              <Text className="mb-1.5 text-xs font-medium" style={{ color: colors.textSecondary }}>Tags</Text>
              <View className="flex-row flex-wrap gap-2 mb-2">
                {selectedTags.map((tag) => (
                  <TouchableOpacity
                    key={tag.id}
                    onPress={() => setSelectedTags((prev) => prev.filter((t) => t.id !== tag.id))}
                    className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
                    style={{ backgroundColor: `${tag.colour ?? colors.accent}22`, borderWidth: 1, borderColor: `${tag.colour ?? colors.accent}44` }}>
                    <Text className="text-xs font-medium" style={{ color: tag.colour ?? colors.accent }}>
                      {tag.name}
                    </Text>
                    <X color={tag.colour ?? colors.accent} size={12} />
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  onPress={() => setShowTagModal(true)}
                  className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                  <Plus color={colors.textSecondary} size={14} />
                  <Text className="text-xs" style={{ color: colors.textSecondary }}>Add Tag</Text>
                </TouchableOpacity>
              </View>
            </View>
          </FormSection>

          {/* Notes */}
          <FormSection title="Notes" colors={colors} isDark={isDark}>
            <FormField label="" value={form.notes} onChangeText={(v) => f('notes', v)} placeholder="Additional notes..." multiline colors={colors} />
          </FormSection>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Tag Modal */}
      <Modal visible={showTagModal} animationType="slide" transparent>
        <View className="flex-1 justify-end" style={{ backgroundColor: colors.overlay }}>
          <View className="rounded-t-3xl p-6" style={{ backgroundColor: colors.surface, maxHeight: '70%' }}>
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>Select Tags</Text>
              <TouchableOpacity onPress={() => setShowTagModal(false)}>
                <X color={colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>
            {/* Create new tag */}
            <View className="mb-4 flex-row gap-2">
              <TextInput
                className="flex-1 rounded-xl px-4 py-3 text-sm"
                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary }}
                placeholder="New tag name..."
                placeholderTextColor={colors.textSecondary}
                value={newTagName}
                onChangeText={setNewTagName}
              />
              <TouchableOpacity
                onPress={createTag}
                className="items-center justify-center rounded-xl px-4"
                style={{ backgroundColor: colors.accent }}>
                <Plus color={colors.accentOnAccent} size={18} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {allTags.map((tag) => {
                const selected = selectedTags.some((t) => t.id === tag.id);
                return (
                  <TouchableOpacity
                    key={tag.id}
                    onPress={() => {
                      setSelectedTags((prev) =>
                        selected ? prev.filter((t) => t.id !== tag.id) : [...prev, tag]
                      );
                    }}
                    className="mb-2 flex-row items-center justify-between rounded-xl px-4 py-3"
                    style={{
                      backgroundColor: selected ? `${tag.colour ?? colors.accent}22` : colors.background,
                      borderWidth: 1,
                      borderColor: selected ? `${tag.colour ?? colors.accent}44` : colors.border,
                    }}>
                    <Text className="text-sm font-medium" style={{ color: tag.colour ?? colors.accent }}>
                      {tag.name}
                    </Text>
                    {selected && <Text style={{ color: tag.colour ?? colors.accent }}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Folder Modal */}
      <Modal visible={showFolderModal} animationType="slide" transparent>
        <View className="flex-1 justify-end" style={{ backgroundColor: colors.overlay }}>
          <View className="rounded-t-3xl p-6" style={{ backgroundColor: colors.surface, maxHeight: '60%' }}>
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>Select Folder</Text>
              <TouchableOpacity onPress={() => setShowFolderModal(false)}>
                <X color={colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <TouchableOpacity
                onPress={() => { f('folder_id', null); setShowFolderModal(false); }}
                className="mb-2 flex-row items-center gap-3 rounded-xl px-4 py-3"
                style={{ backgroundColor: !form.folder_id ? colors.accentMuted : colors.background }}>
                <FolderOpen color={colors.textSecondary} size={18} />
                <Text className="text-sm" style={{ color: colors.textPrimary }}>Root (no folder)</Text>
              </TouchableOpacity>
              {allFolders.map((folder) => (
                <TouchableOpacity
                  key={folder.id}
                  onPress={() => { f('folder_id', folder.id); setShowFolderModal(false); }}
                  className="mb-2 flex-row items-center gap-3 rounded-xl px-4 py-3"
                  style={{ backgroundColor: form.folder_id === folder.id ? colors.accentMuted : colors.background }}>
                  <FolderOpen color={folder.colour ?? colors.accent} size={18} />
                  <Text className="text-sm" style={{ color: colors.textPrimary }}>{folder.name}</Text>
                  {form.folder_id === folder.id && <Text style={{ color: colors.accent }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function FormSection({ title, children, colors, isDark }: { title: string; children: React.ReactNode; colors: ThemeColors; isDark: boolean }) {
  return (
    <View className="mb-4 px-5">
      {title && <Text className="mb-3 text-sm font-semibold" style={{ color: colors.textPrimary }}>{title}</Text>}
      <View className="rounded-2xl p-4 gap-3" style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
        {children}
      </View>
    </View>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'email-address';
  multiline?: boolean;
  colors: ThemeColors;
}) {
  return (
    <View>
      {label && (
        <Text className="mb-1.5 text-xs font-medium" style={{ color: colors.textSecondary }}>
          {label}
        </Text>
      )}
      <TextInput
        className="rounded-xl px-4 py-3.5 text-sm"
        style={{
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          color: colors.textPrimary,
          minHeight: multiline ? 80 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
      />
    </View>
  );
}
