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
          cover_image: string | null;
          sku: string | null;
          team_id: string | null;
          created_by: string | null;
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
          cover_image?: string | null;
          sku?: string | null;
          team_id?: string | null;
          created_by?: string | null;
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
          cover_image?: string | null;
          sku?: string | null;
          team_id?: string | null;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'folders_parent_folder_id_fkey';
            columns: ['parent_folder_id'];
            isOneToOne: false;
            referencedRelation: 'folders';
            referencedColumns: ['id'];
          },
        ];
      };
      tags: {
        Row: {
          id: string;
          name: string;
          colour: string | null;
          team_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          colour?: string | null;
          team_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          colour?: string | null;
          team_id?: string | null;
          created_by?: string | null;
        };
        Relationships: [];
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
          team_id: string;
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
          team_id?: string | null;
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
          team_id?: string | null;
          updated_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'items_folder_id_fkey';
            columns: ['folder_id'];
            isOneToOne: false;
            referencedRelation: 'folders';
            referencedColumns: ['id'];
          },
        ];
      };
      item_tags: {
        Row: {
          item_id: string;
          tag_id: string;
          team_id: string | null;
        };
        Insert: {
          item_id: string;
          tag_id: string;
          team_id?: string | null;
        };
        Update: {
          item_id?: string;
          tag_id?: string;
          team_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'item_tags_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'item_tags_tag_id_fkey';
            columns: ['tag_id'];
            isOneToOne: false;
            referencedRelation: 'tags';
            referencedColumns: ['id'];
          },
        ];
      };
      pick_lists: {
        Row: {
          id: string;
          name: string;
          status: string;
          assigned_to: string | null;
          notes: string | null;
          team_id: string | null;
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
          team_id?: string | null;
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
          team_id?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
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
          team_id: string | null;
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
          team_id?: string | null;
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
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pick_list_items_pick_list_id_fkey';
            columns: ['pick_list_id'];
            isOneToOne: false;
            referencedRelation: 'pick_lists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pick_list_items_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'items';
            referencedColumns: ['id'];
          },
        ];
      };
      activity_log: {
        Row: {
          id: string;
          user_id: string | null;
          action_type: string;
          item_id: string | null;
          pick_list_id: string | null;
          details: Json;
          team_id: string | null;
          timestamp: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action_type: string;
          item_id?: string | null;
          pick_list_id?: string | null;
          details?: Json;
          team_id?: string | null;
          timestamp?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          action_type?: string;
          item_id?: string | null;
          pick_list_id?: string | null;
          details?: Json;
          team_id?: string;
          timestamp?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          role: 'owner' | 'admin' | 'member';
          pin_hash: string | null;
          department: string | null;
          permissions: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: 'owner' | 'admin' | 'member';
          pin_hash?: string | null;
          department?: string | null;
          permissions?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: 'owner' | 'admin' | 'member';
          pin_hash?: string | null;
          department?: string | null;
          permissions?: Json | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      pick_list_comments: {
        Row: {
          id: string;
          pick_list_id: string;
          user_id: string | null;
          content: string;
          team_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          pick_list_id: string;
          user_id?: string | null;
          content: string;
          team_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          pick_list_id?: string;
          user_id?: string | null;
          content?: string;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pick_list_comments_pick_list_id_fkey';
            columns: ['pick_list_id'];
            isOneToOne: false;
            referencedRelation: 'pick_lists';
            referencedColumns: ['id'];
          },
        ];
      };
      stock_counts: {
        Row: {
          id: string;
          name: string;
          status: string;
          notes: string | null;
          created_by: string | null;
          team_id: string | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          status?: string;
          notes?: string | null;
          created_by?: string | null;
          team_id?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          status?: string;
          notes?: string | null;
          created_by?: string | null;
          team_id?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      stock_count_items: {
        Row: {
          id: string;
          stock_count_id: string;
          item_id: string;
          expected_quantity: number;
          counted_quantity: number | null;
          difference: number | null;
          counted_by: string | null;
          counted_at: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          stock_count_id: string;
          item_id: string;
          expected_quantity?: number;
          counted_quantity?: number | null;
          difference?: number | null;
          counted_by?: string | null;
          counted_at?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          stock_count_id?: string;
          item_id?: string;
          expected_quantity?: number;
          counted_quantity?: number | null;
          difference?: number | null;
          counted_by?: string | null;
          counted_at?: string | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'stock_count_items_stock_count_id_fkey';
            columns: ['stock_count_id'];
            isOneToOne: false;
            referencedRelation: 'stock_counts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stock_count_items_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'items';
            referencedColumns: ['id'];
          },
        ];
      };
      purchase_orders: {
        Row: {
          id: string;
          po_number: string;
          supplier_name: string;
          status: string;
          notes: string | null;
          order_date: string | null;
          expected_date: string | null;
          created_by: string | null;
          team_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          po_number: string;
          supplier_name: string;
          status?: string;
          notes?: string | null;
          order_date?: string | null;
          expected_date?: string | null;
          created_by?: string | null;
          team_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          po_number?: string;
          supplier_name?: string;
          status?: string;
          notes?: string | null;
          order_date?: string | null;
          expected_date?: string | null;
          created_by?: string | null;
          team_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      purchase_order_items: {
        Row: {
          id: string;
          po_id: string;
          item_id: string;
          quantity_ordered: number;
          quantity_received: number;
          unit_cost: number | null;
          received_at: string | null;
          received_by: string | null;
        };
        Insert: {
          id?: string;
          po_id: string;
          item_id: string;
          quantity_ordered?: number;
          quantity_received?: number;
          unit_cost?: number | null;
          received_at?: string | null;
          received_by?: string | null;
        };
        Update: {
          id?: string;
          po_id?: string;
          item_id?: string;
          quantity_ordered?: number;
          quantity_received?: number;
          unit_cost?: number | null;
          received_at?: string | null;
          received_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'purchase_order_items_po_id_fkey';
            columns: ['po_id'];
            isOneToOne: false;
            referencedRelation: 'purchase_orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'purchase_order_items_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'items';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string | null;
          type: string;
          title: string;
          message: string | null;
          related_item_id: string | null;
          related_pick_list_id: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          type?: string;
          title: string;
          message?: string | null;
          related_item_id?: string | null;
          related_pick_list_id?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          type?: string;
          title?: string;
          message?: string | null;
          related_item_id?: string | null;
          related_pick_list_id?: string | null;
          is_read?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      transactions: {
        Row: {
          id: string;
          item_id: string | null;
          transaction_type: string;
          quantity_before: number;
          quantity_after: number;
          quantity_change: number;
          reference_id: string | null;
          reference_type: string | null;
          performed_by: string | null;
          notes: string | null;
          folder_name: string | null;
          item_name: string | null;
          team_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          item_id?: string | null;
          transaction_type: string;
          quantity_before?: number;
          quantity_after?: number;
          quantity_change?: number;
          reference_id?: string | null;
          reference_type?: string | null;
          performed_by?: string | null;
          notes?: string | null;
          folder_name?: string | null;
          item_name?: string | null;
          team_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          item_id?: string | null;
          transaction_type?: string;
          quantity_before?: number;
          quantity_after?: number;
          quantity_change?: number;
          reference_id?: string | null;
          reference_type?: string | null;
          performed_by?: string | null;
          notes?: string | null;
          folder_name?: string | null;
          item_name?: string | null;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'transactions_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'items';
            referencedColumns: ['id'];
          },
        ];
      };
      teams: {
        Row: {
          id: string;
          name: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };
      team_members: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          role: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          role?: string;
          joined_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          user_id?: string;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'team_members_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
        ];
      };
      team_invites: {
        Row: {
          id: string;
          team_id: string;
          invite_code: string;
          created_by: string | null;
          expires_at: string;
          used_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          invite_code: string;
          created_by?: string | null;
          expires_at?: string;
          used_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          invite_code?: string;
          created_by?: string | null;
          expires_at?: string;
          used_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'team_invites_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      pick_item: {
        Args: {
          p_pick_list_item_id: string;
          p_quantity_picked: number;
          p_picked_by: string;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
  };
}

// Team types (not in Database interface since managed separately)
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
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

export interface TeamInvite {
  id: string;
  team_id: string;
  invite_code: string;
  created_by: string | null;
  expires_at: string;
  used_by: string | null;
  created_at: string;
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
export type StockCount = Database['public']['Tables']['stock_counts']['Row'];
export type StockCountItem = Database['public']['Tables']['stock_count_items']['Row'];
export type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row'];
export type PurchaseOrderItem = Database['public']['Tables']['purchase_order_items']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];

export type PickListStatus =
  | 'draft'
  | 'ready_to_pick'
  | 'in_progress'
  | 'partially_complete'
  | 'complete';

export type StockCountStatus = 'draft' | 'in_progress' | 'complete';
export type PurchaseOrderStatus = 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled';
export type TransactionType = 'pick' | 'restock' | 'adjustment' | 'receive' | 'stock_count';

export type ActionType =
  | 'item_created'
  | 'item_updated'
  | 'item_deleted'
  | 'quantity_adjusted'
  | 'item_moved'
  | 'pick_list_created'
  | 'pick_list_updated'
  | 'pick_list_completed'
  | 'item_picked'
  | 'stock_count_created'
  | 'stock_count_completed'
  | 'po_created'
  | 'po_updated'
  | 'po_received'
  | 'item_received';

// Extended types with joins
export type ItemWithTags = Item & { tags?: Tag[] };
export type PickListWithItems = PickList & {
  pick_list_items?: (PickListItem & { items?: Item })[];
  profiles?: Profile;
};
export type StockCountWithItems = StockCount & {
  stock_count_items?: (StockCountItem & { items?: Item })[];
};
export type PurchaseOrderWithItems = PurchaseOrder & {
  purchase_order_items?: (PurchaseOrderItem & { items?: Item })[];
};
