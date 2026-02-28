import { COLORS } from '@/lib/theme';
import React from 'react';
import { View, Animated } from 'react-native';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  const opacity = React.useRef(new Animated.Value(0.4)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: COLORS.navyCard,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function CardSkeleton() {
  return (
    <View
      className="mb-3 rounded-2xl p-4"
      style={{ backgroundColor: COLORS.navyCard }}>
      <View className="flex-row items-center gap-3">
        <Skeleton width={48} height={48} borderRadius={12} />
        <View className="flex-1 gap-2">
          <Skeleton width="70%" height={14} />
          <Skeleton width="45%" height={12} />
        </View>
      </View>
    </View>
  );
}

export function ItemGridSkeleton() {
  return (
    <View
      className="m-1.5 flex-1 rounded-2xl p-3"
      style={{ backgroundColor: COLORS.navyCard }}>
      <Skeleton width="100%" height={120} borderRadius={12} />
      <View className="mt-3 gap-2">
        <Skeleton width="80%" height={13} />
        <Skeleton width="50%" height={11} />
      </View>
    </View>
  );
}
