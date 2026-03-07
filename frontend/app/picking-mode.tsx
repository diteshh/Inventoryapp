import { useTheme, getCardShadow } from '@/lib/theme-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { ArrowLeft, Check, Layers, ScanLine } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type PickingMode = 'scan_all' | 'scan_one';

const STORAGE_KEY = 'picking_mode';

const OPTIONS: { key: PickingMode; label: string; description: string; icon: typeof Layers }[] = [
  {
    key: 'scan_all',
    label: 'Scan All',
    description: 'Scan once to pick the full requested quantity',
    icon: Layers,
  },
  {
    key: 'scan_one',
    label: 'Scan One at a Time',
    description: 'Each scan picks one unit at a time',
    icon: ScanLine,
  },
];

export default function PickingModeScreen() {
  const { colors, isDark } = useTheme();
  const [mode, setMode] = useState<PickingMode>('scan_all');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === 'scan_all' || val === 'scan_one') setMode(val);
    });
  }, []);

  const selectMode = async (key: PickingMode) => {
    setMode(key);
    await AsyncStorage.setItem(STORAGE_KEY, key);
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="flex-row items-center justify-between px-5 py-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="rounded-xl p-2"
          style={{
            backgroundColor: colors.surface,
            borderWidth: isDark ? 1 : 0,
            borderColor: isDark ? colors.borderLight : 'transparent',
            ...getCardShadow(isDark),
          }}>
          <ArrowLeft color={colors.textPrimary} size={20} />
        </TouchableOpacity>
        <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>
          Picking Mode
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView className="flex-1 px-5">
        <Text className="text-xs mb-4" style={{ color: colors.textSecondary }}>
          Choose how barcode scanning works when picking items from a pick list.
        </Text>

        <View className="gap-3">
          {OPTIONS.map((opt) => {
            const isActive = mode === opt.key;
            const Icon = opt.icon;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => selectMode(opt.key)}
                className="flex-row items-center gap-4 rounded-2xl p-4"
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: isActive ? 2 : isDark ? 1 : 1,
                  borderColor: isActive ? colors.accent : isDark ? colors.borderLight : colors.border,
                  ...getCardShadow(isDark),
                }}>
                <View
                  className="items-center justify-center rounded-xl"
                  style={{ width: 44, height: 44, backgroundColor: isActive ? colors.accentMuted : `${colors.textSecondary}15` }}>
                  <Icon color={isActive ? colors.accent : colors.textSecondary} size={22} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
                    {opt.label}
                  </Text>
                  <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
                    {opt.description}
                  </Text>
                </View>
                {isActive && (
                  <View
                    className="items-center justify-center rounded-full"
                    style={{ width: 24, height: 24, backgroundColor: colors.accent }}>
                    <Check color={colors.accentOnAccent} size={14} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
