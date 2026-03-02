import { useTheme, getCardShadow } from '@/lib/theme-context';
import { router } from 'expo-router';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  BarChart3,
  ChevronRight,
  Package,
} from 'lucide-react-native';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const REPORTS = [
  {
    title: 'Activity History',
    description: 'View all user actions and audit trail',
    icon: Activity,
    color: '#58A6FF',
    route: '/activity-log',
  },
  {
    title: 'Inventory Summary',
    description: 'Overview of all items, quantities, and values',
    icon: Package,
    color: '#3FB950',
    route: '/inventory-summary',
  },
  {
    title: 'Low Stock Report',
    description: 'Items below minimum quantity threshold',
    icon: AlertTriangle,
    color: '#D29922',
    route: '/low-stock',
  },
  {
    title: 'Transactions',
    description: 'All inventory quantity changes and movements',
    icon: ArrowLeftRight,
    color: '#F0883E',
    route: '/transactions',
  },
];

export default function ReportsScreen() {
  const { colors, isDark } = useTheme();

  const cardStyle = {
    backgroundColor: colors.surface,
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? colors.borderLight : 'transparent',
    ...getCardShadow(isDark),
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="flex-row items-center px-5 py-3 gap-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="rounded-xl p-2"
          style={cardStyle}>
          <ArrowLeft color={colors.textPrimary} size={20} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>Reports</Text>
        </View>
        <View className="rounded-xl p-2" style={{ backgroundColor: colors.accentMuted }}>
          <BarChart3 color={colors.accent} size={20} />
        </View>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        <Text className="text-sm mb-4 mt-2" style={{ color: colors.textSecondary }}>
          View detailed reports about your inventory operations
        </Text>

        <View className="gap-3 pb-8">
          {REPORTS.map((report) => (
            <TouchableOpacity
              key={report.title}
              onPress={() => router.push(report.route as any)}
              className="rounded-2xl p-4 flex-row items-center"
              style={cardStyle}>
              <View
                className="items-center justify-center rounded-2xl"
                style={{ width: 48, height: 48, backgroundColor: `${report.color}22` }}>
                <report.icon color={report.color} size={22} />
              </View>
              <View className="flex-1 ml-4">
                <Text className="font-semibold text-base" style={{ color: colors.textPrimary }}>
                  {report.title}
                </Text>
                <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
                  {report.description}
                </Text>
              </View>
              <ChevronRight color={colors.textSecondary} size={18} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
