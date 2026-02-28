import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { X, Folder as FolderIcon } from 'lucide-react-native';
import { COLORS } from '@/lib/theme';
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
      const sku = await generateSku('folder'); // Using 'folder' to potentially differentiate if needed, or just standard SKU

      const { data, error: insertError } = await supabase
        .from('folders')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          parent_folder_id: parentFolderId,
          sku,
          colour: COLORS.teal, // Default color
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
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <View style={styles.headerTitleContainer}>
                <FolderIcon color={COLORS.teal} size={24} style={styles.headerIcon} />
                <Text style={styles.title}>New Folder</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X color={COLORS.textSecondary} size={24} />
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Folder Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Ali Express, Amazon"
                  placeholderTextColor={COLORS.textSecondary}
                  value={name}
                  onChangeText={setName}
                  autoFocus
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Description (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="What's inside this folder?"
                  placeholderTextColor={COLORS.textSecondary}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {error && <Text style={styles.errorText}>{error}</Text>}

              <TouchableOpacity
                style={[styles.createButton, loading && styles.disabledButton]}
                onPress={handleCreate}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.navy} />
                ) : (
                  <Text style={styles.createButtonText}>Create Folder</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: COLORS.navyCard,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
  },
  closeButton: {
    padding: 4,
  },
  form: {
    gap: 20,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  input: {
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    padding: 16,
    color: COLORS.white,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    color: COLORS.destructive,
    fontSize: 14,
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: COLORS.teal,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  createButtonText: {
    color: COLORS.navy,
    fontSize: 16,
    fontWeight: '700',
  },
});
