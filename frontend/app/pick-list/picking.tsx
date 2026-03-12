import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useTeam } from '@/lib/team-context';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { ThemeColors } from '@/lib/theme-context';
import type { Item, PickList, PickListItem } from '@/lib/types';
import { logActivity } from '@/lib/utils';
import { impactLight, impactMedium, notificationSuccess, notificationError } from '@/lib/haptics';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  CheckCircle,
  MapPin,
  Package,
  Camera,
  Flashlight,
  FlashlightOff,
  X,
  ClipboardCheck,
  AlertTriangle,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Only import CameraView on native
let CameraView: any = null;
let useCameraPermissions: any = null;
if (Platform.OS !== 'web') {
  try {
    const CameraModule = require('expo-camera');
    CameraView = CameraModule.CameraView;
    useCameraPermissions = CameraModule.useCameraPermissions;
  } catch {
    // Camera not available
  }
}

type PickListItemWithItem = PickListItem & { items: Item | null };

type Phase = 'location' | 'pick' | 'complete';

export default function GuidedPickingScreen() {
  const { pickListId } = useLocalSearchParams<{ pickListId: string }>();
  const { user } = useAuth();
  const { teamId } = useTeam();
  const { colors, isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [pickList, setPickList] = useState<PickList | null>(null);
  const [allItems, setAllItems] = useState<PickListItemWithItem[]>([]);
  const [unpickedItems, setUnpickedItems] = useState<PickListItemWithItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('location');
  const [pickingMode, setPickingMode] = useState<'scan_all' | 'scan_one'>('scan_all');

  // Per-item local pick tracking: maps pli.id -> quantity picked in this session
  const [localPicks, setLocalPicks] = useState<Record<string, number>>({});

  // Camera state
  const [showCamera, setShowCamera] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [scanned, setScanned] = useState(false);
  const lastScannedRef = useRef<string | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load data
  useEffect(() => {
    if (!pickListId) return;
    (async () => {
      const [plRes, itemsRes] = await Promise.all([
        supabase.from('pick_lists').select('*').eq('id', pickListId).single(),
        supabase
          .from('pick_list_items')
          .select('*, items(*)')
          .eq('pick_list_id', pickListId)
          .order('sort_order', { ascending: true }),
      ]);

      if (plRes.data) setPickList(plRes.data as PickList);
      const items = (itemsRes.data ?? []) as unknown as PickListItemWithItem[];
      setAllItems(items);
      const remaining = items.filter((i) => i.quantity_picked < i.quantity_requested);
      setUnpickedItems(remaining);

      // Initialize local picks from DB values
      const picks: Record<string, number> = {};
      for (const item of items) {
        picks[item.id] = item.quantity_picked;
      }
      setLocalPicks(picks);

      // Load picking mode from AsyncStorage
      try {
        const mode = await AsyncStorage.getItem('picking_mode');
        if (mode === 'scan_one') setPickingMode('scan_one');
      } catch {
        // default scan_all
      }

      if (remaining.length === 0) {
        setPhase('complete');
      }
      setLoading(false);
    })();
  }, [pickListId]);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    };
  }, []);

  // When returning from report-issue, check for a reported issue signal via AsyncStorage
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const stored = await AsyncStorage.getItem('reported_issue');
        if (!stored) return;
        await AsyncStorage.removeItem('reported_issue');
        try {
          const { pickListItemId, qty } = JSON.parse(stored);
          setLocalPicks((prev) => ({ ...prev, [pickListItemId]: qty }));
          setTransitioning(true);
          setTimeout(() => advanceToNext(), 300);
        } catch {
          // ignore parse errors
        }
      })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const currentItem = unpickedItems[currentIndex] ?? null;

  // If we've run out of items mid-flow, transition to complete
  useEffect(() => {
    if (!loading && !currentItem && phase !== 'complete') {
      setPhase('complete');
    }
  }, [loading, currentItem, phase]);
  const remainingQty = currentItem
    ? currentItem.quantity_requested - (localPicks[currentItem.id] ?? currentItem.quantity_picked)
    : 0;
  const totalItems = unpickedItems.length;

  // Overall progress across ALL items
  const totalPicked = allItems.reduce((sum, i) => sum + (localPicks[i.id] ?? i.quantity_picked), 0);
  const totalRequested = allItems.reduce((sum, i) => sum + i.quantity_requested, 0);
  const overallPct = totalRequested > 0 ? Math.round((totalPicked / totalRequested) * 100) : 0;

  // Use a transitioning state to avoid flashing the pick screen with 0 remaining
  const [transitioning, setTransitioning] = useState(false);

  const advanceToNext = () => {
    setShowCamera(false);
    setScanned(false);
    lastScannedRef.current = null;
    setTransitioning(false);

    if (currentIndex + 1 < totalItems) {
      setCurrentIndex(currentIndex + 1);
      setPhase('location');
    } else {
      setPhase('complete');
    }
  };

  const markItemFullyPicked = (pliId: string) => {
    const item = unpickedItems.find((i) => i.id === pliId);
    if (!item) return;
    setLocalPicks((prev) => ({ ...prev, [pliId]: item.quantity_requested }));
    setTransitioning(true);
    impactMedium();
    setTimeout(() => advanceToNext(), 300);
  };

  const incrementPick = (pliId: string) => {
    const item = unpickedItems.find((i) => i.id === pliId);
    if (!item) return;
    const current = localPicks[pliId] ?? item.quantity_picked;
    const newQty = Math.min(current + 1, item.quantity_requested);
    setLocalPicks((prev) => ({ ...prev, [pliId]: newQty }));
    impactLight();

    if (newQty >= item.quantity_requested) {
      setTransitioning(true);
      setTimeout(() => advanceToNext(), 300);
    }
  };

  const handleBarcodeScan = ({ data }: { data: string }) => {
    if (scanned || !currentItem) return;
    if (lastScannedRef.current === data) return;
    lastScannedRef.current = data;
    setScanned(true);
    notificationSuccess();

    const itemBarcode = currentItem.items?.barcode;

    // Item has no barcode — cannot verify by scanning
    if (!itemBarcode) {
      notificationError();
      Alert.alert(
        'No Barcode on Item',
        `"${currentItem.items?.name ?? 'This item'}" does not have a barcode assigned. Please use "Verify Manually" instead.`,
        [
          {
            text: 'OK',
            onPress: () => {
              scanTimeoutRef.current = setTimeout(() => {
                setScanned(false);
                lastScannedRef.current = null;
              }, 1500);
            },
          },
        ]
      );
      return;
    }

    // Validate barcode
    if (data !== itemBarcode) {
      notificationError();
      Alert.alert(
        'Wrong Item Scanned',
        `Expected: ${itemBarcode}\nScanned: ${data}`,
        [
          {
            text: 'Try Again',
            onPress: () => {
              scanTimeoutRef.current = setTimeout(() => {
                setScanned(false);
                lastScannedRef.current = null;
              }, 1500);
            },
          },
        ]
      );
      return;
    }

    // Correct barcode (or no barcode set on item)
    if (pickingMode === 'scan_all') {
      markItemFullyPicked(currentItem.id);
    } else {
      incrementPick(currentItem.id);
      // Allow scanning again for scan_one mode
      scanTimeoutRef.current = setTimeout(() => {
        setScanned(false);
        lastScannedRef.current = null;
      }, 1000);
    }
  };

  const commitAllPicks = async () => {
    if (!user || !pickList) return;
    setCommitting(true);
    try {
      for (const item of allItems) {
        const dbQty = item.quantity_picked;
        const localQty = localPicks[item.id] ?? dbQty;
        const delta = localQty - dbQty;
        if (delta <= 0) continue;

        const { data: stockBefore } = await supabase
          .from('items')
          .select('quantity')
          .eq('id', item.item_id!)
          .single();
        const qtyBefore = stockBefore?.quantity ?? 0;

        const { error } = await supabase.rpc('pick_item', {
          p_pick_list_item_id: item.id,
          p_quantity_picked: localQty,
          p_picked_by: user.id,
        });

        if (!error) {
          await supabase.from('transactions').insert({
            item_id: item.item_id,
            transaction_type: 'pick',
            quantity_change: -delta,
            quantity_before: qtyBefore,
            quantity_after: qtyBefore - delta,
            reference_type: 'pick_list',
            reference_id: pickList.id,
            notes: `Picked for: ${pickList.name}`,
            created_by: user.id,
            team_id: teamId ?? null,
          });

          await logActivity(user.id, 'quantity_adjusted', {
            itemId: item.item_id,
            details: {
              item_name: item.items?.name,
              old_qty: qtyBefore,
              new_qty: qtyBefore - delta,
              reason: `Picked for pick list: ${pickList.name}`,
            },
            teamId,
          });
        }
      }

      // Determine final status
      const allFullyPicked = allItems.every(
        (i) => (localPicks[i.id] ?? i.quantity_picked) >= i.quantity_requested
      );
      const newStatus = allFullyPicked ? 'complete' : 'partially_complete';

      await supabase
        .from('pick_lists')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', pickList.id);

      await logActivity(user.id, 'pick_list_updated', {
        pickListId: pickList.id,
        details: { name: pickList.name, status: newStatus },
        teamId,
      });

      if (newStatus === 'complete') {
        await logActivity(user.id, 'pick_list_completed', {
          pickListId: pickList.id,
          details: { name: pickList.name },
          teamId,
        });
      }

      // Notify owners/admins if there are reported issues
      try {
        const { data: issueRows } = await supabase
          .from('pick_list_issues')
          .select('*, pick_list_items(items(name))')
          .eq('pick_list_id', pickList.id);

        if (issueRows && issueRows.length > 0) {
          // Get owner/admin team members + always include the picker
          const recipientSet = new Set<string>([user.id]);
          if (teamId) {
            const { data: members } = await supabase
              .from('team_members')
              .select('user_id')
              .eq('team_id', teamId)
              .in('role', ['owner', 'admin']);
            if (members) {
              for (const m of members) recipientSet.add(m.user_id);
            }
          }
          const recipients = [...recipientSet];

          if (recipients.length > 0) {
            const issueLines = (issueRows as any[]).map((iss) => {
              const itemName = iss.pick_list_items?.items?.name ?? 'Unknown item';
              const typeLabel = (iss.issue_type as string).replace(/_/g, ' ');
              return `• ${itemName}: ${typeLabel} (picked ${iss.quantity_actually_picked}/${iss.quantity_affected + iss.quantity_actually_picked})`;
            });

            const notifications = recipients.map((uid) => ({
              user_id: uid,
              type: 'pick_list_issue',
              title: `Issues reported on "${pickList.name}"`,
              message: issueLines.join('\n'),
              related_pick_list_id: pickList.id,
            }));

            await supabase.from('notifications').insert(notifications);
          }
        }
      } catch {
        // Non-critical — don't block completion if notifications fail
      }

      notificationSuccess();
      router.back();
    } catch (e) {
      Alert.alert('Error', 'Failed to save picks. Please try again.');
    } finally {
      setCommitting(false);
    }
  };

  const handleExit = () => {
    // Check if any picks were made
    const hasChanges = allItems.some(
      (i) => (localPicks[i.id] ?? i.quantity_picked) > i.quantity_picked
    );
    if (hasChanges) {
      Alert.alert(
        'Unsaved Picks',
        'You have picks that haven\'t been saved. Discard and exit?',
        [
          { text: 'Keep Picking', style: 'cancel' },
          { text: 'Discard & Exit', style: 'destructive', onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  if (!pickList) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
        <Text style={{ color: colors.textSecondary }}>Pick list not found.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 px-4 py-2 rounded-xl" style={{ backgroundColor: colors.surface }}>
          <Text style={{ color: colors.accent }}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Phase: Complete ──
  if (phase === 'complete') {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        <View className="flex-1 items-center justify-center px-8">
          <View
            className="items-center justify-center rounded-full mb-6"
            style={{ width: 80, height: 80, backgroundColor: colors.successMuted }}>
            <CheckCircle color={colors.success} size={40} />
          </View>
          <Text className="text-2xl font-bold mb-2 text-center" style={{ color: colors.textPrimary }}>
            Picking Complete
          </Text>
          <Text className="text-sm text-center mb-2" style={{ color: colors.textSecondary }}>
            {overallPct}% of items picked ({totalPicked} / {totalRequested} units)
          </Text>
          <Text className="text-xs text-center mb-8" style={{ color: colors.textTertiary }}>
            Tap below to save all picks and update inventory.
          </Text>

          <TouchableOpacity
            onPress={commitAllPicks}
            disabled={committing}
            className="w-full flex-row items-center justify-center gap-2 rounded-2xl py-4"
            style={{ backgroundColor: colors.accent, ...getCardShadow(isDark) }}>
            {committing ? (
              <ActivityIndicator color={colors.accentOnAccent} />
            ) : (
              <>
                <CheckCircle size={20} color={colors.accentOnAccent} />
                <Text className="text-base font-bold" style={{ color: colors.accentOnAccent }}>
                  Save & Complete
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleExit}
            disabled={committing}
            className="mt-4 py-3">
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentItem) {
    // All items processed — effect above will transition to complete
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  const location = currentItem?.location_hint ?? currentItem?.items?.location ?? null;
  const itemPhoto = currentItem?.items?.photos?.[0] ?? null;

  // ── Phase: Location ──
  if (phase === 'location') {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        {/* Header */}
        <View className="px-5 py-3 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={handleExit}
            className="rounded-xl p-2"
            style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
            <ArrowLeft color={colors.textPrimary} size={20} />
          </TouchableOpacity>
          <Text className="text-sm font-semibold" style={{ color: colors.textSecondary }}>
            Item {currentIndex + 1} of {totalItems}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Progress bar */}
        <View className="mx-5 mb-4">
          <View className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: colors.surface }}>
            <View
              className="h-1.5 rounded-full"
              style={{ width: `${overallPct}%`, backgroundColor: colors.accent }}
            />
          </View>
        </View>

        {/* Location content */}
        <View className="flex-1 items-center justify-center px-8">
          <View
            className="items-center justify-center rounded-full mb-6"
            style={{ width: 80, height: 80, backgroundColor: colors.accentMuted }}>
            <MapPin color={colors.accent} size={36} />
          </View>

          <Text className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: colors.textSecondary }}>
            Go to Location
          </Text>

          <Text className="text-3xl font-bold text-center mb-4" style={{ color: colors.textPrimary }}>
            {location ?? 'No Location Set'}
          </Text>

          <Text className="text-base text-center" style={{ color: colors.textSecondary }}>
            {currentItem.items?.name ?? 'Unknown Item'}
          </Text>

          {currentItem.items?.sku && (
            <Text className="text-xs mt-1" style={{ color: colors.textTertiary }}>
              SKU: {currentItem.items.sku}
            </Text>
          )}
        </View>

        {/* Bottom button */}
        <View className="px-5 pb-8">
          <TouchableOpacity
            onPress={() => setPhase('pick')}
            className="flex-row items-center justify-center gap-2 rounded-2xl py-4"
            style={{ backgroundColor: colors.accent, ...getCardShadow(isDark) }}>
            <MapPin size={18} color={colors.accentOnAccent} />
            <Text className="text-base font-bold" style={{ color: colors.accentOnAccent }}>
              I'm at the Location
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Phase: Pick ──
  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="px-5 py-3 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => { setShowCamera(false); setPhase('location'); }}
          className="rounded-xl p-2"
          style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
          <ArrowLeft color={colors.textPrimary} size={20} />
        </TouchableOpacity>
        <Text className="text-sm font-semibold" style={{ color: colors.textSecondary }}>
          Item {currentIndex + 1} of {totalItems}
        </Text>
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => {
              if (!currentItem) return;
              router.push(
                `/pick-list/report-issue?pickListId=${pickListId}&pickListItemId=${currentItem.id}&itemName=${encodeURIComponent(currentItem.items?.name ?? 'Unknown Item')}&quantityRequested=${remainingQty}&alreadyPicked=${localPicks[currentItem.id] ?? currentItem.quantity_picked}`
              );
            }}
            className="rounded-xl p-2"
            style={{ backgroundColor: colors.warningMuted }}>
            <AlertTriangle color={colors.warning} size={18} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleExit}
            className="rounded-xl p-2"
            style={{ backgroundColor: colors.surface }}>
            <X color={colors.textPrimary} size={18} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Progress bar */}
      <View className="mx-5 mb-4">
        <View className="flex-row justify-between mb-1.5">
          <Text className="text-xs" style={{ color: colors.textSecondary }}>
            {totalPicked} / {totalRequested} units picked
          </Text>
          <Text className="text-xs font-semibold" style={{ color: overallPct === 100 ? colors.success : colors.accent }}>
            {overallPct}%
          </Text>
        </View>
        <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.surface }}>
          <View
            className="h-2 rounded-full"
            style={{ width: `${overallPct}%`, backgroundColor: overallPct === 100 ? colors.success : colors.accent }}
          />
        </View>
      </View>

      {/* Item details card */}
      <View
        className="mx-5 mb-6 rounded-2xl p-5"
        style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: isDark ? colors.border : colors.borderLight, ...getCardShadow(isDark) }}>
        {/* Item image — full width */}
        {itemPhoto ? (
          <Image
            source={{ uri: itemPhoto }}
            style={{ width: '100%', height: 200, borderRadius: 14, backgroundColor: colors.background, marginBottom: 14 }}
            resizeMode="contain"
          />
        ) : (
          <View
            className="items-center justify-center rounded-xl mb-3"
            style={{ width: '100%', height: 140, backgroundColor: colors.background }}>
            <Package color={colors.textSecondary} size={44} />
          </View>
        )}
        <View className="flex-row justify-between items-start">
          <View className="flex-1 mr-3">
            <Text className="text-xl font-bold" numberOfLines={2} style={{ color: colors.textPrimary }}>
              {currentItem.items?.name ?? 'Unknown Item'}
            </Text>
            {currentItem.items?.sku && (
              <Text className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                SKU: {currentItem.items.sku}
              </Text>
            )}
            {location && (
              <Text className="text-sm mt-1" style={{ color: colors.accent }}>
                {'\uD83D\uDCCD'} {location}
              </Text>
            )}
          </View>
          <View className="items-end">
            <Text className="text-3xl font-bold" style={{ color: colors.textPrimary }}>
              {remainingQty}
            </Text>
            <Text className="text-xs" style={{ color: colors.textSecondary }}>
              to pick
            </Text>
          </View>
        </View>
      </View>

      {/* Camera / Scan area */}
      <View className="mx-5 mb-4">
        {showCamera && CameraView ? (
          <CameraComponent
            flashOn={flashOn}
            scanned={scanned}
            onToggleFlash={() => setFlashOn((f) => !f)}
            onBarcodeScanned={handleBarcodeScan}
            onClose={() => { setShowCamera(false); setScanned(false); lastScannedRef.current = null; }}
            colors={colors}
          />
        ) : (
          <View className="items-center justify-center py-6">
            {Platform.OS !== 'web' && CameraView ? (
              <TouchableOpacity
                onPress={() => { setShowCamera(true); setScanned(false); lastScannedRef.current = null; }}
                className="items-center justify-center rounded-2xl p-8"
                style={{ backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.accent, borderStyle: 'dashed' }}>
                <Camera color={colors.accent} size={48} />
                <Text className="text-base font-bold mt-4" style={{ color: colors.accent }}>
                  Tap to Scan Barcode
                </Text>
                <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                  Mode: {pickingMode === 'scan_all' ? 'Scan once to pick all' : 'Scan once per unit'}
                </Text>
              </TouchableOpacity>
            ) : (
              <View className="items-center">
                <Camera color={colors.textSecondary} size={32} />
                <Text className="text-sm mt-2" style={{ color: colors.textSecondary }}>
                  Camera scanning unavailable
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Spacer to push verify button down */}
      <View className="flex-1" />

      {/* Bottom: Verify Manually button */}
      <View className="px-5 pb-8">
        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              'Verify Manually',
              `Mark "${currentItem.items?.name}" as fully picked without scanning?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Pick All',
                  onPress: () => markItemFullyPicked(currentItem.id),
                },
              ]
            );
          }}
          className="flex-row items-center justify-center gap-2 rounded-2xl py-3.5"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...getCardShadow(isDark) }}>
          <ClipboardCheck size={18} color={colors.accent} />
          <Text className="text-sm font-bold" style={{ color: colors.textPrimary }}>
            Verify Manually
          </Text>
        </TouchableOpacity>
      </View>

      {/* Transitioning overlay — prevents flash of stale pick screen */}
      {transitioning && (
        <View
          className="absolute inset-0 items-center justify-center"
          style={{ backgroundColor: colors.background }}>
          <CheckCircle color={colors.success} size={48} />
          <Text className="text-base font-semibold mt-3" style={{ color: colors.textPrimary }}>
            Item Picked
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// Inline camera component
function CameraComponent({
  flashOn,
  scanned,
  onToggleFlash,
  onBarcodeScanned,
  onClose,
  colors,
}: {
  flashOn: boolean;
  scanned: boolean;
  onToggleFlash: () => void;
  onBarcodeScanned: (result: { data: string; type: string }) => void;
  onClose: () => void;
  colors: ThemeColors;
}) {
  // Need to call the hook at component level
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, []);

  if (!permission?.granted) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-sm mb-3" style={{ color: colors.textSecondary }}>
          Camera permission required
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          className="rounded-xl px-6 py-3"
          style={{ backgroundColor: colors.accent }}>
          <Text className="font-bold" style={{ color: '#fff' }}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="items-center">
      {/* Controls row */}
      <View className="flex-row items-center justify-between w-full px-2 mb-2">
        <TouchableOpacity
          onPress={onClose}
          className="rounded-full p-2"
          style={{ backgroundColor: colors.surface }}>
          <X color={colors.textPrimary} size={18} />
        </TouchableOpacity>
        <Text className="text-xs font-medium" style={{ color: colors.textSecondary }}>
          Point camera at barcode
        </Text>
        <TouchableOpacity
          onPress={onToggleFlash}
          className="rounded-full p-2"
          style={{ backgroundColor: colors.surface }}>
          {flashOn ? <FlashlightOff color={colors.textPrimary} size={18} /> : <Flashlight color={colors.textPrimary} size={18} />}
        </TouchableOpacity>
      </View>

      {/* Compact camera viewfinder */}
      <View className="rounded-2xl overflow-hidden" style={{ width: 260, height: 180, backgroundColor: '#000' }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          enableTorch={flashOn}
          onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'upc_a', 'upc_e', 'datamatrix'],
          }}>
          {/* Corner markers */}
          <View className="flex-1 items-center justify-center">
            <View style={{ width: 220, height: 140 }}>
              {[
                { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
                { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
                { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
                { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
              ].map((style, i) => (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    width: 25,
                    height: 25,
                    borderColor: colors.accent,
                    ...style,
                  } as any}
                />
              ))}
              {!scanned && (
                <View
                  className="mx-2"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: 0,
                    right: 0,
                    height: 2,
                    backgroundColor: colors.accent,
                    opacity: 0.8,
                  }}
                />
              )}
            </View>
          </View>
        </CameraView>
      </View>
    </View>
  );
}
