import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { ThemeColors } from '@/lib/theme-context';
import type { Folder, Item } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ChevronRight,
  Filter,
  Grid2X2,
  LayoutList,
  Package,
  Search,
  X,
  Home,
  MoreHorizontal,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/ui/EmptyState';
import { LowStockBadge } from '@/components/ui/Badge';
import { InventoryFAB } from '@/components/InventoryFAB';
import { FolderCreationModal } from '@/components/FolderCreationModal';

type ViewMode = 'grid' | 'list';
type SortBy = 'name' | 'date' | 'quantity' | 'value';

type EnhancedFolder = Folder & {
  subfolder_count?: number;
  unit_count?: number;
  total_value?: number;
  thumbnails?: string[];
};

export default function InventoryScreen() {
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams<{ filter?: string; folder_id?: string }>();
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Folder[]>([]);
  const [folders, setFolders] = useState<EnhancedFolder[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [filterLowStock, setFilterLowStock] = useState(params.filter === 'low_stock');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFolderModalVisible, setIsFolderModalVisible] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const folderId = currentFolder?.id ?? null;

      // Load subfolders with stats and thumbnails
      const { data: foldersData } = await supabase
        .from('folders')
        .select(`
          *,
          stats:folder_stats(subfolder_count, unit_count, total_value),
          thumbs:folder_thumbnails(thumbnails)
        `)
        .is('parent_folder_id', folderId)
        .order('name');

      const enhancedFolders = (foldersData ?? []).map(f => ({
        ...f,
        subfolder_count: f.stats?.[0]?.subfolder_count ?? 0,
        unit_count: f.stats?.[0]?.unit_count ?? 0,
        total_value: f.stats?.[0]?.total_value ?? 0,
        thumbnails: f.thumbs?.[0]?.thumbnails ?? [],
      })) as EnhancedFolder[];

      // Load items in this folder
      let query = supabase
        .from('items')
        .select('*')
        .eq('status', 'active')
        .order(sortBy === 'date' ? 'created_at' : sortBy === 'quantity' ? 'quantity' : sortBy === 'value' ? 'sell_price' : 'name');

      if (folderId) {
        query = query.eq('folder_id', folderId);
      } else {
        query = query.is('folder_id', null);
      }

      if (searchQuery.trim()) {
        query = query.or(`name.ilike.%${searchQuery}%,sku.ilike.%${searchQuery}%,barcode.ilike.%${searchQuery}%`);
      }

      const { data: itemsData } = await query;

      setFolders(enhancedFolders);
      let filteredItems = (itemsData ?? []) as Item[];
      if (filterLowStock) {
        filteredItems = filteredItems.filter((i) => i.quantity <= i.min_quantity);
      }
      setItems(filteredItems);
    } catch (e) {
      console.error('Inventory load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentFolder, searchQuery, filterLowStock, sortBy]);

  // Global search across all folders
  const searchAll = useCallback(async (q: string) => {
    if (!q.trim()) {
      loadData();
      return;
    }
    const { data } = await supabase
      .from('items')
      .select('*')
      .eq('status', 'active')
      .or(`name.ilike.%${q}%,sku.ilike.%${q}%,barcode.ilike.%${q}%,description.ilike.%${q}%`)
      .limit(50);
    setFolders([]);
    setItems((data ?? []) as Item[]);
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        searchAll(searchQuery);
      } else {
        loadData();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const navigateToFolder = async (folder: Folder) => {
    setBreadcrumbs((prev) => [...prev, currentFolder].filter(Boolean) as Folder[]);
    setCurrentFolder(folder);
    setLoading(true);
  };

  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      setCurrentFolder(null);
      setBreadcrumbs([]);
    } else {
      const target = breadcrumbs[index];
      setBreadcrumbs(breadcrumbs.slice(0, index));
      setCurrentFolder(target);
    }
    setLoading(true);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const totalFolders = folders.length;
  const totalItems = items.length;
  const totalQuantity = items.reduce((acc, i) => acc + (i.quantity || 0), 0) + folders.reduce((acc, f) => acc + (f.unit_count || 0), 0);
  const totalValue = items.reduce((acc, i) => acc + ((i.quantity || 0) * (i.sell_price || 0)), 0) + folders.reduce((acc, f) => acc + (f.total_value || 0), 0);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="px-5 pt-4 pb-3">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-xl font-bold" style={{ fontWeight: '800', color: colors.textPrimary }}>
            Inventory
          </Text>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="rounded-xl p-2.5"
              style={{ backgroundColor: colors.surface }}>
              {viewMode === 'grid' ? (
                <LayoutList color={colors.textSecondary} size={18} />
              ) : (
                <Grid2X2 color={colors.textSecondary} size={18} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Bar */}
        <View className="mb-4 flex-row justify-between rounded-2xl p-4" style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
          <View className="items-center">
            <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '700' }}>FOLDERS</Text>
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '800' }}>{totalFolders}</Text>
          </View>
          <View className="items-center">
            <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '700' }}>ITEMS</Text>
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '800' }}>{totalItems}</Text>
          </View>
          <View className="items-center">
            <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '700' }}>TOTAL QTY</Text>
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '800' }}>{totalQuantity}</Text>
          </View>
          <View className="items-center">
            <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '700' }}>TOTAL VALUE</Text>
            <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '800' }}>{formatCurrency(totalValue)}</Text>
          </View>
        </View>

        {/* Search */}
        <View
          className="flex-row items-center rounded-xl px-3 py-2.5"
          style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
          <Search color={colors.textSecondary} size={16} />
          <TextInput
            className="ml-2 flex-1 text-sm"
            placeholder="Search items, SKU, barcode..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{ color: colors.textPrimary }}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X color={colors.textSecondary} size={16} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Breadcrumbs */}
        {(currentFolder || breadcrumbs.length > 0) && (
          <View className="mt-3 flex-row items-center flex-wrap gap-1">
            <TouchableOpacity onPress={() => navigateToBreadcrumb(-1)}>
              <Home color={colors.textSecondary} size={14} />
            </TouchableOpacity>
            {breadcrumbs.map((bc, idx) => (
              <React.Fragment key={bc.id}>
                <ChevronRight color={colors.textSecondary} size={12} />
                <TouchableOpacity onPress={() => navigateToBreadcrumb(idx)}>
                  <Text className="text-xs" style={{ color: colors.textSecondary }}>
                    {bc.name}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
            {currentFolder && (
              <>
                <ChevronRight color={colors.textSecondary} size={12} />
                <Text className="text-xs font-medium" style={{ color: colors.textPrimary }}>{currentFolder.name}</Text>
              </>
            )}
          </View>
        )}

        {/* Filter chips */}
        <View className="mt-3 flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => setFilterLowStock(!filterLowStock)}
            className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
            style={{
              backgroundColor: filterLowStock ? colors.warningMuted : colors.surface,
              borderWidth: 1,
              borderColor: filterLowStock ? `${colors.warning}66` : colors.border,
            }}>
            <Filter color={filterLowStock ? colors.warning : colors.textSecondary} size={12} />
            <Text
              className="text-xs font-medium"
              style={{ color: filterLowStock ? colors.warning : colors.textSecondary }}>
              Low Stock
            </Text>
          </TouchableOpacity>
          {(['name', 'date', 'quantity'] as SortBy[]).map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setSortBy(s)}
              className="rounded-full px-3 py-1.5"
              style={{
                backgroundColor: sortBy === s ? colors.accentMuted : colors.surface,
                borderWidth: 1,
                borderColor: sortBy === s ? `${colors.accent}66` : colors.border,
              }}>
              <Text
                className="text-xs font-medium"
                style={{ color: sortBy === s ? colors.accent : colors.textSecondary }}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <ActivityIndicator color={colors.accent} className="mt-8" />
      ) : (
        <FlatList
          key={viewMode}
          data={[...folders.map((f) => ({ ...f, _type: 'folder' as const })), ...items.map((i) => ({ ...i, _type: 'item' as const }))]}
          keyExtractor={(item) => item.id}
          numColumns={viewMode === 'grid' ? 2 : 1}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          ListEmptyComponent={
            <EmptyState
              icon={<Package color={colors.textSecondary} size={32} />}
              title="No items here"
              message={currentFolder ? `${currentFolder.name} is empty.` : 'Add your first inventory item to get started.'}
              actionLabel="Add Item"
              onAction={() => router.push('/item/add')}
            />
          }
          renderItem={({ item }) => {
            if ((item as any)._type === 'folder') {
              return (
                <FolderCard
                  folder={item as EnhancedFolder}
                  onPress={() => navigateToFolder(item as unknown as Folder)}
                  colors={colors}
                  isDark={isDark}
                />
              );
            }
            if (viewMode === 'grid') {
              return <GridItem item={item as Item} onPress={() => router.push(`/item/${item.id}`)} colors={colors} isDark={isDark} />;
            }
            return <ListItem item={item as Item} onPress={() => router.push(`/item/${item.id}`)} colors={colors} isDark={isDark} />;
          }}
        />
      )}

      <InventoryFAB
        currentFolderId={currentFolder?.id}
        currentFolderName={currentFolder?.name}
        onAddFolderPress={() => setIsFolderModalVisible(true)}
      />

      <FolderCreationModal
        isVisible={isFolderModalVisible}
        onClose={() => setIsFolderModalVisible(false)}
        onSuccess={loadData}
        parentFolderId={currentFolder?.id}
      />
    </SafeAreaView>
  );
}

function FolderCard({ folder, onPress, colors, isDark }: { folder: EnhancedFolder; onPress: () => void; colors: ThemeColors; isDark: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="mb-3 flex-row items-center rounded-2xl px-4 py-3"
      style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
      {/* Thumbnail Grid */}
      <View className="mr-4 h-[60px] w-[60px] flex-row flex-wrap rounded-xl overflow-hidden" style={{ backgroundColor: colors.background }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} className="h-[30px] w-[30px] items-center justify-center border-[0.5px]" style={{ borderColor: colors.border }}>
            {folder.thumbnails?.[i] ? (
              <Image source={{ uri: folder.thumbnails[i] }} className="h-full w-full" resizeMode="cover" />
            ) : (
              <Package color={colors.textSecondary} size={12} />
            )}
          </View>
        ))}
      </View>

      <View className="flex-1">
        <Text style={{ color: colors.textSecondary, fontSize: 10, marginBottom: 2 }}>{folder.sku || 'NO SKU'}</Text>
        <Text className="font-bold text-base leading-tight" numberOfLines={1} style={{ color: colors.textPrimary }}>{folder.name}</Text>
        <View className="mt-1 flex-row items-center">
          <Package color={colors.textSecondary} size={12} style={{ marginRight: 4 }} />
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
            {folder.subfolder_count || 0} folders | {folder.unit_count || 0} units | {formatCurrency(folder.total_value)}
          </Text>
        </View>
      </View>

      <TouchableOpacity className="p-2">
        <MoreHorizontal color={colors.textSecondary} size={20} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function ListItem({ item, onPress, colors, isDark }: { item: Item; onPress: () => void; colors: ThemeColors; isDark: boolean }) {
  const photoUrl = item.photos?.[0];
  return (
    <TouchableOpacity
      onPress={onPress}
      className="mb-3 flex-row items-center rounded-2xl px-4 py-3"
      style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
      {/* Thumbnail Grid (Always grid style as per prompt) */}
      <View className="mr-4 h-[60px] w-[60px] flex-row flex-wrap rounded-xl overflow-hidden" style={{ backgroundColor: colors.background }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} className="h-[30px] w-[30px] items-center justify-center border-[0.5px]" style={{ borderColor: colors.border }}>
            {item.photos?.[i] ? (
              <Image source={{ uri: item.photos[i] }} className="h-full w-full" resizeMode="cover" />
            ) : (
              <Package color={colors.textSecondary} size={12} />
            )}
          </View>
        ))}
      </View>

      <View className="flex-1">
        <Text style={{ color: colors.textSecondary, fontSize: 10, marginBottom: 2 }}>{item.sku || 'NO SKU'}</Text>
        <Text className="font-bold text-base leading-tight" numberOfLines={1} style={{ color: colors.textPrimary }}>{item.name}</Text>
        <View className="mt-1 flex-row items-center">
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
            {item.quantity} units | {formatCurrency(item.sell_price)}
          </Text>
        </View>
      </View>

      <TouchableOpacity className="p-2">
        <MoreHorizontal color={colors.textSecondary} size={20} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function GridItem({ item, onPress, colors, isDark }: { item: Item; onPress: () => void; colors: ThemeColors; isDark: boolean }) {
  const photoUrl = item.photos?.[0];
  return (
    <TouchableOpacity
      onPress={onPress}
      className="mx-1.5 mb-3 flex-1 rounded-2xl overflow-hidden"
      style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
      <View
        className="items-center justify-center"
        style={{ height: 130, backgroundColor: colors.border }}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={{ width: '100%', height: 130 }} resizeMode="cover" />
        ) : (
          <Package color={colors.textSecondary} size={36} />
        )}
      </View>
      <View className="p-3">
        <Text className="font-semibold text-sm" numberOfLines={2} style={{ color: colors.textPrimary }}>{item.name}</Text>
        <View className="mt-1.5 flex-row items-center justify-between">
          <Text className="text-xs font-medium" style={{ color: colors.accent }}>
            {item.quantity} units
          </Text>
          {item.sell_price != null && (
            <Text className="text-xs" style={{ color: colors.textSecondary }}>
              {formatCurrency(item.sell_price)}
            </Text>
          )}
        </View>
        <LowStockBadge quantity={item.quantity} minQuantity={item.min_quantity} />
      </View>
    </TouchableOpacity>
  );
}
