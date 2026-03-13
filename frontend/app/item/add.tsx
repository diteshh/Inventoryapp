import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useTeam } from '@/lib/team-context';
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
  FlashlightOff,
  Flashlight,
  FolderOpen,
  Image as ImageIcon,
  Plus,
  QrCode,
  Save,
  Tag as TagIcon,
  Trash2,
  X,
  ChevronRight,
  Type,
  AlignLeft,
  Hash,
  CheckSquare,
  ChevronDown,
  Calendar,
  Phone,
  Link,
  Mail,
} from 'lucide-react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Modal,
} from 'react-native';

// Only import CameraView on native
let CameraView: any = null;
let useCameraPermissions: any = null;
if (Platform.OS !== 'web') {
  try {
    const CameraModule = require('expo-camera');
    CameraView = CameraModule.CameraView;
    useCameraPermissions = CameraModule.useCameraPermissions;
  } catch {
    // Camera not available
  }
}
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface CustomField {
  name: string;
  type: string;
  value: any;
  options?: string[];
  placeholder?: string;
}

const FIELD_TYPES = [
  { key: 'small_text', label: 'Small Text Box', icon: Type },
  { key: 'large_text', label: 'Large Text Box', icon: AlignLeft },
  { key: 'number', label: 'Number', icon: Hash },
  { key: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { key: 'dropdown', label: 'Dropdown', icon: ChevronDown },
  { key: 'date', label: 'Date', icon: Calendar },
  { key: 'phone', label: 'Phone Number', icon: Phone },
  { key: 'web_link', label: 'Web Link', icon: Link },
  { key: 'email', label: 'Email', icon: Mail },
] as const;

function getDefaultValue(type: string): any {
  if (type === 'checkbox') return false;
  if (type === 'number') return '';
  return '';
}

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
  const { teamId } = useTeam();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
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
  const [showScanner, setShowScanner] = useState(false);
  const [scannerFlash, setScannerFlash] = useState(false);
  const [scannerScanned, setScannerScanned] = useState(false);
  const [camPermission, requestCamPermission] = useCameraPermissions?.() ?? [null, () => {}];
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [showFieldTypePicker, setShowFieldTypePicker] = useState(false);
  const [showFieldConfig, setShowFieldConfig] = useState(false);
  const [pendingFieldType, setPendingFieldType] = useState<string | null>(null);
  const [fieldNameInput, setFieldNameInput] = useState('');
  const [fieldDefaultValue, setFieldDefaultValue] = useState('');
  const [fieldPlaceholder, setFieldPlaceholder] = useState('');
  const [dropdownOptionsInput, setDropdownOptionsInput] = useState('');

  useEffect(() => {
    supabase.from('tags').select('*').order('name').then(({ data }) => setAllTags((data ?? []) as Tag[]));
    supabase.from('folders').select('*').order('name').then(({ data }) => setAllFolders((data ?? []) as Folder[]));

    if (!isEdit && !form.sku) {
      // Leave SKU empty for new items — user fills it in manually
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
          // Load custom fields
          if (item.custom_fields) {
            const cf = Array.isArray(item.custom_fields) ? item.custom_fields : [];
            setCustomFields(cf as unknown as CustomField[]);
          }
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
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      uploadPhoto(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      uploadPhoto(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string) => {
    setUploadingPhotos(true);
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
        setPhotos([urlData.publicUrl]);
      } else {
        setPhotos([uri]);
      }
    } catch {
      setPhotos([uri]);
    }
    setUploadingPhotos(false);
  };

  const createTag = async () => {
    if (!newTagName.trim()) return;
    const { data } = await supabase.from('tags').insert({ name: newTagName.trim(), colour: colors.accent, team_id: teamId ?? null, created_by: user?.id ?? null }).select().single();
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
    if (form.barcode.trim()) {
      const query = supabase.from('items').select('id').eq('barcode', form.barcode.trim()).eq('status', 'active');
      if (isEdit && id) query.neq('id', id);
      const { data: existing } = await query.limit(1);
      if (existing && existing.length > 0) {
        Alert.alert('Duplicate Barcode', 'Another item already uses this barcode. Please use a unique barcode.');
        return;
      }
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
      custom_fields: (customFields.length > 0 ? customFields : []) as any,
      updated_at: new Date().toISOString(),
      created_by: user?.id,
    };

    let itemId = id;
    if (isEdit && id) {
      await supabase.from('items').update(payload).eq('id', id);
      await logActivity(user?.id, 'item_updated', { itemId: id, details: { item_name: form.name }, teamId });
    } else {
      const { data, error: insertError } = await supabase.from('items').insert({ ...payload, status: 'active', team_id: teamId ?? null }).select().single();
      if (insertError) {
        console.error('Item insert error:', insertError, 'teamId:', teamId);
        Alert.alert('Error', insertError.message || 'Failed to save item.');
        setSaving(false);
        return;
      }
      itemId = data?.id;
      await logActivity(user?.id, 'item_created', { itemId, details: { item_name: form.name }, teamId });
    }

    // Update tags
    if (itemId) {
      await supabase.from('item_tags').delete().eq('item_id', itemId);
      if (selectedTags.length > 0) {
        await supabase.from('item_tags').insert(selectedTags.map((t) => ({ item_id: itemId!, tag_id: t.id, team_id: teamId ?? null })));
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
          {/* Photo */}
          <View className="px-5 mb-4">
            <Text className="mb-2 text-sm font-medium" style={{ color: colors.textSecondary }}>Photo</Text>
            {photos.length > 0 ? (
              <View className="relative" style={{ width: 120, height: 120 }}>
                <Image
                  source={{ uri: photos[0] }}
                  style={{ width: 120, height: 120, borderRadius: 16 }}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  onPress={() => { setPhotos([]); setUploadingPhotos(false); }}
                  className="absolute -right-2 -top-2 rounded-full p-1.5"
                  style={{ backgroundColor: colors.destructive }}>
                  <X color="#fff" size={12} />
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={takePhoto}
                  activeOpacity={0.7}
                  className="items-center justify-center rounded-xl"
                  style={{ width: 100, height: 100, backgroundColor: colors.accentMuted, borderWidth: 1.5, borderColor: `${colors.accent}44`, borderStyle: 'dashed' }}>
                  {uploadingPhotos ? (
                    <ActivityIndicator color={colors.accent} size="small" />
                  ) : (
                    <>
                      <Camera color={colors.accent} size={24} />
                      <Text className="mt-1.5 text-xs font-medium" style={{ color: colors.accent }}>Camera</Text>
                    </>
                  )}
                </TouchableOpacity>
                <Pressable
                  onPress={pickImage}
                  className="items-center justify-center rounded-xl"
                  style={{ width: 100, height: 100, backgroundColor: colors.accentMuted, borderWidth: 1.5, borderColor: `${colors.accent}44`, borderStyle: 'dashed' }}>
                  <ImageIcon color={colors.accent} size={24} />
                  <Text className="mt-1.5 text-xs font-medium" style={{ color: colors.accent }}>Library</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Basic Info */}
          <FormSection title="Basic Information" colors={colors} isDark={isDark}>
            <FormField label="Name *" value={form.name} onChangeText={(v) => f('name', v)} placeholder="Item name" colors={colors} />
            <FormField label="Description" value={form.description} onChangeText={(v) => f('description', v)} placeholder="Optional description" multiline colors={colors} />
            <FormField label="SKU" value={form.sku} onChangeText={(v) => f('sku', v)} placeholder="e.g. ITEM-001" colors={colors} />
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
                  onPress={() => { setScannerScanned(false); setScannerFlash(false); setShowScanner(true); }}
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

          {/* Custom Fields */}
          <FormSection title="Custom Fields" colors={colors} isDark={isDark}>
            {customFields.map((field, index) => (
              <View key={index}>
                <View className="flex-row items-center justify-between mb-1.5">
                  <Text className="text-xs font-medium" style={{ color: colors.textSecondary }}>
                    {field.name}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setCustomFields((prev) => prev.filter((_, i) => i !== index))}
                    hitSlop={8}>
                    <X color={colors.destructive} size={14} />
                  </TouchableOpacity>
                </View>
                <CustomFieldInput
                  field={field}
                  colors={colors}
                  isDark={isDark}
                  onChange={(value) => {
                    setCustomFields((prev) => prev.map((f, i) => (i === index ? { ...f, value } : f)));
                  }}
                />
              </View>
            ))}
            <TouchableOpacity
              onPress={() => {
                setPendingFieldType(null);
                setShowFieldTypePicker(true);
              }}
              className="flex-row items-center justify-center gap-2 rounded-xl py-3"
              style={{ backgroundColor: colors.accentMuted, borderWidth: 1, borderColor: `${colors.accent}44`, borderStyle: 'dashed' }}>
              <Plus color={colors.accent} size={16} />
              <Text className="text-sm font-medium" style={{ color: colors.accent }}>Add Custom Field</Text>
            </TouchableOpacity>
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
                  <FolderOpen color={colors.accent} size={18} />
                  <Text className="text-sm" style={{ color: colors.textPrimary }}>{folder.name}</Text>
                  {form.folder_id === folder.id && <Text style={{ color: colors.accent }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Barcode Scanner Modal */}
      <Modal visible={showScanner} animationType="slide" onRequestClose={() => setShowScanner(false)}>
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
          <View className="flex-row items-center justify-between px-5 py-3">
            <TouchableOpacity
              onPress={() => setShowScanner(false)}
              className="rounded-xl p-2"
              style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
              <ArrowLeft color={colors.textPrimary} size={20} />
            </TouchableOpacity>
            <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>Scan Barcode</Text>
            <View style={{ width: 36 }} />
          </View>

          {Platform.OS === 'web' || !CameraView ? (
            <View className="flex-1 items-center justify-center px-5">
              <Text className="text-sm" style={{ color: colors.textSecondary }}>
                Camera not available on this platform. Enter the barcode manually.
              </Text>
            </View>
          ) : !camPermission?.granted ? (
            <View className="flex-1 items-center justify-center px-8">
              <QrCode color={colors.textSecondary} size={48} />
              <Text className="mt-4 mb-2 text-center text-lg font-bold" style={{ color: colors.textPrimary }}>
                Camera Permission Required
              </Text>
              <Text className="mb-6 text-center text-sm" style={{ color: colors.textSecondary }}>
                Allow camera access to scan barcodes.
              </Text>
              <TouchableOpacity
                onPress={requestCamPermission}
                className="rounded-xl px-6 py-3.5"
                style={{ backgroundColor: colors.accent }}>
                <Text className="font-bold" style={{ color: colors.accentOnAccent }}>Grant Permission</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flex: 1, backgroundColor: '#000' }}>
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                enableTorch={scannerFlash}
                barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'codabar', 'itf14', 'qr'] }}
                onBarcodeScanned={scannerScanned ? undefined : ({ data }: { data: string }) => {
                  setScannerScanned(true);
                  notificationSuccess();
                  f('barcode', data);
                  setShowScanner(false);
                }}>
                <View style={{ flex: 1 }}>
                  {/* Overlay */}
                  <View className="flex-1 items-center justify-center">
                    <View style={{ width: 250, height: 250, borderWidth: 2, borderColor: colors.accent, borderRadius: 24, opacity: 0.7 }} />
                  </View>
                  {/* Flash toggle */}
                  <TouchableOpacity
                    onPress={() => setScannerFlash(!scannerFlash)}
                    className="absolute bottom-8 self-center rounded-full p-4"
                    style={{ backgroundColor: scannerFlash ? colors.accent : colors.surface }}>
                    {scannerFlash
                      ? <FlashlightOff color={colors.accentOnAccent} size={24} />
                      : <Flashlight color={colors.textPrimary} size={24} />}
                  </TouchableOpacity>
                </View>
              </CameraView>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Field Type Picker (bottom sheet) */}
      <Modal visible={showFieldTypePicker} animationType="slide" transparent>
        <View className="flex-1 justify-end" style={{ backgroundColor: colors.overlay }}>
          <View className="rounded-t-3xl p-6" style={{ backgroundColor: colors.surface, maxHeight: '80%' }}>
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>Choose Field Type</Text>
              <TouchableOpacity onPress={() => setShowFieldTypePicker(false)}>
                <X color={colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {FIELD_TYPES.map((ft) => {
                const Icon = ft.icon;
                return (
                  <TouchableOpacity
                    key={ft.key}
                    onPress={() => {
                      setPendingFieldType(ft.key);
                      setFieldNameInput('');
                      setFieldDefaultValue('');
                      setFieldPlaceholder('');
                      setDropdownOptionsInput('');
                      setShowFieldTypePicker(false);
                      setShowFieldConfig(true);
                    }}
                    className="mb-2 flex-row items-center gap-3 rounded-xl px-4 py-3.5"
                    style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                    <Icon color={colors.accent} size={18} />
                    <Text className="flex-1 text-sm font-medium" style={{ color: colors.textPrimary }}>{ft.label}</Text>
                    <ChevronRight color={colors.textSecondary} size={16} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Field Configuration (full screen) */}
      <Modal visible={showFieldConfig} animationType="slide" onRequestClose={() => setShowFieldConfig(false)}>
        <View className="flex-1" style={{ backgroundColor: colors.background, paddingTop: insets.top }}>
          {/* Header */}
          <View>
            <View className="flex-row items-center px-5 py-3" style={{ position: 'relative', minHeight: 44 }}>
              <TouchableOpacity
                onPress={() => setShowFieldConfig(false)}
                className="rounded-xl p-2"
                style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark), zIndex: 1 }}>
                <ArrowLeft color={colors.textPrimary} size={20} />
              </TouchableOpacity>
              <Text className="text-lg font-bold" style={{ color: colors.textPrimary, position: 'absolute', left: 0, right: 0, textAlign: 'center' }}>
                Create Custom Field
              </Text>
            </View>
            <View className="px-5 pb-2">
              <Text className="text-sm" style={{ color: colors.accent }}>
                {FIELD_TYPES.find((ft) => ft.key === pendingFieldType)?.label ?? 'Custom Field'}
              </Text>
            </View>
          </View>

            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
              {/* Field Name & Default Value */}
              <View className="px-5 mt-4">
                <Text className="mb-1.5 text-xs font-medium" style={{ color: colors.textSecondary }}>Field Name</Text>
                <TextInput
                  className="rounded-xl px-4 py-3.5 text-sm mb-4"
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary }}
                  placeholder="Enter Field Name"
                  placeholderTextColor={colors.textSecondary}
                  value={fieldNameInput}
                  onChangeText={setFieldNameInput}
                  autoFocus
                />

                {pendingFieldType === 'dropdown' ? (
                  <>
                    <Text className="mb-1.5 text-xs font-medium" style={{ color: colors.textSecondary }}>Options (comma-separated)</Text>
                    <TextInput
                      className="rounded-xl px-4 py-3.5 text-sm mb-4"
                      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary }}
                      placeholder="e.g. Small, Medium, Large"
                      placeholderTextColor={colors.textSecondary}
                      value={dropdownOptionsInput}
                      onChangeText={setDropdownOptionsInput}
                    />
                  </>
                ) : pendingFieldType === 'checkbox' ? null : (
                  <>
                    <Text className="mb-1.5 text-xs font-medium" style={{ color: colors.textSecondary }}>Placeholder Text</Text>
                    <TextInput
                      className="rounded-xl px-4 py-3.5 text-sm"
                      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary }}
                      placeholder="Optional"
                      placeholderTextColor={colors.textSecondary}
                      value={fieldPlaceholder}
                      onChangeText={setFieldPlaceholder}
                    />
                  </>
                )}
              </View>

              {/* Separator */}
              <View className="my-5" style={{ height: 1, backgroundColor: colors.border }} />

              {/* Field Preview */}
              <View className="px-5">
                <Text className="mb-3 text-xs font-bold uppercase tracking-wider" style={{ color: colors.textPrimary }}>
                  Field Preview
                </Text>
                <View className="rounded-2xl p-4" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                  <Text className="mb-2 text-xs font-medium" style={{ color: colors.textSecondary }}>
                    {fieldNameInput.trim() || 'Field Name'}
                  </Text>
                  {pendingFieldType === 'checkbox' ? (
                    <View className="flex-row items-center gap-3 rounded-xl px-4 py-3.5" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                      <View
                        className="items-center justify-center rounded-md"
                        style={{ width: 22, height: 22, borderWidth: 2, borderColor: colors.textSecondary }}
                      />
                      <Text className="text-sm" style={{ color: colors.textSecondary }}>No</Text>
                    </View>
                  ) : pendingFieldType === 'dropdown' ? (
                    <View className="flex-row flex-wrap gap-2">
                      {(dropdownOptionsInput.split(',').map((o) => o.trim()).filter(Boolean).length > 0
                        ? dropdownOptionsInput.split(',').map((o) => o.trim()).filter(Boolean)
                        : ['Option 1', 'Option 2']
                      ).map((opt, i) => (
                        <View
                          key={i}
                          className="rounded-full px-3.5 py-2"
                          style={{ backgroundColor: i === 0 ? colors.accentMuted : colors.background, borderWidth: 1, borderColor: i === 0 ? colors.accent : colors.border }}>
                          <Text className="text-sm" style={{ color: i === 0 ? colors.accent : colors.textPrimary }}>{opt}</Text>
                        </View>
                      ))}
                    </View>
                  ) : pendingFieldType === 'date' ? (
                    <View className="rounded-xl px-4 py-3.5" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                      <Text className="text-sm" style={{ color: colors.textSecondary }}>{fieldPlaceholder.trim() || 'YYYY-MM-DD'}</Text>
                    </View>
                  ) : pendingFieldType === 'phone' ? (
                    <View className="rounded-xl px-4 py-3.5" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                      <Text className="text-sm" style={{ color: colors.textSecondary }}>{fieldPlaceholder.trim() || 'Phone number'}</Text>
                    </View>
                  ) : pendingFieldType === 'web_link' ? (
                    <View className="rounded-xl px-4 py-3.5" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                      <Text className="text-sm" style={{ color: colors.textSecondary }}>{fieldPlaceholder.trim() || 'https://...'}</Text>
                    </View>
                  ) : pendingFieldType === 'email' ? (
                    <View className="rounded-xl px-4 py-3.5" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                      <Text className="text-sm" style={{ color: colors.textSecondary }}>{fieldPlaceholder.trim() || 'email@example.com'}</Text>
                    </View>
                  ) : pendingFieldType === 'number' ? (
                    <View className="rounded-xl px-4 py-3.5" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                      <Text className="text-sm" style={{ color: colors.textSecondary }}>{fieldPlaceholder.trim() || '0'}</Text>
                    </View>
                  ) : pendingFieldType === 'large_text' ? (
                    <View className="rounded-xl px-4 py-3.5" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, minHeight: 80 }}>
                      <Text className="text-sm" style={{ color: colors.textSecondary }}>{fieldPlaceholder.trim() || 'Enter text...'}</Text>
                    </View>
                  ) : (
                    <View className="rounded-xl px-4 py-3.5" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                      <Text className="text-sm" style={{ color: colors.textSecondary }}>{fieldPlaceholder.trim() || 'Enter text...'}</Text>
                    </View>
                  )}
                </View>
              </View>

            </ScrollView>

          {/* Create Field Button - pinned to bottom */}
          <View className="px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 16), backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
            <TouchableOpacity
              onPress={() => {
                if (!fieldNameInput.trim() || !pendingFieldType) return;
                const newField: CustomField = {
                  name: fieldNameInput.trim(),
                  type: pendingFieldType,
                  value: fieldDefaultValue || getDefaultValue(pendingFieldType),
                };
                if (pendingFieldType === 'checkbox') {
                  newField.value = false;
                }
                if (pendingFieldType === 'dropdown') {
                  newField.options = dropdownOptionsInput.split(',').map((o) => o.trim()).filter(Boolean);
                  if (newField.options.length > 0) newField.value = newField.options[0];
                }
                if (fieldPlaceholder.trim()) {
                  newField.placeholder = fieldPlaceholder.trim();
                }
                setCustomFields((prev) => [...prev, newField]);
                setShowFieldConfig(false);
              }}
              disabled={!fieldNameInput.trim()}
              className="items-center justify-center rounded-xl py-4"
              style={{ backgroundColor: fieldNameInput.trim() ? colors.accent : colors.border }}>
              <Text className="text-base font-bold" style={{ color: fieldNameInput.trim() ? colors.accentOnAccent : colors.textSecondary }}>
                Create Field
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function CustomFieldInput({ field, colors, onChange, isDark }: { field: CustomField; colors: ThemeColors; onChange: (value: any) => void; isDark?: boolean }) {
  const ph = field.placeholder;
  switch (field.type) {
    case 'small_text':
      return (
        <TextInput
          className="rounded-xl px-4 py-3.5 text-sm"
          style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary }}
          placeholder={ph || 'Enter text...'}
          placeholderTextColor={colors.textSecondary}
          value={field.value ?? ''}
          onChangeText={onChange}
          maxLength={190}
        />
      );
    case 'large_text':
      return (
        <TextInput
          className="rounded-xl px-4 py-3.5 text-sm"
          style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary, minHeight: 80, textAlignVertical: 'top' }}
          placeholder={ph || 'Enter text...'}
          placeholderTextColor={colors.textSecondary}
          value={field.value ?? ''}
          onChangeText={onChange}
          multiline
          maxLength={4000}
        />
      );
    case 'number':
      return (
        <TextInput
          className="rounded-xl px-4 py-3.5 text-sm"
          style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary }}
          placeholder={ph || '0'}
          placeholderTextColor={colors.textSecondary}
          value={String(field.value ?? '')}
          onChangeText={onChange}
          keyboardType="decimal-pad"
        />
      );
    case 'checkbox':
      return (
        <Pressable
          onPress={() => onChange(!field.value)}
          className="flex-row items-center gap-3 rounded-xl px-4 py-3.5"
          style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
          <View
            className="items-center justify-center rounded-md"
            style={{ width: 22, height: 22, backgroundColor: field.value ? colors.accent : 'transparent', borderWidth: field.value ? 0 : 2, borderColor: colors.textSecondary }}>
            {field.value && <Text style={{ color: colors.accentOnAccent, fontSize: 14, fontWeight: '700' }}>✓</Text>}
          </View>
          <Text className="text-sm" style={{ color: colors.textPrimary }}>{field.value ? 'Yes' : 'No'}</Text>
        </Pressable>
      );
    case 'dropdown':
      return (
        <View className="flex-row flex-wrap gap-2">
          {(field.options ?? []).map((opt) => (
            <TouchableOpacity
              key={opt}
              onPress={() => onChange(opt)}
              className="rounded-full px-3.5 py-2"
              style={{
                backgroundColor: field.value === opt ? colors.accentMuted : colors.background,
                borderWidth: 1,
                borderColor: field.value === opt ? colors.accent : colors.border,
              }}>
              <Text className="text-sm" style={{ color: field.value === opt ? colors.accent : colors.textPrimary }}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    case 'date':
      return <DateFieldInput field={field} colors={colors} onChange={onChange} isDark={isDark} />;
    case 'phone':
      return (
        <TextInput
          className="rounded-xl px-4 py-3.5 text-sm"
          style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary }}
          placeholder={ph || 'Phone number'}
          placeholderTextColor={colors.textSecondary}
          value={field.value ?? ''}
          onChangeText={onChange}
          keyboardType="phone-pad"
        />
      );
    case 'web_link':
      return (
        <TextInput
          className="rounded-xl px-4 py-3.5 text-sm"
          style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary }}
          placeholder={ph || 'https://...'}
          placeholderTextColor={colors.textSecondary}
          value={field.value ?? ''}
          onChangeText={onChange}
          keyboardType="url"
          autoCapitalize="none"
        />
      );
    case 'email':
      return (
        <TextInput
          className="rounded-xl px-4 py-3.5 text-sm"
          style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary }}
          placeholder={ph || 'email@example.com'}
          placeholderTextColor={colors.textSecondary}
          value={field.value ?? ''}
          onChangeText={onChange}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      );
    default:
      return null;
  }
}

function DateFieldInput({ field, colors, onChange, isDark }: { field: CustomField; colors: ThemeColors; onChange: (value: any) => void; isDark?: boolean }) {
  const [showPicker, setShowPicker] = useState(false);
  const currentDate = field.value ? new Date(field.value) : new Date();
  const isValidDate = field.value && !isNaN(new Date(field.value).getTime());

  const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <View>
      <TouchableOpacity
        onPress={() => setShowPicker(true)}
        className="flex-row items-center justify-between rounded-xl px-4 py-3.5"
        style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
        <Text className="text-sm" style={{ color: isValidDate ? colors.textPrimary : colors.textSecondary }}>
          {isValidDate ? formatDisplayDate(field.value) : (field.placeholder || 'Select date')}
        </Text>
        <Calendar color={colors.textSecondary} size={16} />
      </TouchableOpacity>
      {showPicker && (
        Platform.OS === 'ios' ? (
          <Modal visible transparent animationType="slide">
            <View className="flex-1 justify-end" style={{ backgroundColor: colors.overlay }}>
              <View className="rounded-t-3xl p-6" style={{ backgroundColor: colors.background }}>
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>Select Date</Text>
                  <TouchableOpacity onPress={() => setShowPicker(false)}>
                    <Text className="text-sm font-semibold" style={{ color: colors.accent }}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={isValidDate ? new Date(field.value) : new Date()}
                  mode="date"
                  display="inline"
                  themeVariant={isDark ? 'dark' : 'light'}
                  accentColor={colors.accent}
                  onChange={(_event: DateTimePickerEvent, date?: Date) => {
                    if (date) {
                      onChange(date.toISOString().split('T')[0]);
                    }
                  }}
                />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={isValidDate ? new Date(field.value) : new Date()}
            mode="date"
            display="default"
            onChange={(event: DateTimePickerEvent, date?: Date) => {
              setShowPicker(false);
              if (event.type !== 'dismissed' && date) {
                onChange(date.toISOString().split('T')[0]);
              }
            }}
          />
        )
      )}
    </View>
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
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'email-address' | 'phone-pad' | 'url';
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
