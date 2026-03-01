import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  Modal,
  Pressable,
} from 'react-native';
import { Plus, X, FileText, Folder as FolderIcon } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { useTheme } from '@/lib/theme-context';
import { router } from 'expo-router';

interface InventoryFABProps {
  currentFolderId?: string;
  currentFolderName?: string;
  onFolderCreated?: () => void;
  onAddFolderPress: () => void;
}

export function InventoryFAB({
  currentFolderId,
  currentFolderName = 'Items',
  onAddFolderPress,
}: InventoryFABProps) {
  const { colors, isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const rotation = useSharedValue(0);

  const toggleOpen = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    rotation.value = withSpring(nextState ? 1 : 0);
  };

  const fabIconStyle = useAnimatedStyle(() => {
    const rotate = interpolate(rotation.value, [0, 1], [0, 45]);
    return {
      transform: [{ rotate: `${rotate}deg` }],
    };
  });

  const handleAddItem = () => {
    toggleOpen();
    if (currentFolderId) {
      router.push(`/item/add?folder_id=${currentFolderId}`);
    } else {
      router.push('/item/add');
    }
  };

  const handleAddFolder = () => {
    toggleOpen();
    onAddFolderPress();
  };

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={toggleOpen}
        style={{
          position: 'absolute',
          bottom: 30,
          right: 20,
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: colors.accent,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 8,
          zIndex: 999,
        }}>
        <Animated.View style={fabIconStyle}>
          <Plus color={colors.accentOnAccent} size={28} strokeWidth={2.5} />
        </Animated.View>
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={toggleOpen}>
        <Pressable
          style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}
          onPress={toggleOpen}>
          <View style={{ width: '100%', height: '100%', justifyContent: 'flex-end' }}>
            <View
              style={{
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 24,
                paddingBottom: 110,
                width: '100%',
                backgroundColor: colors.surfaceElevated,
                borderWidth: isDark ? 1 : 0,
                borderColor: isDark ? colors.borderLight : 'transparent',
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>
                  Adding to: {currentFolderName}
                </Text>
                <TouchableOpacity
                  onPress={toggleOpen}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: colors.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <X color={colors.textSecondary} size={20} />
                </TouchableOpacity>
              </View>

              <View style={{ gap: 12 }}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleAddItem}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderRadius: 12,
                    backgroundColor: colors.accentMuted,
                  }}>
                  <FileText color={colors.accent} size={20} style={{ marginRight: 12 }} />
                  <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>Add Item</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleAddFolder}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderRadius: 12,
                    backgroundColor: colors.accentMuted,
                  }}>
                  <FolderIcon color={colors.accent} size={20} style={{ marginRight: 12 }} />
                  <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>Add Folder</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={toggleOpen}
              style={{
                position: 'absolute',
                bottom: 30,
                right: 20,
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
                elevation: 9,
                zIndex: 1001,
              }}>
              <X color={colors.accentOnAccent} size={28} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
