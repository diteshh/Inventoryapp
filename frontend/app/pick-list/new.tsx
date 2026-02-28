import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/lib/theme';
import { logActivity } from '@/lib/utils';
import { router } from 'expo-router';
import { notificationSuccess } from '@/lib/haptics';
import { ArrowLeft, Plus, Save, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NewPickListScreen() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a name for the pick list.');
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from('pick_lists')
      .insert({
        name: name.trim(),
        notes: notes.trim() || null,
        status: 'draft',
        created_by: user?.id,
      })
      .select()
      .single();

    if (!error && data) {
      await logActivity(user?.id, 'pick_list_created', {
        pickListId: data.id,
        details: { name: data.name },
      });
        notificationSuccess();
      router.replace(`/pick-list/${data.id}`);
    } else {
      Alert.alert('Error', 'Failed to create pick list.');
    }
    setSaving(false);
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.navy }}>
      <View className="flex-row items-center justify-between px-5 py-3">
        <TouchableOpacity onPress={() => router.back()} className="rounded-xl p-2" style={{ backgroundColor: COLORS.navyCard }}>
          <ArrowLeft color={COLORS.textPrimary} size={20} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-white">New Pick List</Text>
        <TouchableOpacity
          onPress={create}
          disabled={saving}
          className="flex-row items-center gap-1.5 rounded-xl px-3 py-2.5"
          style={{ backgroundColor: COLORS.teal }}>
          {saving ? (
            <ActivityIndicator color={COLORS.navy} size="small" />
          ) : (
            <>
              <Save color={COLORS.navy} size={16} />
              <Text className="font-bold text-sm" style={{ color: COLORS.navy }}>Create</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView className="flex-1 px-5 pt-4" keyboardShouldPersistTaps="handled">
          <View className="mb-4 rounded-2xl p-4 gap-4" style={{ backgroundColor: COLORS.navyCard }}>
            <View>
              <Text className="mb-1.5 text-xs font-medium" style={{ color: COLORS.textSecondary }}>
                Pick List Name *
              </Text>
              <TextInput
                className="rounded-xl px-4 py-3.5 text-sm text-white"
                style={{ backgroundColor: COLORS.navy, borderWidth: 1, borderColor: COLORS.border }}
                placeholder="e.g. Morning Dispatch — 20 Feb"
                placeholderTextColor={COLORS.textSecondary}
                value={name}
                onChangeText={setName}
                autoFocus
              />
            </View>
            <View>
              <Text className="mb-1.5 text-xs font-medium" style={{ color: COLORS.textSecondary }}>
                Notes
              </Text>
              <TextInput
                className="rounded-xl px-4 py-3.5 text-sm text-white"
                style={{ backgroundColor: COLORS.navy, borderWidth: 1, borderColor: COLORS.border, minHeight: 80, textAlignVertical: 'top' }}
                placeholder="Optional instructions or notes..."
                placeholderTextColor={COLORS.textSecondary}
                value={notes}
                onChangeText={setNotes}
                multiline
              />
            </View>
          </View>
          <Text className="text-xs text-center" style={{ color: COLORS.textSecondary }}>
            After creating the pick list, you can add items and assign it to a team member.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
