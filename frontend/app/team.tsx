import { useAuth } from '@/lib/auth-context';
import { usePermission } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { Profile } from '@/lib/types';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Crown,
  Shield,
  User,
  Users,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TeamScreen() {
  const { user } = useAuth();
  const { can } = usePermission();
  const { colors, isDark } = useTheme();
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cardStyle = {
    backgroundColor: colors.surface,
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? colors.borderLight : 'transparent',
    ...getCardShadow(isDark),
  };

  const loadMembers = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at');
      setMembers((data ?? []) as Profile[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const updateRole = (member: Profile) => {
    if (!can('manage_team')) {
      Alert.alert('Permission Denied', 'You do not have permission to manage team roles.');
      return;
    }
    if (member.id === user?.id) {
      Alert.alert('Cannot Change', 'You cannot change your own role.');
      return;
    }
    if (member.role === 'owner') {
      Alert.alert('Cannot Change', 'The owner role cannot be changed.');
      return;
    }
    // Demoting an admin requires owner role
    if (member.role === 'admin' && !can('demote_admin')) {
      Alert.alert('Permission Denied', 'Only the owner can demote an admin.');
      return;
    }
    const newRole = member.role === 'admin' ? 'member' : 'admin';
    Alert.alert(
      'Change Role',
      `Set ${member.full_name ?? 'this user'} as ${newRole}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            const { error } = await supabase
              .from('profiles')
              .update({ role: newRole })
              .eq('id', member.id);
            if (error) {
              Alert.alert('Error', error.message);
            } else {
              loadMembers();
            }
          },
        },
      ]
    );
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRoleBadge = (role: string, isOwner: boolean) => {
    if (isOwner) return { label: 'Owner', color: colors.accent, bg: colors.accentMuted };
    if (role === 'admin') return { label: 'Admin', color: colors.statusReady, bg: `${colors.statusReady}22` };
    return { label: 'Member', color: colors.textSecondary, bg: `${colors.textSecondary}22` };
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="flex-row items-center px-5 py-3 gap-3">
        <TouchableOpacity onPress={() => router.back()} className="rounded-xl p-2" style={cardStyle}>
          <ArrowLeft color={colors.textPrimary} size={20} />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold" style={{ color: colors.textPrimary }}>
          Team
        </Text>
        <View className="rounded-xl p-2" style={{ backgroundColor: colors.accentMuted }}>
          <Users color={colors.accent} size={20} />
        </View>
      </View>

      <Text className="px-5 text-sm mb-3" style={{ color: colors.textSecondary }}>
        {members.length} team member{members.length !== 1 ? 's' : ''}
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.accent} className="mt-8" />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadMembers(); }} tintColor={colors.accent} />}
          ListEmptyComponent={
            <View className="items-center mt-12">
              <Users color={colors.textSecondary} size={32} />
              <Text className="text-base font-semibold mt-3" style={{ color: colors.textPrimary }}>No team members</Text>
            </View>
          }
          renderItem={({ item: member }) => {
            const isOwner = members.indexOf(member) === 0;
            const badge = getRoleBadge(member.role, isOwner);
            return (
              <TouchableOpacity
                onPress={() => can('manage_team') ? updateRole(member) : undefined}
                activeOpacity={can('manage_team') ? 0.2 : 1}
                className="mb-3 flex-row items-center rounded-2xl px-4 py-3"
                style={cardStyle}>
                <View
                  className="items-center justify-center rounded-2xl mr-3"
                  style={{ width: 48, height: 48, backgroundColor: colors.accentMuted }}>
                  {isOwner ? (
                    <Crown color={colors.accent} size={22} />
                  ) : member.role === 'admin' ? (
                    <Shield color={colors.statusReady} size={22} />
                  ) : (
                    <User color={colors.textSecondary} size={22} />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-sm" style={{ color: colors.textPrimary }}>
                    {member.full_name ?? 'Unknown'}
                  </Text>
                  {member.department && (
                    <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
                      {member.department}
                    </Text>
                  )}
                </View>
                <View
                  className="rounded-full px-2.5 py-1"
                  style={{ backgroundColor: badge.bg }}>
                  <Text className="text-xs font-semibold" style={{ color: badge.color }}>
                    {badge.label}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
