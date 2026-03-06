import { useAuth } from '@/lib/auth-context';
import { usePermission } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import { useTeam } from '@/lib/team-context';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { ThemeColors } from '@/lib/theme-context';
import type { Folder, Item } from '@/lib/types';
import { formatCurrency, logActivity } from '@/lib/utils';
import { impactMedium } from '@/lib/haptics';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  ChevronRight,
  Edit2,
  Filter,
  FolderOpen,
  Grid2X2,
  LayoutList,
  Package,
  Search,
  Home,
  MoreHorizontal,
  SlidersHorizontal,
  Check,
  Trash2,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/ui/EmptyState';
import { LowStockBadge } from '@/components/ui/Badge';
import { InventoryFAB } from '@/components/InventoryFAB';

type ViewMode = 'grid' | 'list';
type SortBy = 'name' | 'date' | 'quantity' | 'value';

type EnhancedFolder = Folder & {
  subfolder_count?: number;
  unit_count?: number;
  total_value?: number;
  thumbnails?: string[];
};

export default function InventoryScreen() {
  const { user } = useAuth();
  const { teamId } = useTeam();
  const { can } = usePermission();
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams<{ filter?: string; folder_id?: string }>();
  const [actionMenu, setActionMenu] = useState<{ type: 'folder' | 'item'; data: Folder | Item } | null>(null);
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Folder[]>([]);
  const [folders, setFolders] = useState<EnhancedFolder[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [filterLowStock, setFilterLowStock] = useState(params.filter === 'low_stock');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const isFilterActive = filterLowStock || sortBy !== 'name';

  // Global stats (all items across all folders) for root-level display
  const [globalStats, setGlobalStats] = useState<{ totalQuantity: number; totalValue: number; totalItems: number } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const folderId = currentFolder?.id ?? null;

      // Load subfolders
      let folderQuery = supabase.from('folders').select('*');
      if (folderId) {
        folderQuery = folderQuery.eq('parent_folder_id', folderId);
      } else {
        folderQuery = folderQuery.is('parent_folder_id', null);
      }
      const { data: foldersData } = await folderQuery.order('name');
      const folderIds = (foldersData ?? []).map((f: any) => f.id);

      // Fetch stats and thumbnails separately
      let statsMap: Record<string, any> = {};
      let thumbsMap: Record<string, string[]> = {};
      if (folderIds.length > 0) {
        const { data: statsData } = await supabase
          .from('folder_stats')
          .select('*')
          .in('folder_id', folderIds);
        for (const s of (statsData ?? []) as any[]) {
          statsMap[s.folder_id] = s;
        }
        const { data: thumbsData } = await supabase
          .from('folder_thumbnails')
          .select('*')
          .in('folder_id', folderIds);
        for (const t of (thumbsData ?? []) as any[]) {
          thumbsMap[t.folder_id] = t.thumbnails ?? [];
        }
      }

      const enhancedFolders = ((foldersData ?? []).map((f: any) => ({
        ...f,
        subfolder_count: statsMap[f.id]?.subfolder_count ?? 0,
        unit_count: statsMap[f.id]?.unit_count ?? 0,
        total_value: statsMap[f.id]?.total_value ?? 0,
        thumbnails: thumbsMap[f.id] ?? [],
      })) as EnhancedFolder[]).sort((a, b) => {
        if (sortBy === 'quantity') return (b.unit_count || 0) - (a.unit_count || 0);
        if (sortBy === 'value') return (b.total_value || 0) - (a.total_value || 0);
        if (sortBy === 'date') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        return a.name.localeCompare(b.name);
      });

      // Load items in this folder
      let query = supabase
        .from('items')
        .select('*')
        .eq('status', 'active')
        .order(sortBy === 'date' ? 'created_at' : sortBy === 'quantity' ? 'quantity' : sortBy === 'value' ? 'sell_price' : 'name', { ascending: sortBy === 'name' });

      if (!filterLowStock) {
        if (folderId) {
          query = query.eq('folder_id', folderId);
        } else {
          query = query.is('folder_id', null);
        }
      }


      const { data: itemsData } = await query;

      // At root level, fetch global stats across ALL items (not just unfiled)
      if (!folderId) {
        const { data: allItems } = await supabase
          .from('items')
          .select('quantity, sell_price, cost_price')
          .eq('status', 'active');
        const all = (allItems ?? []) as Pick<Item, 'quantity' | 'sell_price' | 'cost_price'>[];
        setGlobalStats({
          totalItems: all.length,
          totalQuantity: all.reduce((acc, i) => acc + (i.quantity || 0), 0),
          totalValue: all.reduce((acc, i) => acc + (i.quantity || 0) * (i.sell_price ?? i.cost_price ?? 0), 0),
        });
      } else {
        setGlobalStats(null);
      }

      setFolders(filterLowStock ? [] : enhancedFolders);
      let filteredItems = (itemsData ?? []) as Item[];
      if (filterLowStock) {
        filteredItems = filteredItems.filter((i) => i.quantity < (i.min_quantity || 3));
      }
      setItems(filteredItems);
    } catch (e) {
      console.error('Inventory load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentFolder, filterLowStock, sortBy]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reload data when screen regains focus (e.g. after adding a folder/item)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

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

  const canDelete = can('delete_item');

  const deleteFolder = (folder: Folder) => {
    Alert.alert(
      'Delete Folder',
      `Delete "${folder.name}" and all items inside it? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('items').update({ status: 'deleted' }).eq('folder_id', folder.id);
            const { data: subfolders } = await supabase.from('folders').select('id').eq('parent_folder_id', folder.id);
            if (subfolders?.length) {
              const subIds = subfolders.map((f: any) => f.id);
              await supabase.from('items').update({ status: 'deleted' }).in('folder_id', subIds);
              await supabase.from('folders').delete().in('id', subIds);
            }
            await supabase.from('folders').delete().eq('id', folder.id);
            await logActivity(user?.id, 'item_deleted', { details: { folder_name: folder.name, type: 'folder' }, teamId });
            impactMedium();
            loadData();
          },
        },
      ]
    );
  };

  const deleteItem = (item: Item) => {
    Alert.alert('Delete Item', `Delete "${item.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('items').update({ status: 'deleted' }).eq('id', item.id);
          await logActivity(user?.id, 'item_deleted', { itemId: item.id, details: { item_name: item.name }, teamId });
          impactMedium();
          loadData();
        },
      },
    ]);
  };

  const totalFolders = folders.length;
  // At root: show global stats across ALL items; inside a folder: show folder-level stats
  const isRoot = !currentFolder;
  const totalItems = isRoot && globalStats ? globalStats.totalItems : items.length;
  const totalQuantity = isRoot && globalStats
    ? globalStats.totalQuantity
    : items.reduce((acc, i) => acc + (i.quantity || 0), 0) + folders.reduce((acc, f) => acc + (f.unit_count || 0), 0);
  const totalValue = isRoot && globalStats
    ? globalStats.totalValue
    : items.reduce((acc, i) => acc + (i.quantity || 0) * (i.sell_price ?? i.cost_price ?? 0), 0) + folders.reduce((acc, f) => acc + (f.total_value || 0), 0);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="px-5 pt-4 pb-1">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-xl font-bold" style={{ fontWeight: '800', color: colors.textPrimary }}>
            Inventory
          </Text>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => router.push('/search' as any)}
              className="rounded-xl p-2.5"
              style={{ backgroundColor: colors.surface }}>
              <Search color={colors.textSecondary} size={18} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowFilter(true)}
              className="rounded-xl p-2.5"
              style={{ backgroundColor: isFilterActive ? colors.accentMuted : colors.surface }}>
              <SlidersHorizontal color={isFilterActive ? colors.accent : colors.textSecondary} size={18} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              activeOpacity={1}
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
        <View className="mb-0 flex-row justify-between rounded-2xl p-4" style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
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

        <View className="mt-3 mb-1" style={{ height: 1, backgroundColor: isDark ? `${colors.borderLight}88` : colors.borderLight }} />

        {/* Folder Navigation Bar */}
        {currentFolder && (
          <View className="mt-2 mb-2 flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => {
                if (breadcrumbs.length > 0) {
                  const parent = breadcrumbs[breadcrumbs.length - 1];
                  setBreadcrumbs(breadcrumbs.slice(0, -1));
                  setCurrentFolder(parent);
                } else {
                  setCurrentFolder(null);
                  setBreadcrumbs([]);
                }
                setLoading(true);
              }}
              className="items-center justify-center rounded-xl"
              style={{ width: 40, height: 40, backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
              <ArrowLeft color={colors.textPrimary} size={20} />
            </TouchableOpacity>

            <View className="flex-1 rounded-xl px-3 py-2" style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
              {breadcrumbs.length > 0 && (
                <View className="flex-row items-center mb-0.5">
                  <TouchableOpacity onPress={() => navigateToBreadcrumb(-1)}>
                    <Text className="text-xs" style={{ color: colors.accent }}>All Items</Text>
                  </TouchableOpacity>
                  {breadcrumbs.map((bc, idx) => (
                    <React.Fragment key={bc.id}>
                      <ChevronRight color={colors.textSecondary} size={10} style={{ marginHorizontal: 2 }} />
                      <TouchableOpacity onPress={() => navigateToBreadcrumb(idx)}>
                        <Text className="text-xs" style={{ color: idx === breadcrumbs.length - 1 ? colors.textSecondary : colors.accent }}>{bc.name}</Text>
                      </TouchableOpacity>
                    </React.Fragment>
                  ))}
                </View>
              )}
              <View className="flex-row items-center">
                <FolderOpen color={colors.accent} size={16} style={{ marginRight: 6 }} />
                <Text className="text-sm font-bold flex-1" numberOfLines={1} style={{ color: colors.textPrimary }}>
                  {currentFolder.name}
                </Text>
              </View>
            </View>
          </View>
        )}

      </View>

      {/* Content */}
      {loading ? (
        <ActivityIndicator color={colors.accent} className="mt-8" />
      ) : (
        <FlatList
          key={viewMode}
          data={(() => {
            const combined = [...folders.map((f) => ({ ...f, _type: 'folder' as const })), ...items.map((i) => ({ ...i, _type: 'item' as const }))];
            if (sortBy === 'name') return combined; // folders first, then items (both already sorted A-Z)
            return combined.sort((a, b) => {
              const getUnits = (x: any) => x._type === 'folder' ? (x.unit_count || 0) : (x.quantity || 0);
              const getValue = (x: any) => x._type === 'folder' ? (x.total_value || 0) : ((x.quantity || 0) * (x.sell_price ?? x.cost_price ?? 0));
              const getDate = (x: any) => new Date(x.created_at).getTime();
              if (sortBy === 'quantity') return getUnits(b) - getUnits(a);
              if (sortBy === 'value') return getValue(b) - getValue(a);
              if (sortBy === 'date') return getDate(b) - getDate(a);
              return 0;
            });
          })()}
          keyExtractor={(item) => item.id}
          numColumns={viewMode === 'grid' ? 2 : 1}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          ListEmptyComponent={
            <EmptyState
              icon={<Package color={colors.textSecondary} size={32} />}
              title="No items here"
              message={currentFolder ? `${currentFolder.name} is empty.` : 'Add your first inventory item to get started.'}
              actionLabel="Add Item"
              onAction={() => router.push(currentFolder ? `/item/add?folder_id=${currentFolder.id}` : '/item/add')}
            />
          }
          renderItem={({ item }) => {
            if ((item as any)._type === 'folder') {
              const openFolderMenu = () => setActionMenu({ type: 'folder', data: item as unknown as Folder });
              if (viewMode === 'grid') {
                return (
                  <GridFolderCard
                    folder={item as EnhancedFolder}
                    onPress={() => navigateToFolder(item as unknown as Folder)}
                    colors={colors}
                    isDark={isDark}
                  />
                );
              }
              return (
                <FolderCard
                  folder={item as EnhancedFolder}
                  onPress={() => navigateToFolder(item as unknown as Folder)}
                  onMore={openFolderMenu}
                  colors={colors}
                  isDark={isDark}
                />
              );
            }
            const openItemMenu = () => setActionMenu({ type: 'item', data: item as Item });
            if (viewMode === 'grid') {
              return <GridItem item={item as Item} onPress={() => router.push(`/item/${item.id}`)} colors={colors} isDark={isDark} />;
            }
            return <ListItem item={item as Item} onPress={() => router.push(`/item/${item.id}`)} onMore={openItemMenu} colors={colors} isDark={isDark} />;
          }}
        />
      )}

      <InventoryFAB
        currentFolderId={currentFolder?.id}
        currentFolderName={currentFolder?.name}
      />

      {/* Filter Modal */}
      <Modal visible={showFilter} transparent animationType="fade" onRequestClose={() => setShowFilter(false)}>
        <Pressable className="flex-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setShowFilter(false)}>
          <Pressable
            className="mx-5 mt-24 rounded-2xl p-5"
            style={{ backgroundColor: colors.surface }}
            onPress={(e) => e.stopPropagation()}>
            <Text className="text-lg font-bold mb-4" style={{ color: colors.textPrimary }}>Filters & Sort</Text>

            {/* Low Stock Filter */}
            <TouchableOpacity
              onPress={() => setFilterLowStock(!filterLowStock)}
              className="flex-row items-center justify-between py-3"
              style={{ borderBottomWidth: 1, borderColor: colors.border }}>
              <View className="flex-row items-center gap-2">
                <Filter color={filterLowStock ? colors.warning : colors.textSecondary} size={16} />
                <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>Low Stock Only</Text>
              </View>
              {filterLowStock && <Check color={colors.accent} size={18} />}
            </TouchableOpacity>

            {/* Sort Options */}
            <Text className="text-xs font-bold mt-4 mb-2" style={{ color: colors.textSecondary }}>SORT BY</Text>
            {(['name', 'date', 'quantity', 'value'] as SortBy[]).map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setSortBy(s)}
                className="flex-row items-center justify-between py-3"
                style={{ borderBottomWidth: 1, borderColor: colors.border }}>
                <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
                {sortBy === s && <Check color={colors.accent} size={18} />}
              </TouchableOpacity>
            ))}

            {/* Reset & Done */}
            <View className="flex-row gap-3 mt-5">
              <TouchableOpacity
                onPress={() => { setFilterLowStock(false); setSortBy('name'); }}
                className="flex-1 items-center py-3 rounded-xl"
                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                <Text className="text-sm font-semibold" style={{ color: colors.textSecondary }}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowFilter(false)}
                className="flex-1 items-center py-3 rounded-xl"
                style={{ backgroundColor: colors.accent }}>
                <Text className="text-sm font-semibold" style={{ color: '#fff' }}>Done</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Action Menu Modal */}
      <Modal visible={!!actionMenu} transparent animationType="fade" onRequestClose={() => setActionMenu(null)}>
        <Pressable className="flex-1 justify-end" style={{ backgroundColor: colors.overlay }} onPress={() => setActionMenu(null)}>
          <Pressable
            className="mx-4 mb-8 rounded-2xl overflow-hidden"
            style={{ backgroundColor: colors.surface }}
            onPress={(e) => e.stopPropagation()}>
            <View className="px-5 py-4 border-b" style={{ borderBottomColor: colors.border }}>
              <Text className="text-base font-bold" style={{ color: colors.textPrimary }} numberOfLines={1}>
                {actionMenu?.type === 'folder' ? (actionMenu.data as Folder).name : (actionMenu?.data as Item)?.name}
              </Text>
              <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
                {actionMenu?.type === 'folder' ? 'Folder' : 'Item'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                const id = actionMenu!.data.id;
                const type = actionMenu!.type;
                setActionMenu(null);
                if (type === 'folder') {
                  router.push(`/folder/edit/${id}`);
                } else {
                  router.push(`/item/edit/${id}`);
                }
              }}
              className="flex-row items-center gap-3 px-5 py-4 border-b"
              style={{ borderBottomColor: colors.border }}>
              <Edit2 color={colors.accent} size={18} />
              <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>Edit</Text>
            </TouchableOpacity>

            {canDelete && (
              <TouchableOpacity
                onPress={() => {
                  const data = actionMenu!.data;
                  const type = actionMenu!.type;
                  setActionMenu(null);
                  if (type === 'folder') {
                    deleteFolder(data as Folder);
                  } else {
                    deleteItem(data as Item);
                  }
                }}
                className="flex-row items-center gap-3 px-5 py-4">
                <Trash2 color={colors.destructive} size={18} />
                <Text className="text-sm font-medium" style={{ color: colors.destructive }}>Delete</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => setActionMenu(null)}
              className="items-center py-4 mt-1 border-t"
              style={{ borderTopColor: colors.border }}>
              <Text className="text-sm font-semibold" style={{ color: colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function FolderCard({ folder, onPress, onMore, colors, isDark }: { folder: EnhancedFolder; onPress: () => void; onMore: () => void; colors: ThemeColors; isDark: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      className="mb-3 flex-row items-center rounded-2xl px-4 py-3 overflow-hidden"
      style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
      {/* Thumbnail / Cover Image */}
      {folder.cover_image ? (
        <View className="mr-4 h-[60px] w-[60px] rounded-xl overflow-hidden" style={{ backgroundColor: colors.accentMuted }}>
          <Image source={{ uri: folder.cover_image }} className="h-full w-full" resizeMode="cover" />
        </View>
      ) : folder.thumbnails?.length ? (
        <View className="mr-4 h-[60px] w-[60px] flex-row flex-wrap rounded-xl overflow-hidden" style={{ backgroundColor: colors.accentMuted }}>
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
      ) : (
        <View className="mr-4 h-[60px] w-[60px] rounded-xl items-center justify-center" style={{ backgroundColor: colors.accentMuted }}>
          <FolderOpen color={colors.accent} size={28} />
        </View>
      )}

      <View className="flex-1">
        <View className="flex-row items-center mb-1">
          <FolderOpen color={colors.accent} size={10} style={{ marginRight: 4 }} />
          <Text style={{ color: colors.accent, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>FOLDER</Text>
        </View>
        <Text className="font-bold text-base leading-tight" numberOfLines={1} style={{ color: colors.textPrimary }}>{folder.name}</Text>
        <View className="mt-1 flex-row items-center">
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
            {folder.subfolder_count || 0} folders  ·  {folder.unit_count || 0} units  ·  {formatCurrency(folder.total_value)}
          </Text>
        </View>
      </View>

      <TouchableOpacity className="p-2" onPress={(e) => { e.stopPropagation(); onMore(); }}>
        <MoreHorizontal color={colors.textSecondary} size={20} />
      </TouchableOpacity>
    </Pressable>
  );
}

function ListItem({ item, onPress, onMore, colors, isDark }: { item: Item; onPress: () => void; onMore: () => void; colors: ThemeColors; isDark: boolean }) {
  const isLowStock = item.quantity <= item.min_quantity;
  return (
    <Pressable
      onPress={onPress}
      className="mb-3 flex-row items-center rounded-2xl px-4 py-3"
      style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
      {item.photos?.[0] ? (
        <Image
          source={{ uri: item.photos[0] }}
          className="mr-4 rounded-xl"
          style={{ width: 60, height: 60, backgroundColor: colors.background }}
          resizeMode="cover"
        />
      ) : (
        <View className="mr-4 h-[60px] w-[60px] rounded-xl items-center justify-center" style={{ backgroundColor: colors.background }}>
          <Package color={colors.textSecondary} size={28} />
        </View>
      )}

      <View className="flex-1">
        <View className="flex-row items-center mb-1">
          <Package color={colors.textSecondary} size={10} style={{ marginRight: 4 }} />
          <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>ITEM</Text>
          {isLowStock && (
            <View className="ml-2 rounded-full px-1.5 py-0.5" style={{ backgroundColor: colors.warningMuted }}>
              <Text style={{ color: colors.warning, fontSize: 9, fontWeight: '700' }}>LOW STOCK</Text>
            </View>
          )}
        </View>
        <Text className="font-bold text-base leading-tight" numberOfLines={1} style={{ color: colors.textPrimary }}>{item.name}</Text>
        <View className="mt-1 flex-row items-center">
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
            {item.quantity} units  ·  {formatCurrency(item.sell_price)}
          </Text>
        </View>
      </View>

      <TouchableOpacity className="p-2" onPress={(e) => { e.stopPropagation(); onMore(); }}>
        <MoreHorizontal color={colors.textSecondary} size={20} />
      </TouchableOpacity>
    </Pressable>
  );
}

function GridFolderCard({ folder, onPress, colors, isDark }: { folder: EnhancedFolder; onPress: () => void; colors: ThemeColors; isDark: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      className="mx-1.5 mb-3 rounded-2xl overflow-hidden"
      style={{ flex: 1, maxWidth: '48%', height: 220, backgroundColor: colors.surface, borderWidth: 1, borderColor: isDark ? colors.borderLight : colors.border, ...getCardShadow(isDark) }}>
      <View
        className="items-center justify-center"
        style={{ height: 125, backgroundColor: colors.accentMuted }}>
        {folder.cover_image ? (
          <Image source={{ uri: folder.cover_image }} style={{ width: '100%', height: 125 }} resizeMode="cover" />
        ) : (
          <FolderOpen color={colors.accent} size={36} />
        )}
      </View>
      <View className="p-3" style={{ flex: 1 }}>
        <View className="flex-row items-center mb-1">
          <FolderOpen color={colors.accent} size={9} style={{ marginRight: 3 }} />
          <Text style={{ color: colors.accent, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 }}>FOLDER</Text>
        </View>
        <Text className="font-semibold text-sm" numberOfLines={1} style={{ color: colors.textPrimary }}>{folder.name}</Text>
        <Text className="mt-0.5 text-xs" style={{ color: colors.textSecondary }}>
          {folder.unit_count || 0} units  ·  {formatCurrency(folder.total_value)}
        </Text>
      </View>
    </Pressable>
  );
}

function GridItem({ item, onPress, colors, isDark }: { item: Item; onPress: () => void; colors: ThemeColors; isDark: boolean }) {
  const photoUrl = item.photos?.[0];
  const isLowStock = item.quantity <= item.min_quantity;
  return (
    <Pressable
      onPress={onPress}
      className="mx-1.5 mb-3 rounded-2xl overflow-hidden"
      style={{ flex: 1, maxWidth: '48%', height: 220, backgroundColor: colors.surface, borderWidth: 1, borderColor: isDark ? colors.borderLight : colors.border, ...getCardShadow(isDark) }}>
      <View
        className="items-center justify-center"
        style={{ height: 125, backgroundColor: colors.background }}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={{ width: '100%', height: 125 }} resizeMode="cover" />
        ) : (
          <Package color={colors.textSecondary} size={36} />
        )}
      </View>
      <View className="p-3" style={{ flex: 1 }}>
        <View className="flex-row items-center mb-1">
          <Package color={colors.textSecondary} size={9} style={{ marginRight: 3 }} />
          <Text style={{ color: colors.textSecondary, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 }}>ITEM</Text>
          {isLowStock && (
            <View className="ml-1.5 rounded-full px-1 py-0.5" style={{ backgroundColor: colors.warningMuted }}>
              <Text style={{ color: colors.warning, fontSize: 8, fontWeight: '700' }}>LOW</Text>
            </View>
          )}
        </View>
        <Text className="font-semibold text-sm" numberOfLines={1} style={{ color: colors.textPrimary }}>{item.name}</Text>
        <View className="mt-0.5 flex-row items-center justify-between">
          <Text className="text-xs" style={{ color: colors.textSecondary }}>
            {item.quantity} units
          </Text>
          {item.sell_price != null && (
            <Text className="text-xs font-medium" style={{ color: colors.textPrimary }}>
              {formatCurrency(item.sell_price)}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}
