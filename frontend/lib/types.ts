export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
        folders: {
          Row: {
            id: string;
            name: string;
            parent_folder_id: string | null;
            icon: string | null;
            colour: string | null;
            description: string | null;
            sku: string | null;
            created_at: string;
            updated_at: string;
          };
          Insert: {
            id?: string;
            name: string;
            parent_folder_id?: string | null;
            icon?: string | null;
            colour?: string | null;
            description?: string | null;
            sku?: string | null;
            created_at?: string;
            updated_at?: string;
          };
          Update: {
            id?: string;
            name?: string;
            parent_folder_id?: string | null;
            icon?: string | null;
            colour?: string | null;
            description?: string | null;
            sku?: string | null;
            updated_at?: string;
          };
        };
      tags: {
        Row: {
          id: string;
          name: string;
          colour: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          colour?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          colour?: string | null;
        };
      };
      items: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          sku: string | null;
          barcode: string | null;
          quantity: number;
          min_quantity: number;
          cost_price: number | null;
          sell_price: number | null;
          weight: number | null;
          dimensions: Json | null;
          photos: string[] | null;
          custom_fields: Json;
          folder_id: string | null;
          location: string | null;
          notes: string | null;
          status: string;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          sku?: string | null;
          barcode?: string | null;
          quantity?: number;
          min_quantity?: number;
          cost_price?: number | null;
          sell_price?: number | null;
          weight?: number | null;
          dimensions?: Json | null;
          photos?: string[] | null;
          custom_fields?: Json;
          folder_id?: string | null;
          location?: string | null;
          notes?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          sku?: string | null;
          barcode?: string | null;
          quantity?: number;
          min_quantity?: number;
          cost_price?: number | null;
          sell_price?: number | null;
          weight?: number | null;
          dimensions?: Json | null;
          photos?: string[] | null;
          custom_fields?: Json;
          folder_id?: string | null;
          location?: string | null;
          notes?: string | null;
          status?: string;
          updated_at?: string;
          created_by?: string | null;
        };
      };
      item_tags: {
        Row: {
          item_id: string;
          tag_id: string;
        };
        Insert: {
          item_id: string;
          tag_id: string;
        };
        Update: {
          item_id?: string;
          tag_id?: string;
        };
      };
      pick_lists: {
        Row: {
          id: string;
          name: string;
          status: string;
          assigned_to: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          status?: string;
          assigned_to?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          status?: string;
          assigned_to?: string | null;
          notes?: string | null;
          updated_at?: string;
          created_by?: string | null;
        };
      };
      pick_list_items: {
        Row: {
          id: string;
          pick_list_id: string;
          item_id: string;
          quantity_requested: number;
          quantity_picked: number;
          location_hint: string | null;
          unit_price: number | null;
          picked_at: string | null;
          picked_by: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          pick_list_id: string;
          item_id: string;
          quantity_requested?: number;
          quantity_picked?: number;
          location_hint?: string | null;
          unit_price?: number | null;
          picked_at?: string | null;
          picked_by?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          pick_list_id?: string;
          item_id?: string;
          quantity_requested?: number;
          quantity_picked?: number;
          location_hint?: string | null;
          unit_price?: number | null;
          picked_at?: string | null;
          picked_by?: string | null;
          sort_order?: number;
        };
      };
      activity_log: {
        Row: {
          id: string;
          user_id: string | null;
          action_type: string;
          item_id: string | null;
          pick_list_id: string | null;
          details: Json;
          timestamp: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action_type: string;
          item_id?: string | null;
          pick_list_id?: string | null;
          details?: Json;
          timestamp?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          action_type?: string;
          item_id?: string | null;
          pick_list_id?: string | null;
          details?: Json;
          timestamp?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          role: string;
          pin_hash: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: string;
          pin_hash?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: string;
          pin_hash?: string | null;
          updated_at?: string;
        };
      };
      pick_list_comments: {
        Row: {
          id: string;
          pick_list_id: string;
          user_id: string | null;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          pick_list_id: string;
          user_id?: string | null;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          pick_list_id?: string;
          user_id?: string | null;
          content?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Convenience types
export type Folder = Database['public']['Tables']['folders']['Row'];
export type Tag = Database['public']['Tables']['tags']['Row'];
export type Item = Database['public']['Tables']['items']['Row'];
export type PickList = Database['public']['Tables']['pick_lists']['Row'];
export type PickListItem = Database['public']['Tables']['pick_list_items']['Row'];
export type ActivityLog = Database['public']['Tables']['activity_log']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type PickListComment = Database['public']['Tables']['pick_list_comments']['Row'];

export type PickListStatus =
  | 'draft'
  | 'ready_to_pick'
  | 'in_progress'
  | 'partially_complete'
  | 'complete';

export type ActionType =
  | 'item_created'
  | 'item_updated'
  | 'item_deleted'
  | 'quantity_adjusted'
  | 'item_moved'
  | 'pick_list_created'
  | 'pick_list_updated'
  | 'pick_list_completed'
  | 'item_picked';

// Extended types with joins
export type ItemWithTags = Item & { tags?: Tag[] };
export type PickListWithItems = PickList & {
  pick_list_items?: (PickListItem & { items?: Item })[];
  profiles?: Profile;
};
