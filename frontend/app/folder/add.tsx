import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useTeam } from '@/lib/team-context';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { ThemeColors } from '@/lib/theme-context';
import { generateSku, getPhotoUrl } from '@/lib/utils';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Camera,
  Image as ImageIcon,
  Save,
  X,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AddFolderScreen() {
  const params = useLocalSearchParams<{ parent_folder_id?: string; id?: string }>();
  const parentFolderId = Array.isArray(params.parent_folder_id) ? params.parent_folder_id[0] : params.parent_folder_id;
  const editId = Array.isArray(params.id) ? params.id[0] : params.id;
  const isEdit = !!editId;
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const { teamId } = useTeam();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load existing folder data in edit mode
  useEffect(() => {
    if (!isEdit || !editId) return;
    setLoading(true);
    supabase
      .from('folders')
      .select('*')
      .eq('id', editId)
      .single()
      .then(({ data, error }) => {
        if (data && !error) {
          setName(data.name ?? '');
          setDescription(data.description ?? '');
          const img = data.cover_image ? (getPhotoUrl(data.cover_image) ?? data.cover_image) : null;
          setCoverImage(img);
        }
        setLoading(false);
      });
  }, [editId, isEdit]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      uploadImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    setUploadingPhoto(true);
    try {
      const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const filename = `folders/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const formData = new FormData();
      formData.append('file', { uri, name: filename, type: `image/${ext}` } as any);
      const { data, error } = await supabase.storage.from('item-photos').upload(filename, formData, {
        contentType: `image/${ext}`,
        upsert: false,
      });
      if (!error && data) {
        const { data: urlData } = supabase.storage.from('item-photos').getPublicUrl(data.path);
        setCoverImage(urlData.publicUrl);
      } else {
        setCoverImage(uri);
      }
    } catch {
      setCoverImage(uri);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Folder name is required.');
      return;
    }

    setSaving(true);
    try {
      if (isEdit && editId) {
        const { error } = await supabase
          .from('folders')
          .update({
            name: name.trim(),
            description: description.trim() || null,
            cover_image: coverImage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editId);
        if (error) throw error;
      } else {
        const sku = await generateSku('folder');
        const { error } = await supabase
          .from('folders')
          .insert({
            name: name.trim(),
            description: description.trim() || null,
            parent_folder_id: parentFolderId ?? null,
            sku,
            colour: colors.accent,
            cover_image: coverImage,
            team_id: teamId ?? null,
            created_by: user?.id ?? null,
          })
          .select()
          .single();
        if (error) throw error;
      }
      router.back();
    } catch (e: any) {
      console.error('Folder save error:', e);
      Alert.alert('Error', e.message || `Failed to ${isEdit ? 'update' : 'create'} folder`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="rounded-xl p-2"
          style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
          <ArrowLeft color={colors.textPrimary} size={20} />
        </TouchableOpacity>
        <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>{isEdit ? 'Edit Folder' : 'New Folder'}</Text>
        <TouchableOpacity
          onPress={handleSave}
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
        {loading ? (
          <ActivityIndicator color={colors.accent} className="mt-12" />
        ) : (
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Cover Image */}
          <View className="px-5 mb-4">
            <Text className="mb-2 text-sm font-medium" style={{ color: colors.textSecondary }}>Cover Image</Text>
            {coverImage ? (
              <View className="relative">
                <Image
                  source={{ uri: coverImage }}
                  style={{ width: '100%', height: 200, borderRadius: 16 }}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  onPress={() => setCoverImage(null)}
                  className="absolute right-2 top-2 rounded-full p-1.5"
                  style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                  <X color="#fff" size={16} />
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={takePhoto}
                  activeOpacity={0.7}
                  className="items-center justify-center rounded-xl"
                  style={{ width: 100, height: 100, backgroundColor: colors.accentMuted, borderWidth: 1.5, borderColor: `${colors.accent}44`, borderStyle: 'dashed' }}>
                  {uploadingPhoto ? (
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

          {/* Folder Details */}
          <FormSection title="Folder Details" colors={colors} isDark={isDark}>
            <FormField
              label="Name *"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Ali Express, Amazon"
              colors={colors}
            />
            <FormField
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="What's inside this folder?"
              multiline
              colors={colors}
            />
          </FormSection>
        </ScrollView>
        )}
      </KeyboardAvoidingView>
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
  multiline,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  colors: ThemeColors;
}) {
  return (
    <View>
      {label ? (
        <Text className="mb-1.5 text-xs font-medium" style={{ color: colors.textSecondary }}>
          {label}
        </Text>
      ) : null}
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
        multiline={multiline}
        returnKeyType={multiline ? 'default' : 'done'}
      />
    </View>
  );
}
