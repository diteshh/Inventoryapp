import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useTeam } from '@/lib/team-context';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { PickListIssueType } from '@/lib/types';
import { logActivity } from '@/lib/utils';
import { notificationSuccess, notificationError, impactLight } from '@/lib/haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import {
  AlertTriangle,
  ArrowLeft,
  Package,
  Search,
  Barcode,
  HelpCircle,
  Send,
  Minus,
  Plus,
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ISSUE_TYPES: { type: PickListIssueType; label: string; description: string; icon: any }[] = [
  { type: 'damaged_stock', label: 'Damaged Stock', description: 'Items are damaged or broken', icon: AlertTriangle },
  { type: 'missing_unit', label: 'Missing Unit', description: 'Fewer units available than expected', icon: Search },
  { type: 'wrong_stock_at_location', label: 'Wrong Stock at Location', description: 'Different item found at this location', icon: Package },
  { type: 'barcode_mismatch', label: 'Barcode Mismatch', description: 'Barcode does not match the item record', icon: Barcode },
  { type: 'other', label: 'Other', description: 'Another issue not listed above', icon: HelpCircle },
];

export default function ReportIssueScreen() {
  const { pickListId, pickListItemId, itemName, quantityRequested, alreadyPicked } = useLocalSearchParams<{
    pickListId: string;
    pickListItemId: string;
    itemName: string;
    quantityRequested: string;
    alreadyPicked: string;
  }>();
  const { user } = useAuth();
  const { teamId } = useTeam();
  const { colors, isDark } = useTheme();

  const maxQty = parseInt(quantityRequested ?? '0', 10);
  const alreadyPickedQty = parseInt(alreadyPicked ?? '0', 10);
  const [selectedType, setSelectedType] = useState<PickListIssueType | null>(null);
  const [actuallyPicked, setActuallyPicked] = useState(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedType) {
      Alert.alert('Select Issue Type', 'Please select the type of issue before submitting.');
      return;
    }
    if (!pickListId || !pickListItemId || !user) return;

    setSubmitting(true);
    try {
      const quantityAffected = maxQty - actuallyPicked;

      const { error } = await supabase.from('pick_list_issues').insert({
        pick_list_id: pickListId,
        pick_list_item_id: pickListItemId,
        issue_type: selectedType,
        quantity_affected: quantityAffected,
        quantity_actually_picked: actuallyPicked,
        notes: notes.trim() || null,
        reported_by: user.id,
        team_id: teamId ?? null,
      });

      if (error) throw error;

      await logActivity(user.id, 'pick_list_updated', {
        pickListId,
        details: {
          action: 'issue_reported',
          issue_type: selectedType,
          item_name: itemName,
          quantity_affected: quantityAffected,
          quantity_actually_picked: actuallyPicked,
        },
        teamId,
      });

      // Signal picking screen to advance to next item (total = already picked + newly picked)
      await AsyncStorage.setItem('reported_issue', JSON.stringify({
        pickListItemId,
        qty: alreadyPickedQty + actuallyPicked,
      }));

      notificationSuccess();
      router.back();
    } catch (e) {
      notificationError();
      Alert.alert('Error', 'Failed to report issue. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View className="px-5 py-3 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.back()}
            className="rounded-xl p-2"
            style={{ backgroundColor: colors.surface, borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.borderLight : 'transparent', ...getCardShadow(isDark) }}>
            <ArrowLeft color={colors.textPrimary} size={20} />
          </TouchableOpacity>
          <Text className="text-base font-bold" style={{ color: colors.textPrimary }}>
            Report Issue
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          {/* Item context card */}
          <View
            className="mb-6 rounded-2xl p-4"
            style={{ backgroundColor: colors.warningMuted, borderWidth: 1, borderColor: `${colors.warning}33` }}>
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={16} color={colors.warning} />
              <Text className="text-sm font-bold flex-1" numberOfLines={1} style={{ color: colors.textPrimary }}>
                {decodeURIComponent(itemName ?? 'Unknown Item')}
              </Text>
            </View>
            <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
              Requested quantity: {maxQty}
            </Text>
          </View>

          {/* Issue type selector */}
          <Text className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: colors.textSecondary }}>
            What's the issue?
          </Text>
          {ISSUE_TYPES.map(({ type, label, description, icon: Icon }) => {
            const isSelected = selectedType === type;
            return (
              <Pressable
                key={type}
                onPress={() => { setSelectedType(type); impactLight(); }}
                className="mb-2 rounded-2xl p-4 flex-row items-center gap-3"
                style={{
                  backgroundColor: isSelected ? colors.warningMuted : colors.surface,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? colors.warning : isDark ? colors.borderLight : colors.border,
                }}>
                <View
                  className="items-center justify-center rounded-xl"
                  style={{ width: 40, height: 40, backgroundColor: isSelected ? `${colors.warning}22` : colors.background }}>
                  <Icon size={20} color={isSelected ? colors.warning : colors.textSecondary} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold" style={{ color: colors.textPrimary }}>{label}</Text>
                  <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>{description}</Text>
                </View>
              </Pressable>
            );
          })}

          {/* Quantity picker */}
          <Text className="text-xs font-semibold uppercase tracking-widest mt-6 mb-3" style={{ color: colors.textSecondary }}>
            How many did you actually pick?
          </Text>
          <View
            className="rounded-2xl p-4 flex-row items-center justify-between"
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: isDark ? colors.borderLight : colors.border }}>
            <Pressable
              onPress={() => { if (actuallyPicked > 0) { setActuallyPicked(actuallyPicked - 1); impactLight(); } }}
              className="items-center justify-center rounded-xl"
              style={{ width: 44, height: 44, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, opacity: actuallyPicked <= 0 ? 0.4 : 1 }}>
              <Minus size={20} color={colors.textPrimary} />
            </Pressable>
            <View className="items-center">
              <Text className="text-3xl font-bold" style={{ color: colors.textPrimary }}>
                {actuallyPicked}
              </Text>
              <Text className="text-xs" style={{ color: colors.textSecondary }}>
                of {maxQty} requested
              </Text>
            </View>
            <Pressable
              onPress={() => { if (actuallyPicked < maxQty) { setActuallyPicked(actuallyPicked + 1); impactLight(); } }}
              className="items-center justify-center rounded-xl"
              style={{ width: 44, height: 44, backgroundColor: colors.accent, opacity: actuallyPicked >= maxQty ? 0.4 : 1 }}>
              <Plus size={20} color={colors.accentOnAccent} />
            </Pressable>
          </View>

          {/* Notes */}
          <Text className="text-xs font-semibold uppercase tracking-widest mt-6 mb-3" style={{ color: colors.textSecondary }}>
            Additional notes (optional)
          </Text>
          <TextInput
            className="rounded-2xl p-4 text-sm"
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: isDark ? colors.borderLight : colors.border,
              color: colors.textPrimary,
              minHeight: 100,
              textAlignVertical: 'top',
            }}
            placeholder="Describe the issue in more detail..."
            placeholderTextColor={colors.textSecondary}
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={500}
          />
        </ScrollView>

        {/* Submit button */}
        <View className="px-5 pb-8 pt-3">
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting || !selectedType}
            className="flex-row items-center justify-center gap-2 rounded-2xl py-4"
            style={{
              backgroundColor: selectedType ? colors.warning : colors.surface,
              opacity: selectedType ? 1 : 0.5,
              ...getCardShadow(isDark),
            }}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Send size={18} color={selectedType ? '#fff' : colors.textSecondary} />
                <Text className="text-base font-bold" style={{ color: selectedType ? '#fff' : colors.textSecondary }}>
                  Submit Report
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
