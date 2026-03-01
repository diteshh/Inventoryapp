import { useTheme } from '@/lib/theme-context';
import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      {icon && (
        <View
          className="mb-5 items-center justify-center rounded-3xl p-5"
          style={{ backgroundColor: colors.surface }}>
          {icon}
        </View>
      )}
      <Text
        className="mb-2 text-center text-lg font-semibold"
        style={{ color: colors.textPrimary }}>
        {title}
      </Text>
      {message && (
        <Text className="mb-6 text-center text-sm leading-5" style={{ color: colors.textSecondary }}>
          {message}
        </Text>
      )}
      {actionLabel && onAction && (
        <TouchableOpacity
          onPress={onAction}
          className="rounded-xl px-6 py-3"
          style={{ backgroundColor: colors.accent }}>
          <Text className="font-semibold" style={{ color: colors.accentOnAccent }}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
