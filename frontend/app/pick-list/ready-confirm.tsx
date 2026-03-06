import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useTeam } from '@/lib/team-context';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { Profile } from '@/lib/types';
import { logActivity } from '@/lib/utils';
import { notificationSuccess } from '@/lib/haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Check, Crown, Shield, User, Users } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface TeamMemberWithProfile {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  profiles: Profile;
}

export default function ReadyConfirmScreen() {
  const { pickListId } = useLocalSearchParams<{ pickListId: string }>();
  const { user } = useAuth();
  const { teamId } = useTeam();
  const { colors, isDark } = useTheme();
  const [members, setMembers] = useState<TeamMemberWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null); // null = everyone

  const cardStyle = {
    backgroundColor: colors.surface,
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? colors.borderLight : 'transparent',
    ...getCardShadow(isDark),
  };

  const loadMembers = useCallback(async () => {
    if (!teamId) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await supabase
        .from('team_members')
        .select('id, user_id, role, joined_at, profiles(*)')
        .eq('team_id', teamId)
        .order('joined_at');
      setMembers((data ?? []) as unknown as TeamMemberWithProfile[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleMarkReady = async () => {
    if (!pickListId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('pick_lists')
        .update({
          status: 'ready_to_pick',
          assigned_to: selectedUserId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pickListId);

      if (error) throw error;

      // Fetch pick list name for activity log
      const { data: pl } = await supabase
        .from('pick_lists')
        .select('name')
        .eq('id', pickListId)
        .single();

      await logActivity(user?.id, 'pick_list_updated', {
        pickListId,
        details: { name: pl?.name, status: 'ready_to_pick', assigned_to: selectedUserId },
        teamId,
      });

      notificationSuccess();
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to update pick list.');
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleIcon = (role: string) => {
    if (role === 'owner') return <Crown color={colors.accent} size={20} />;
    if (role === 'admin') return <Shield color={colors.statusReady} size={20} />;
    return <User color={colors.textSecondary} size={20} />;
  };

  const getRoleBadge = (role: string) => {
    if (role === 'owner') return { label: 'Owner', color: colors.accent, bg: colors.accentMuted };
    if (role === 'admin') return { label: 'Admin', color: colors.statusReady, bg: `${colors.statusReady}22` };
    return { label: 'Member', color: colors.textSecondary, bg: `${colors.textSecondary}22` };
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="flex-row items-center px-5 py-3 gap-3">
        <TouchableOpacity onPress={() => router.back()} className="rounded-xl p-2" style={cardStyle}>
          <ArrowLeft color={colors.textPrimary} size={20} />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold" style={{ color: colors.textPrimary }}>
          Mark as Ready
        </Text>
      </View>

      {/* Assign To Section */}
      <View className="px-5 mb-3">
        <Text className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: colors.textSecondary }}>
          Assign To
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} className="mt-8" />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          ListHeaderComponent={
            <TouchableOpacity
              onPress={() => setSelectedUserId(null)}
              activeOpacity={0.6}
              className="mb-3 flex-row items-center rounded-2xl px-4 py-3"
              style={{
                ...cardStyle,
                borderColor: selectedUserId === null ? colors.accent : (isDark ? colors.borderLight : 'transparent'),
                borderWidth: selectedUserId === null ? 2 : (isDark ? 1 : 0),
              }}>
              <View
                className="items-center justify-center rounded-2xl mr-3"
                style={{ width: 48, height: 48, backgroundColor: colors.accentMuted }}>
                <Users color={colors.accent} size={22} />
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-sm" style={{ color: colors.textPrimary }}>
                  Everyone
                </Text>
                <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
                  Any team member can pick
                </Text>
              </View>
              {selectedUserId === null && (
                <View className="rounded-full p-1" style={{ backgroundColor: colors.accent }}>
                  <Check color={colors.accentOnAccent} size={14} />
                </View>
              )}
            </TouchableOpacity>
          }
          ListEmptyComponent={
            !teamId ? (
              <View className="items-center mt-4">
                <Text className="text-sm" style={{ color: colors.textSecondary }}>
                  No team — pick list will be assigned to everyone.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item: member }) => {
            const badge = getRoleBadge(member.role);
            const profile = member.profiles;
            const isSelected = selectedUserId === member.user_id;
            return (
              <TouchableOpacity
                onPress={() => setSelectedUserId(member.user_id)}
                activeOpacity={0.6}
                className="mb-3 flex-row items-center rounded-2xl px-4 py-3"
                style={{
                  ...cardStyle,
                  borderColor: isSelected ? colors.accent : (isDark ? colors.borderLight : 'transparent'),
                  borderWidth: isSelected ? 2 : (isDark ? 1 : 0),
                }}>
                <View
                  className="items-center justify-center rounded-2xl mr-3"
                  style={{ width: 48, height: 48, backgroundColor: colors.accentMuted }}>
                  {getRoleIcon(member.role)}
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-sm" style={{ color: colors.textPrimary }}>
                    {profile?.full_name ?? 'Unknown'}
                  </Text>
                  <View className="flex-row items-center gap-2 mt-0.5">
                    <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: badge.bg }}>
                      <Text className="text-[10px] font-semibold" style={{ color: badge.color }}>
                        {badge.label}
                      </Text>
                    </View>
                  </View>
                </View>
                {isSelected && (
                  <View className="rounded-full p-1" style={{ backgroundColor: colors.accent }}>
                    <Check color={colors.accentOnAccent} size={14} />
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Bottom button */}
      <View className="px-5 pb-3 pt-2" style={{ backgroundColor: colors.background }}>
        <TouchableOpacity
          onPress={handleMarkReady}
          disabled={submitting}
          className="rounded-2xl py-3.5 items-center"
          style={{ backgroundColor: colors.statusReady }}>
          {submitting ? (
            <ActivityIndicator color={colors.accentOnAccent} />
          ) : (
            <Text className="font-bold text-base" style={{ color: colors.accentOnAccent }}>
              Assign
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
