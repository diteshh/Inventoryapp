import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { UserRole } from '@/lib/permissions';

export interface Team {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: UserRole;
  joined_at: string;
}

interface TeamContextType {
  activeTeam: Team | null;
  teams: Team[];
  role: UserRole | undefined;
  teamId: string | undefined;
  loading: boolean;
  setActiveTeam: (teamId: string) => Promise<void>;
  createTeam: (name: string) => Promise<Team>;
  joinTeam: (inviteCode: string) => Promise<Team>;
  leaveTeam: () => Promise<void>;
  generateInviteCode: () => Promise<string>;
  refreshTeams: () => Promise<void>;
}

const ACTIVE_TEAM_KEY = 'active_team_id';

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeam, setActiveTeamState] = useState<Team | null>(null);
  const [role, setRole] = useState<UserRole | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const loadTeams = useCallback(async () => {
    if (!user) {
      setTeams([]);
      setActiveTeamState(null);
      setRole(undefined);
      setLoading(false);
      return;
    }

    try {
      // Fetch team memberships with team data
      const { data: memberships, error } = await supabase
        .from('team_members')
        .select('team_id, role, teams(id, name, created_by, created_at)')
        .eq('user_id', user.id);

      if (error) throw error;

      const userTeams = (memberships ?? [])
        .map((m: any) => m.teams as Team)
        .filter(Boolean);
      const membershipMap = new Map(
        (memberships ?? []).map((m: any) => [m.team_id, m.role as UserRole])
      );

      setTeams(userTeams);

      if (userTeams.length === 0) {
        setActiveTeamState(null);
        setRole(undefined);
        setLoading(false);
        return;
      }

      // Restore last active team from storage
      const storedTeamId = await AsyncStorage.getItem(ACTIVE_TEAM_KEY);
      const targetTeam =
        userTeams.find((t) => t.id === storedTeamId) ?? userTeams[0];

      setActiveTeamState(targetTeam);
      setRole(membershipMap.get(targetTeam.id));
    } catch (e) {
      console.error('Failed to load teams:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const setActiveTeam = useCallback(
    async (teamId: string) => {
      const team = teams.find((t) => t.id === teamId);
      if (!team) return;

      setActiveTeamState(team);
      await AsyncStorage.setItem(ACTIVE_TEAM_KEY, teamId);

      // Fetch role for this team
      if (user) {
        const { data } = await supabase
          .from('team_members')
          .select('role')
          .eq('team_id', teamId)
          .eq('user_id', user.id)
          .single();
        setRole(data?.role as UserRole | undefined);
      }
    },
    [teams, user]
  );

  const createTeam = useCallback(
    async (name: string): Promise<Team> => {
      if (!user) throw new Error('Not authenticated');
      if (activeTeam) throw new Error('You are already in a team. Leave your current team first.');

      const { data: team, error } = await supabase
        .from('teams')
        .insert({ name, created_by: user.id })
        .select()
        .single();
      if (error) throw error;

      // Add creator as owner
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({ team_id: team.id, user_id: user.id, role: 'owner' });
      if (memberError) throw memberError;

      // Update local state
      setTeams([team]);
      setActiveTeamState(team);
      setRole('owner');
      await AsyncStorage.setItem(ACTIVE_TEAM_KEY, team.id);

      return team;
    },
    [user, activeTeam]
  );

  const joinTeam = useCallback(
    async (inviteCode: string): Promise<Team> => {
      if (!user) throw new Error('Not authenticated');
      if (activeTeam) throw new Error('You are already in a team. Leave your current team first.');

      // Find invite
      const { data: invite, error: inviteError } = await supabase
        .from('team_invites')
        .select('id, team_id, expires_at, used_by, teams(id, name, created_by, created_at)')
        .eq('invite_code', inviteCode)
        .single();

      if (inviteError || !invite) throw new Error('Invalid invite code');
      if (invite.used_by) throw new Error('This invite has already been used');
      if (new Date(invite.expires_at) < new Date()) throw new Error('This invite has expired');

      // Add user to team
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({ team_id: invite.team_id, user_id: user.id, role: 'member' });
      if (memberError) {
        if (memberError.code === '23505') throw new Error('You are already a member of this team');
        throw memberError;
      }

      // Mark invite as used
      await supabase
        .from('team_invites')
        .update({ used_by: user.id })
        .eq('id', invite.id);

      const team = invite.teams as unknown as Team;
      setTeams([team]);
      setActiveTeamState(team);
      setRole('member');
      await AsyncStorage.setItem(ACTIVE_TEAM_KEY, team.id);

      return team;
    },
    [user, activeTeam]
  );

  const leaveTeam = useCallback(async () => {
    if (!user || !activeTeam) throw new Error('No active team');

    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', activeTeam.id)
      .eq('user_id', user.id);
    if (error) throw error;

    setTeams([]);
    setActiveTeamState(null);
    setRole(undefined);
    await AsyncStorage.removeItem(ACTIVE_TEAM_KEY);
  }, [user, activeTeam]);

  const generateInviteCode = useCallback(async (): Promise<string> => {
    if (!user || !activeTeam) throw new Error('No active team');

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { error } = await supabase.from('team_invites').insert({
      team_id: activeTeam.id,
      invite_code: code,
      created_by: user.id,
    });
    if (error) throw error;

    return code;
  }, [user, activeTeam]);

  const refreshTeams = useCallback(async () => {
    await loadTeams();
  }, [loadTeams]);

  return (
    <TeamContext.Provider
      value={{
        activeTeam,
        teams,
        role,
        teamId: activeTeam?.id,
        loading,
        setActiveTeam,
        createTeam,
        joinTeam,
        leaveTeam,
        generateInviteCode,
        refreshTeams,
      }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const context = useContext(TeamContext);
  if (!context) throw new Error('useTeam must be used within TeamProvider');
  return context;
}
