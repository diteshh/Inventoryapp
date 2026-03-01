import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { X, Folder as FolderIcon } from 'lucide-react-native';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Please enter a folder name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const sku = await generateSku('folder');

      const { error: insertError } = await supabase
        .from('folders')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          parent_folder_id: parentFolderId,
          sku,
          colour: colors.accent,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setName('');
      setDescription('');
      onSuccess();
      onClose();
    } catch (e: any) {
      console.error('Folder creation error:', e);
      setError(e.message || 'Failed to create folder');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}>
        <Pressable
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
          onPress={onClose}>
          <Pressable
            style={{
              width: '100%',
              maxWidth: 400,
              backgroundColor: colors.surfaceElevated,
              borderRadius: 24,
              padding: 24,
              borderWidth: isDark ? 1 : 0,
              borderColor: isDark ? colors.border : 'transparent',
              ...getElevatedShadow(isDark),
            }}
            onPress={(e) => e.stopPropagation()}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <FolderIcon color={colors.accent} size={24} style={{ marginRight: 10 }} />
                <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary }}>
                  New Folder
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                <X color={colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 20 }}>
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
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
