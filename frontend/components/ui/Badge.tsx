import { COLORS } from '@/lib/theme';
import { getPickListStatusColor, getPickListStatusLabel } from '@/lib/utils';
import React from 'react';
import { Text, View } from 'react-native';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const color = getPickListStatusColor(status);
  const label = getPickListStatusLabel(status);
  const paddingH = size === 'sm' ? 8 : 10;
  const paddingV = size === 'sm' ? 3 : 4;
  const fontSize = size === 'sm' ? 11 : 12;

  return (
    <View
      style={{
        backgroundColor: `${color}22`,
        borderColor: `${color}55`,
        borderWidth: 1,
        borderRadius: 100,
        paddingHorizontal: paddingH,
        paddingVertical: paddingV,
      }}>
      <Text style={{ color, fontSize, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

interface LowStockBadgeProps {
  quantity: number;
  minQuantity: number;
}

export function LowStockBadge({ quantity, minQuantity }: LowStockBadgeProps) {
  if (quantity > minQuantity) return null;
  const isOut = quantity === 0;
  const color = isOut ? COLORS.destructive : COLORS.warning;
  const label = isOut ? 'Out of Stock' : 'Low Stock';

  return (
    <View
      style={{
        backgroundColor: `${color}22`,
        borderColor: `${color}55`,
        borderWidth: 1,
        borderRadius: 100,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}>
      <Text style={{ color, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
