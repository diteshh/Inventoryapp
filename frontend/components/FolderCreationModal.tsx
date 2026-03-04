import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  Image,
  ScrollView,
  Keyboard,
} from 'react-native';
import { X, Folder as FolderIcon, ImagePlus } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme, getElevatedShadow } from '@/lib/theme-context';
import { supabase } from '@/lib/supabase';
import { generateSku } from '@/lib/utils';

interface FolderCreationModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  parentFolderId?: string | null;
}

export function FolderCreationModal({
  isVisible,
  onClose,
  onSuccess,
  parentFolderId = null,
}: FolderCreationModalProps) {
  const { colors, isDark } = useTheme();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
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
        return urlData.publicUrl;
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Please enter a folder name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const sku = await generateSku('folder');

      let coverImageUrl: string | null = null;
      if (imageUri) {
        coverImageUrl = await uploadImage(imageUri);
      }

      const { error: insertError } = await supabase
        .from('folders')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          parent_folder_id: parentFolderId,
          sku,
          colour: colors.accent,
          cover_image: coverImageUrl,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setName('');
      setDescription('');
      setImageUri(null);
      onSuccess();
      onClose();
    } catch (e: any) {
      console.error('Folder creation error:', e);
      setError(e.message || 'Failed to create folder');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setImageUri(null);
    setError(null);
    onClose();
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: 'flex-start',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingTop: 60,
        }}
        onPress={handleClose}>
        <Pressable
          style={{
            width: '100%',
            maxWidth: 400,
            maxHeight: '70%',
            backgroundColor: colors.surfaceElevated,
            borderRadius: 24,
            borderWidth: isDark ? 1 : 0,
            borderColor: isDark ? colors.border : 'transparent',
            ...getElevatedShadow(isDark),
          }}
          onPress={(e) => e.stopPropagation()}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <FolderIcon color={colors.accent} size={24} style={{ marginRight: 10 }} />
                <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary }}>
                  New Folder
                </Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={{ padding: 4 }}>
                <X color={colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 20 }}>
              {/* Cover Image */}
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginLeft: 4 }}>
                  Cover Image (Optional)
                </Text>
                <TouchableOpacity
                  onPress={pickImage}
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderStyle: imageUri ? 'solid' : 'dashed',
                    height: 120,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                  {imageUri ? (
                    <View style={{ width: '100%', height: '100%' }}>
                      <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      <TouchableOpacity
                        onPress={() => setImageUri(null)}
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          backgroundColor: 'rgba(0,0,0,0.6)',
                          borderRadius: 12,
                          padding: 4,
                        }}>
                        <X color="#fff" size={16} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ alignItems: 'center', gap: 6 }}>
                      <ImagePlus color={colors.textSecondary} size={28} />
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>Tap to add cover image</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginLeft: 4 }}>
                  Folder Name
                </Text>
                <TextInput
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: 12,
                    padding: 16,
                    color: colors.textPrimary,
                    fontSize: 16,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                  placeholder="e.g. Ali Express, Amazon"
                  placeholderTextColor={colors.textTertiary}
                  value={name}
                  onChangeText={setName}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
              </View>

              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginLeft: 4 }}>
                  Description (Optional)
                </Text>
                <TextInput
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: 12,
                    padding: 16,
                    color: colors.textPrimary,
                    fontSize: 16,
                    borderWidth: 1,
                    borderColor: colors.border,
                    height: 100,
                    textAlignVertical: 'top',
                  }}
                  placeholder="What's inside this folder?"
                  placeholderTextColor={colors.textTertiary}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  returnKeyType="done"
                  blurOnSubmit
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
              </View>

              {error && (
                <Text style={{ color: colors.destructive, fontSize: 14, textAlign: 'center' }}>
                  {error}
                </Text>
              )}

              <TouchableOpacity
                style={{
                  backgroundColor: colors.accent,
                  borderRadius: 12,
                  padding: 16,
                  alignItems: 'center',
                  marginTop: 8,
                  opacity: loading ? 0.6 : 1,
                }}
                onPress={handleCreate}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={colors.accentOnAccent} />
                ) : (
                  <Text style={{ color: colors.accentOnAccent, fontSize: 16, fontWeight: '700' }}>
                    Create Folder
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
