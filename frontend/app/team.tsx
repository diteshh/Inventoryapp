import { useAuth } from '@/lib/auth-context';
import { usePermission } from '@/lib/permissions';
import { useTeam } from '@/lib/team-context';
import { supabase } from '@/lib/supabase';
import { useTheme, getCardShadow } from '@/lib/theme-context';
import type { Profile } from '@/lib/types';
import { router, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  Copy,
  Crown,
  Shield,
  User,
  UserPlus,
  Users,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface TeamMemberWithProfile {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  profiles: Profile;
}

export default function TeamScreen() {
  const { user } = useAuth();
  const { activeTeam, teamId, teams, createTeam, joinTeam, generateInviteCode, refreshTeams } = useTeam();
  const { colors, isDark } = useTheme();

  // If no active team, show create/join UI
  if (!activeTeam) {
    return <NoTeamView colors={colors} isDark={isDark} />;
  }

  return <TeamMembersView colors={colors} isDark={isDark} />;
}

// ─── No Team View ────────────────────────────────────────────────

function NoTeamView({ colors, isDark }: { colors: any; isDark: boolean }) {
  const { createTeam, joinTeam, refreshTeams } = useTeam();
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [teamName, setTeamName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  const cardStyle = {
    backgroundColor: colors.surface,
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? colors.borderLight : 'transparent',
    ...getCardShadow(isDark),
  };

  const handleCreate = async () => {
    if (!teamName.trim()) {
      Alert.alert('Error', 'Please enter a team name.');
      return;
    }
    setLoading(true);
    try {
      await createTeam(teamName.trim());
      await refreshTeams();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to create team');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code.');
      return;
    }
    setLoading(true);
    try {
      await joinTeam(inviteCode.trim().toUpperCase());
      await refreshTeams();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to join team');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
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

      {mode === 'choose' ? (
        <View className="flex-1 justify-center px-6">
          <Text className="text-xl font-bold text-center mb-2" style={{ color: colors.textPrimary }}>
            Get Started with a Team
          </Text>
          <Text className="text-sm text-center mb-8" style={{ color: colors.textSecondary }}>
            Create a new team or join an existing one to share inventory with your organization.
          </Text>

          <TouchableOpacity
            onPress={() => setMode('create')}
            className="flex-row items-center rounded-2xl px-5 py-4 mb-4"
            style={cardStyle}>
            <View
              className="items-center justify-center rounded-xl mr-4"
              style={{ width: 48, height: 48, backgroundColor: colors.accentMuted }}>
              <Users color={colors.accent} size={24} />
            </View>
            <View className="flex-1">
              <Text className="font-bold text-base" style={{ color: colors.textPrimary }}>
                Create a Team
              </Text>
              <Text className="text-sm mt-0.5" style={{ color: colors.textSecondary }}>
                Start a new workspace for your organization
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setMode('join')}
            className="flex-row items-center rounded-2xl px-5 py-4"
            style={cardStyle}>
            <View
              className="items-center justify-center rounded-xl mr-4"
              style={{ width: 48, height: 48, backgroundColor: `${colors.statusReady}22` }}>
              <UserPlus color={colors.statusReady} size={24} />
            </View>
            <View className="flex-1">
              <Text className="font-bold text-base" style={{ color: colors.textPrimary }}>
                Join a Team
              </Text>
              <Text className="text-sm mt-0.5" style={{ color: colors.textSecondary }}>
                Enter an invite code from your team admin
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 justify-center px-6">
          <Text className="text-xl font-bold text-center mb-2" style={{ color: colors.textPrimary }}>
            {mode === 'create' ? 'Create Your Team' : 'Join a Team'}
          </Text>
          <Text className="text-sm text-center mb-8" style={{ color: colors.textSecondary }}>
            {mode === 'create'
              ? 'Give your team a name. You can change it later.'
              : 'Enter the invite code shared by your team admin.'}
          </Text>

          <TextInput
            value={mode === 'create' ? teamName : inviteCode}
            onChangeText={mode === 'create' ? setTeamName : setInviteCode}
            placeholder={mode === 'create' ? 'Team name' : 'Invite code (e.g. ABC123)'}
            placeholderTextColor={colors.textTertiary}
            autoCapitalize={mode === 'join' ? 'characters' : 'words'}
            autoFocus
            className="rounded-xl px-4 py-3.5 text-base mb-6"
            style={{
              backgroundColor: colors.surface,
              color: colors.textPrimary,
              borderWidth: 1,
              borderColor: colors.borderLight,
            }}
          />

          <TouchableOpacity
            onPress={mode === 'create' ? handleCreate : handleJoin}
            disabled={loading}
            className="rounded-xl py-3.5 items-center mb-4"
            style={{ backgroundColor: colors.accent }}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-base">
                {mode === 'create' ? 'Create Team' : 'Join Team'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setMode('choose')} className="items-center py-2">
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              Back
            </Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

// ─── Team Members View ───────────────────────────────────────────

function TeamMembersView({ colors, isDark }: { colors: any; isDark: boolean }) {
  const { user } = useAuth();
  const { can } = usePermission();
  const { activeTeam, teamId, generateInviteCode } = useTeam();
  const [members, setMembers] = useState<TeamMemberWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  const cardStyle = {
    backgroundColor: colors.surface,
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? colors.borderLight : 'transparent',
    ...getCardShadow(isDark),
  };

  const loadMembers = useCallback(async () => {
    if (!teamId) return;
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
      setRefreshing(false);
    }
  }, [teamId]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  useFocusEffect(
    useCallback(() => {
      loadMembers();
    }, [loadMembers])
  );

  const toggleRoleDropdown = (member: TeamMemberWithProfile) => {
    if (!can('manage_team')) {
      Alert.alert('Permission Denied', 'You do not have permission to manage team roles.');
      return;
    }
    if (member.user_id === user?.id) {
      Alert.alert('Cannot Change', 'You cannot change your own role.');
      return;
    }
    if (member.role === 'owner') {
      Alert.alert('Cannot Change', 'The owner role cannot be changed.');
      return;
    }
    setExpandedMemberId(expandedMemberId === member.id ? null : member.id);
  };

  const applyRole = async (member: TeamMemberWithProfile, newRole: 'admin' | 'member') => {
    if (newRole === member.role) {
      setExpandedMemberId(null);
      return;
    }
    const { error } = await supabase
      .from('team_members')
      .update({ role: newRole } as any)
      .eq('id', member.id);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setExpandedMemberId(null);
      loadMembers();
    }
  };

  const handleGenerateInvite = async () => {
    setGeneratingCode(true);
    try {
      const code = await generateInviteCode();
      Alert.alert(
        'Invite Code Generated',
        `Code: ${code}\n\nShare this with your team member. It expires in 7 days.`,
        [
          { text: 'OK' },
          {
            text: 'Share',
            onPress: () => Share.share({ message: `Join my team on Imperial Inventory! Use invite code: ${code}` }),
          },
        ]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to generate invite code');
    } finally {
      setGeneratingCode(false);
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === 'owner') return { label: 'Owner', color: colors.accent, bg: colors.accentMuted };
    if (role === 'admin') return { label: 'Admin', color: colors.statusReady, bg: `${colors.statusReady}22` };
    return { label: 'Member', color: colors.textSecondary, bg: `${colors.textSecondary}22` };
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="flex-row items-center px-5 py-3 gap-3">
        <TouchableOpacity onPress={() => router.back()} className="rounded-xl p-2" style={cardStyle}>
          <ArrowLeft color={colors.textPrimary} size={20} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>
            Team
          </Text>
          {activeTeam && (
            <Text className="text-xs" style={{ color: colors.textSecondary }}>
              {activeTeam.name}
            </Text>
          )}
        </View>
        <View className="rounded-xl p-2" style={{ backgroundColor: colors.accentMuted }}>
          <Users color={colors.accent} size={20} />
        </View>
      </View>

      <View className="flex-row items-center justify-between px-5 mb-3">
        <Text className="text-sm" style={{ color: colors.textSecondary }}>
          {members.length} team member{members.length !== 1 ? 's' : ''}
        </Text>
        {can('manage_team') && (
          <TouchableOpacity
            onPress={handleGenerateInvite}
            disabled={generatingCode}
            className="flex-row items-center gap-1.5 rounded-xl px-3 py-2"
            style={{ backgroundColor: colors.accent }}>
            {generatingCode ? (
              <ActivityIndicator color={colors.accentOnAccent} size="small" />
            ) : (
              <>
                <Copy color={colors.accentOnAccent} size={14} />
                <Text className="font-bold text-xs" style={{ color: colors.accentOnAccent }}>
                  Invite
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

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
            const badge = getRoleBadge(member.role);
            const profile = member.profiles;
            const isExpanded = expandedMemberId === member.id;
            const canChangeRole = can('manage_team') && member.user_id !== user?.id && member.role !== 'owner';
            const roleOptions = [
              { label: 'Admin', value: 'admin' as const, icon: <Shield color={colors.statusReady} size={16} /> },
              { label: 'Member', value: 'member' as const, icon: <User color={colors.textSecondary} size={16} /> },
            ];
            return (
              <View className="mb-3">
                <TouchableOpacity
                  onPress={() => canChangeRole ? toggleRoleDropdown(member) : undefined}
                  activeOpacity={canChangeRole ? 0.7 : 1}
                  className="flex-row items-center px-4 py-3"
                  style={{
                    ...cardStyle,
                    borderRadius: isExpanded ? 16 : 16,
                    borderBottomLeftRadius: isExpanded ? 0 : 16,
                    borderBottomRightRadius: isExpanded ? 0 : 16,
                  }}>
                  <View
                    className="items-center justify-center rounded-2xl mr-3"
                    style={{ width: 48, height: 48, backgroundColor: colors.accentMuted }}>
                    {member.role === 'owner' ? (
                      <Crown color={colors.accent} size={22} />
                    ) : member.role === 'admin' ? (
                      <Shield color={colors.statusReady} size={22} />
                    ) : (
                      <User color={colors.textSecondary} size={22} />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="font-semibold text-sm" style={{ color: colors.textPrimary }}>
                      {profile?.full_name ?? 'Unknown'}
                    </Text>
                    {profile?.department && (
                      <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
                        {profile.department}
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
                {isExpanded && (
                  <View
                    style={{
                      backgroundColor: colors.surface,
                      borderBottomLeftRadius: 16,
                      borderBottomRightRadius: 16,
                      borderWidth: isDark ? 1 : 0,
                      borderTopWidth: 0,
                      borderColor: isDark ? colors.borderLight : 'transparent',
                      overflow: 'hidden',
                    }}>
                    <View style={{ height: 1, backgroundColor: colors.borderLight, marginHorizontal: 16 }} />
                    <Text className="text-[10px] font-bold uppercase px-4 pt-3 pb-2" style={{ color: colors.textSecondary, letterSpacing: 1 }}>
                      Change Role
                    </Text>
                    {roleOptions.map((role) => {
                      const isCurrent = member.role === role.value;
                      return (
                        <TouchableOpacity
                          key={role.value}
                          onPress={() => applyRole(member, role.value)}
                          className="flex-row items-center gap-3 px-4 py-3"
                          style={{ backgroundColor: isCurrent ? `${colors.accent}11` : 'transparent' }}>
                          {role.icon}
                          <Text className="flex-1 text-sm font-medium" style={{ color: colors.textPrimary }}>
                            {role.label}
                          </Text>
                          {isCurrent && (
                            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: colors.accentMuted }}>
                              <Text className="text-[10px] font-bold" style={{ color: colors.accent }}>Current</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                    <View style={{ height: 8 }} />
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
