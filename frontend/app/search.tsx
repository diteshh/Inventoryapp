import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { Item } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { router } from 'expo-router';
import { ArrowLeft, Package, Search, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SearchScreen() {
  const { colors, isDark } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setLoading(true);
    setHasSearched(true);
    try {
      const { data } = await supabase
        .from('items')
        .select('*')
        .eq('status', 'active')
        .or(`name.ilike.%${q}%,sku.ilike.%${q}%,barcode.ilike.%${q}%,description.ilike.%${q}%`)
        .limit(50);
      setResults((data ?? []) as Item[]);
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Search Header */}
      <View className="px-4 pt-3 pb-3 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <ArrowLeft color={colors.textPrimary} size={22} />
        </TouchableOpacity>
        <View
          className="flex-1 flex-row items-center rounded-xl px-3 py-2.5"
          style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent' }}>
          <Search color={colors.textSecondary} size={16} />
          <TextInput
            ref={inputRef}
            className="ml-2 flex-1 text-sm"
            placeholder="Search items, SKU, barcode..."
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            style={{ color: colors.textPrimary }}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')}>
              <X color={colors.textSecondary} size={16} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Results */}
      {loading ? (
        <ActivityIndicator color={colors.accent} className="mt-8" />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            hasSearched ? (
              <View className="items-center mt-16">
                <Search color={colors.textSecondary} size={40} />
                <Text className="mt-4 text-base font-semibold" style={{ color: colors.textPrimary }}>
                  No results found
                </Text>
                <Text className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
                  Try a different search term
                </Text>
              </View>
            ) : (
              <View className="items-center mt-16">
                <Search color={colors.textSecondary} size={40} />
                <Text className="mt-4 text-sm" style={{ color: colors.textSecondary }}>
                  Search across all your inventory items
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/item/${item.id}`)}
              className="mb-3 flex-row items-center rounded-2xl px-4 py-3"
              style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
              <View className="mr-4 h-[50px] w-[50px] rounded-xl overflow-hidden items-center justify-center" style={{ backgroundColor: colors.background }}>
                {item.photos?.[0] ? (
                  <Image source={{ uri: item.photos[0] }} className="h-full w-full" resizeMode="cover" />
                ) : (
                  <Package color={colors.textSecondary} size={20} />
                )}
              </View>
              <View className="flex-1">
                <Text style={{ color: colors.textSecondary, fontSize: 10 }}>{item.sku || 'NO SKU'}</Text>
                <Text className="font-bold text-base" numberOfLines={1} style={{ color: colors.textPrimary }}>{item.name}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                  {item.quantity} units | {formatCurrency(item.sell_price)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}
