import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import { Plus, X, FileText, Folder as FolderIcon } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { COLORS } from '@/lib/theme';
import { router } from 'expo-router';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface InventoryFABProps {
  currentFolderId?: string;
  currentFolderName?: string;
  onFolderCreated?: () => void;
  onAddFolderPress: () => void;
}

export function InventoryFAB({
  currentFolderId,
  currentFolderName = 'Items',
  onFolderCreated,
  onAddFolderPress,
}: InventoryFABProps) {
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
      {/* FAB Button */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={toggleOpen}
        style={[styles.fab, { backgroundColor: COLORS.teal }]}
      >
        <Animated.View style={fabIconStyle}>
          <Plus color={COLORS.navy} size={28} strokeWidth={2.5} />
        </Animated.View>
      </TouchableOpacity>

      {/* Popup Bottom Sheet */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={toggleOpen}
      >
        <Pressable style={styles.overlay} onPress={toggleOpen}>
          <View style={styles.sheetContainer}>
            <View style={[styles.sheet, { backgroundColor: COLORS.navyLight }]}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.headerText}>Adding to: {currentFolderName}</Text>
                <TouchableOpacity onPress={toggleOpen} style={styles.closeButton}>
                  <X color={COLORS.white} size={20} />
                </TouchableOpacity>
              </View>

              {/* Options */}
              <View style={styles.options}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleAddItem}
                  style={[styles.optionButton, { backgroundColor: `${COLORS.teal}22` }]}
                >
                  <FileText color={COLORS.white} size={20} style={styles.optionIcon} />
                  <Text style={styles.optionText}>Add Item</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleAddFolder}
                  style={[styles.optionButton, { backgroundColor: `${COLORS.teal}22` }]}
                >
                  <FolderIcon color={COLORS.white} size={20} style={styles.optionIcon} />
                  <Text style={styles.optionText}>Add Folder</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Floating Close Button (Alternative to rotation if user wants the same position) */}
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={toggleOpen}
              style={[styles.fabInModal, { backgroundColor: COLORS.teal }]}
            >
              <X color={COLORS.navy} size={28} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    zIndex: 999,
  },
  fabInModal: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 9,
    zIndex: 1001,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 110, // Extra padding to clear the FAB
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  options: {
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  optionIcon: {
    marginRight: 12,
  },
  optionText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
