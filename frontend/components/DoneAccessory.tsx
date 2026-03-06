import { useTheme } from '@/lib/theme-context';
import React from 'react';
import { InputAccessoryView, Keyboard, Platform, Text, TouchableOpacity, View } from 'react-native';

export const DONE_ACCESSORY_ID = 'keyboardDone';

export default function DoneAccessory() {
  if (Platform.OS !== 'ios') return null;

  const { colors } = useTheme();

  return (
    <InputAccessoryView nativeID={DONE_ACCESSORY_ID}>
      <View
        className="flex-row justify-end px-3 py-1.5"
        style={{ backgroundColor: '#D1D4D9' }}>
        <TouchableOpacity
          onPress={() => Keyboard.dismiss()}
          className="px-2 py-1">
          <Text className="text-base font-semibold" style={{ color: colors.accent }}>Done</Text>
        </TouchableOpacity>
      </View>
    </InputAccessoryView>
  );
}
