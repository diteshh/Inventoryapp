import { supabase } from './supabase';
import type { ActionType } from './types';

export async function logActivity(
  userId: string | undefined,
  actionType: ActionType,
  options?: {
    itemId?: string;
    pickListId?: string;
    details?: Record<string, unknown>;
  }
) {
  if (!userId) return;
  await supabase.from('activity_log').insert({
    user_id: userId,
    action_type: actionType,
    item_id: options?.itemId ?? null,
    pick_list_id: options?.pickListId ?? null,
    details: options?.details ?? {},
  });
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

export function getPickListStatusColor(status: string, colors?: { statusDraft: string; statusReady: string; statusInProgress: string; statusPartial: string; statusComplete: string }): string {
  const c = colors ?? { statusDraft: '#7D8590', statusReady: '#58A6FF', statusInProgress: '#D29922', statusPartial: '#F0883E', statusComplete: '#3FB950' };
  switch (status) {
    case 'draft':
      return c.statusDraft;
    case 'ready_to_pick':
      return c.statusReady;
    case 'in_progress':
      return c.statusInProgress;
    case 'partially_complete':
      return c.statusPartial;
    case 'complete':
      return c.statusComplete;
    default:
      return c.statusDraft;
  }
}

export function getPickListStatusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'ready_to_pick':
      return 'Ready';
    case 'in_progress':
      return 'In Progress';
    case 'partially_complete':
      return 'Partial';
    case 'complete':
      return 'Complete';
    default:
      return status;
  }
}

export function getActionLabel(actionType: string): string {
  switch (actionType) {
    case 'item_created':
      return 'Item created';
    case 'item_updated':
      return 'Item updated';
    case 'item_deleted':
      return 'Item deleted';
    case 'quantity_adjusted':
      return 'Quantity adjusted';
    case 'item_moved':
      return 'Item moved';
    case 'pick_list_created':
      return 'Pick list created';
    case 'pick_list_updated':
      return 'Pick list updated';
    case 'pick_list_completed':
      return 'Pick list completed';
    case 'item_picked':
      return 'Item picked';
    default:
      return actionType.replace(/_/g, ' ');
  }
}

export function getPhotoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const { data } = supabase.storage.from('item-photos').getPublicUrl(path);
  return data.publicUrl;
}

export async function generateSku(type: 'item' | 'folder'): Promise<string> {
  const prefix = 'SHPWPR';
  const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const sku = `${prefix}${randomNum}`;
  
  // Optional: check if sku already exists
  const table = type === 'item' ? 'items' : 'folders';
  const { data } = await supabase.from(table).select('sku').eq('sku', sku).maybeSingle();
  
  if (data) {
    // If it exists, try again (recursion)
    return generateSku(type);
  }
  
  return sku;
}
