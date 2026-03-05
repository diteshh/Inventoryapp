import { useAuth } from '@/lib/auth-context';

export type UserRole = 'owner' | 'admin' | 'member';

export type PermissionAction =
  | 'delete_item'
  | 'delete_folder'
  | 'manage_tags'
  | 'manage_team'
  | 'promote_to_admin'
  | 'demote_admin'
  | 'edit_settings'
  | 'delete_data';

const PERMISSION_MAP: Record<PermissionAction, UserRole[]> = {
  delete_item: ['owner', 'admin'],
  delete_folder: ['owner', 'admin'],
  manage_tags: ['owner', 'admin'],
  manage_team: ['owner', 'admin'],
  promote_to_admin: ['owner', 'admin'],
  demote_admin: ['owner'],
  edit_settings: ['owner', 'admin'],
  delete_data: ['owner'],
};

export function canPerform(role: UserRole | undefined, action: PermissionAction): boolean {
  if (!role) return false;
  return PERMISSION_MAP[action].includes(role);
}

export function usePermission() {
  const { profile } = useAuth();
  const role = profile?.role as UserRole | undefined;

  return {
    role,
    can: (action: PermissionAction) => canPerform(role, action),
  };
}
