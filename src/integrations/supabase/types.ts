export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          permissions: Json
          team_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          permissions?: Json
          team_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          permissions?: Json
          team_id?: string
        }
        Relationships: []
      }
      api_logs: {
        Row: {
          api_key_id: string
          created_at: string
          id: string
          method: string
          path: string
          status_code: number
        }
        Insert: {
          api_key_id: string
          created_at?: string
          id?: string
          method: string
          path: string
          status_code: number
        }
        Update: {
          api_key_id?: string
          created_at?: string
          id?: string
          method?: string
          path?: string
          status_code?: number
        }
        Relationships: []
      }
      board_approval_notify_settings: {
        Row: {
          approval_type: string
          board_id: string
          created_at: string
          id: string
          include_creator: boolean
          mode: string
          recipient_ids: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approval_type: string
          board_id: string
          created_at?: string
          id?: string
          include_creator?: boolean
          mode?: string
          recipient_ids?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approval_type?: string
          board_id?: string
          created_at?: string
          id?: string
          include_creator?: boolean
          mode?: string
          recipient_ids?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      board_members: {
        Row: {
          added_by: string | null
          board_id: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["team_role"]
          user_id: string
        }
        Insert: {
          added_by?: string | null
          board_id: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["team_role"]
          user_id: string
        }
        Update: {
          added_by?: string | null
          board_id?: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["team_role"]
          user_id?: string
        }
        Relationships: []
      }
      board_services: {
        Row: {
          board_id: string
          created_at: string
          id: string
          monthly_limit: number
          service_id: string
        }
        Insert: {
          board_id: string
          created_at?: string
          id?: string
          monthly_limit?: number
          service_id: string
        }
        Update: {
          board_id?: string
          created_at?: string
          id?: string
          monthly_limit?: number
          service_id?: string
        }
        Relationships: []
      }
      board_statuses: {
        Row: {
          adjustment_type: Database["public"]["Enums"]["adjustment_type"] | null
          board_id: string
          created_at: string
          id: string
          is_active: boolean
          position: number
          status_id: string
          visible_to_roles: string[] | null
        }
        Insert: {
          adjustment_type?:
            | Database["public"]["Enums"]["adjustment_type"]
            | null
          board_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          position?: number
          status_id: string
          visible_to_roles?: string[] | null
        }
        Update: {
          adjustment_type?:
            | Database["public"]["Enums"]["adjustment_type"]
            | null
          board_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          position?: number
          status_id?: string
          visible_to_roles?: string[] | null
        }
        Relationships: []
      }
      board_summary_history: {
        Row: {
          analytics_data: Json
          board_id: string
          created_at: string
          created_by: string
          id: string
          summary_text: string
        }
        Insert: {
          analytics_data: Json
          board_id: string
          created_at?: string
          created_by: string
          id?: string
          summary_text: string
        }
        Update: {
          analytics_data?: Json
          board_id?: string
          created_at?: string
          created_by?: string
          id?: string
          summary_text?: string
        }
        Relationships: []
      }
      board_summary_share_tokens: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          summary_id: string
          token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          summary_id: string
          token: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          summary_id?: string
          token?: string
        }
        Relationships: []
      }
      board_whatsapp_keywords: {
        Row: {
          board_id: string
          created_at: string
          created_by: string | null
          id: string
          keyword: string
        }
        Insert: {
          board_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          keyword: string
        }
        Update: {
          board_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          keyword?: string
        }
        Relationships: []
      }
      boards: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_default: boolean | null
          monthly_demand_limit: number | null
          name: string
          team_id: string
          updated_at: string
          whatsapp_enabled: boolean
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          monthly_demand_limit?: number | null
          name: string
          team_id: string
          updated_at?: string
          whatsapp_enabled?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          monthly_demand_limit?: number | null
          name?: string
          team_id?: string
          updated_at?: string
          whatsapp_enabled?: boolean
        }
        Relationships: []
      }
      contracts: {
        Row: {
          created_at: string
          file_name: string | null
          file_url: string | null
          id: string
          original_content: string | null
          processed_content: string | null
          status: string
          team_id: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          original_content?: string | null
          processed_content?: string | null
          status?: string
          team_id: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          original_content?: string | null
          processed_content?: string | null
          status?: string
          team_id?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          created_at: string
          id: string
          redeemed_by: string
          team_id: string
        }
        Insert: {
          coupon_id: string
          created_at?: string
          id?: string
          redeemed_by: string
          team_id: string
        }
        Update: {
          coupon_id?: string
          created_at?: string
          id?: string
          redeemed_by?: string
          team_id?: string
        }
        Relationships: []
      }
      demand_approval_notify_settings: {
        Row: {
          approval_type: string
          created_at: string
          created_by: string | null
          demand_id: string
          id: string
          include_creator: boolean
          mode: string
          recipient_ids: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approval_type: string
          created_at?: string
          created_by?: string | null
          demand_id: string
          id?: string
          include_creator?: boolean
          mode?: string
          recipient_ids?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approval_type?: string
          created_at?: string
          created_by?: string | null
          demand_id?: string
          id?: string
          include_creator?: boolean
          mode?: string
          recipient_ids?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      demand_assignees: {
        Row: {
          assigned_at: string | null
          demand_id: string
          id: string
          is_primary: boolean
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          demand_id: string
          id?: string
          is_primary?: boolean
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          demand_id?: string
          id?: string
          is_primary?: boolean
          user_id?: string
        }
        Relationships: []
      }
      demand_attachments: {
        Row: {
          created_at: string
          demand_id: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          interaction_id: string | null
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          demand_id: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          interaction_id?: string | null
          uploaded_by: string
        }
        Update: {
          created_at?: string
          demand_id?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          interaction_id?: string | null
          uploaded_by?: string
        }
        Relationships: []
      }
      demand_dependencies: {
        Row: {
          created_at: string | null
          demand_id: string
          depends_on_demand_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          demand_id: string
          depends_on_demand_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          demand_id?: string
          depends_on_demand_id?: string
          id?: string
        }
        Relationships: []
      }
      demand_interactions: {
        Row: {
          channel: string
          content: string | null
          created_at: string
          demand_id: string
          id: string
          interaction_type: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          channel?: string
          content?: string | null
          created_at?: string
          demand_id: string
          id?: string
          interaction_type: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          channel?: string
          content?: string | null
          created_at?: string
          demand_id?: string
          id?: string
          interaction_type?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      demand_request_attachments: {
        Row: {
          comment_id: string | null
          created_at: string
          demand_request_id: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          uploaded_by: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          demand_request_id: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          uploaded_by: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          demand_request_id?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      demand_request_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          request_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          request_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          request_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      demand_requests: {
        Row: {
          board_id: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          payment_required: boolean | null
          payment_status: string | null
          priority: string | null
          rejection_reason: string | null
          responded_at: string | null
          responded_by: string | null
          service_id: string | null
          status: string
          team_id: string
          title: string
          updated_at: string
        }
        Insert: {
          board_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          payment_required?: boolean | null
          payment_status?: string | null
          priority?: string | null
          rejection_reason?: string | null
          responded_at?: string | null
          responded_by?: string | null
          service_id?: string | null
          status?: string
          team_id: string
          title: string
          updated_at?: string
        }
        Update: {
          board_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          payment_required?: boolean | null
          payment_status?: string | null
          priority?: string | null
          rejection_reason?: string | null
          responded_at?: string | null
          responded_by?: string | null
          service_id?: string | null
          status?: string
          team_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      demand_share_tokens: {
        Row: {
          auto_join_board: boolean
          created_at: string
          created_by: string
          demand_id: string
          expires_at: string | null
          id: string
          is_active: boolean
          token: string
        }
        Insert: {
          auto_join_board?: boolean
          created_at?: string
          created_by: string
          demand_id: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          token: string
        }
        Update: {
          auto_join_board?: boolean
          created_at?: string
          created_by?: string
          demand_id?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          token?: string
        }
        Relationships: []
      }
      demand_statuses: {
        Row: {
          board_id: string | null
          color: string
          created_at: string
          id: string
          is_system: boolean | null
          name: string
        }
        Insert: {
          board_id?: string | null
          color?: string
          created_at?: string
          id?: string
          is_system?: boolean | null
          name: string
        }
        Update: {
          board_id?: string | null
          color?: string
          created_at?: string
          id?: string
          is_system?: boolean | null
          name?: string
        }
        Relationships: []
      }
      demand_subtasks: {
        Row: {
          completed: boolean
          created_at: string
          demand_id: string
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          demand_id: string
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          demand_id?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      demand_templates: {
        Row: {
          board_id: string | null
          created_at: string
          created_by: string
          description_template: string | null
          id: string
          name: string
          priority: string | null
          service_id: string | null
          team_id: string
          title_template: string | null
          updated_at: string
        }
        Insert: {
          board_id?: string | null
          created_at?: string
          created_by: string
          description_template?: string | null
          id?: string
          name: string
          priority?: string | null
          service_id?: string | null
          team_id: string
          title_template?: string | null
          updated_at?: string
        }
        Update: {
          board_id?: string | null
          created_at?: string
          created_by?: string
          description_template?: string | null
          id?: string
          name?: string
          priority?: string | null
          service_id?: string | null
          team_id?: string
          title_template?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      demand_time_entries: {
        Row: {
          created_at: string
          demand_id: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          demand_id: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          demand_id?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      demands: {
        Row: {
          archived: boolean
          archived_at: string | null
          assigned_to: string | null
          board_id: string
          board_sequence_number: number | null
          created_at: string
          created_by: string
          delivered_at: string | null
          description: string | null
          due_date: string | null
          id: string
          is_overdue: boolean
          last_started_at: string | null
          meet_link: string | null
          parent_demand_id: string | null
          priority: string | null
          recurring_demand_id: string | null
          service_id: string | null
          status_changed_at: string | null
          status_changed_by: string | null
          status_id: string
          subdemand_sort_order: number | null
          team_id: string
          time_in_progress_seconds: number | null
          title: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          assigned_to?: string | null
          board_id: string
          board_sequence_number?: number | null
          created_at?: string
          created_by: string
          delivered_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_overdue?: boolean
          last_started_at?: string | null
          meet_link?: string | null
          parent_demand_id?: string | null
          priority?: string | null
          recurring_demand_id?: string | null
          service_id?: string | null
          status_changed_at?: string | null
          status_changed_by?: string | null
          status_id: string
          subdemand_sort_order?: number | null
          team_id: string
          time_in_progress_seconds?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          assigned_to?: string | null
          board_id?: string
          board_sequence_number?: number | null
          created_at?: string
          created_by?: string
          delivered_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_overdue?: boolean
          last_started_at?: string | null
          meet_link?: string | null
          parent_demand_id?: string | null
          priority?: string | null
          recurring_demand_id?: string | null
          service_id?: string | null
          status_changed_at?: string | null
          status_changed_by?: string | null
          status_id?: string
          subdemand_sort_order?: number | null
          team_id?: string
          time_in_progress_seconds?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          id: string
          refresh_token: string
          token_expires_at: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          id?: string
          refresh_token: string
          token_expires_at: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          id?: string
          refresh_token?: string
          token_expires_at?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      note_share_tokens: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          note_id: string
          token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          note_id: string
          token: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          note_id?: string
          token?: string
        }
        Relationships: []
      }
      note_shares: {
        Row: {
          created_at: string
          id: string
          note_id: string
          permission: Database["public"]["Enums"]["note_share_permission"]
          shared_by_user_id: string
          shared_with_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note_id: string
          permission?: Database["public"]["Enums"]["note_share_permission"]
          shared_by_user_id: string
          shared_with_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note_id?: string
          permission?: Database["public"]["Enums"]["note_share_permission"]
          shared_by_user_id?: string
          shared_with_user_id?: string
        }
        Relationships: []
      }
      note_tags: {
        Row: {
          color: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          team_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          team_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          team_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          archived: boolean
          content: string | null
          cover_url: string | null
          created_at: string
          created_by: string
          icon: string | null
          id: string
          is_public: boolean
          parent_id: string | null
          tags: string[] | null
          team_id: string
          title: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          content?: string | null
          cover_url?: string | null
          created_at?: string
          created_by: string
          icon?: string | null
          id?: string
          is_public?: boolean
          parent_id?: string | null
          tags?: string[] | null
          team_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          content?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string
          icon?: string | null
          id?: string
          is_public?: boolean
          parent_id?: string | null
          tags?: string[] | null
          team_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          link: string | null
          message: string
          read: boolean | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          link?: string | null
          message: string
          read?: boolean | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          link?: string | null
          message?: string
          read?: boolean | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string | null
          demand_id: string | null
          demand_request_id: string | null
          id: string
          paid_at: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string | null
          demand_id?: string | null
          demand_request_id?: string | null
          id?: string
          paid_at?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string | null
          demand_id?: string | null
          demand_request_id?: string | null
          id?: string
          paid_at?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          billing_period: string
          created_at: string | null
          currency: string
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          max_boards: number | null
          max_demands_per_month: number | null
          max_members: number | null
          max_notes: number | null
          max_services: number | null
          max_teams: number | null
          name: string
          price_cents: number
          price_cents_monthly: number
          price_cents_yearly: number
          promo_price_cents_monthly: number | null
          promo_price_cents_yearly: number | null
          slug: string
          sort_order: number | null
        }
        Insert: {
          billing_period?: string
          created_at?: string | null
          currency?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_boards?: number | null
          max_demands_per_month?: number | null
          max_members?: number | null
          max_notes?: number | null
          max_services?: number | null
          max_teams?: number | null
          name: string
          price_cents?: number
          price_cents_monthly?: number
          price_cents_yearly?: number
          promo_price_cents_monthly?: number | null
          promo_price_cents_yearly?: number | null
          slug: string
          sort_order?: number | null
        }
        Update: {
          billing_period?: string
          created_at?: string | null
          currency?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_boards?: number | null
          max_demands_per_month?: number | null
          max_members?: number | null
          max_notes?: number | null
          max_services?: number | null
          max_teams?: number | null
          name?: string
          price_cents?: number
          price_cents_monthly?: number
          price_cents_yearly?: number
          promo_price_cents_monthly?: number | null
          promo_price_cents_yearly?: number | null
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banner_gradient: string | null
          banner_url: string | null
          bio: string | null
          city: string | null
          created_at: string
          default_whatsapp_board_id: string | null
          email: string | null
          full_name: string
          github_url: string | null
          id: string
          is_demand_history_public: boolean
          job_title: string | null
          linkedin_url: string | null
          location: string | null
          phone: string | null
          profile_visibility: Json
          state: string | null
          trial_ends_at: string | null
          updated_at: string
          website: string | null
          whatsapp_phone: string | null
          whatsapp_verified_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          banner_gradient?: string | null
          banner_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          default_whatsapp_board_id?: string | null
          email?: string | null
          full_name: string
          github_url?: string | null
          id: string
          is_demand_history_public?: boolean
          job_title?: string | null
          linkedin_url?: string | null
          location?: string | null
          phone?: string | null
          profile_visibility?: Json
          state?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          website?: string | null
          whatsapp_phone?: string | null
          whatsapp_verified_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          banner_gradient?: string | null
          banner_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          default_whatsapp_board_id?: string | null
          email?: string | null
          full_name?: string
          github_url?: string | null
          id?: string
          is_demand_history_public?: boolean
          job_title?: string | null
          linkedin_url?: string | null
          location?: string | null
          phone?: string | null
          profile_visibility?: Json
          state?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          website?: string | null
          whatsapp_phone?: string | null
          whatsapp_verified_at?: string | null
        }
        Relationships: []
      }
      project_demands: {
        Row: {
          added_at: string
          demand_id: string
          id: string
          project_id: string
        }
        Insert: {
          added_at?: string
          demand_id: string
          id?: string
          project_id: string
        }
        Update: {
          added_at?: string
          demand_id?: string
          id?: string
          project_id?: string
        }
        Relationships: []
      }
      project_shares: {
        Row: {
          id: string
          permission: string
          project_id: string
          shared_at: string
          user_id: string
        }
        Insert: {
          id?: string
          permission?: string
          project_id: string
          shared_at?: string
          user_id: string
        }
        Update: {
          id?: string
          permission?: string
          project_id?: string
          shared_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          color: string
          created_at: string
          created_by: string
          id: string
          name: string
          team_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by: string
          id?: string
          name: string
          team_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_demands: {
        Row: {
          assignee_ids: string[] | null
          board_id: string
          created_at: string
          created_by: string
          day_of_month: number | null
          description: string | null
          end_date: string | null
          frequency: string
          id: string
          is_active: boolean
          last_generated_at: string | null
          next_run_date: string
          priority: string | null
          service_id: string | null
          start_date: string
          status_id: string
          team_id: string
          title: string
          updated_at: string
          weekdays: number[] | null
        }
        Insert: {
          assignee_ids?: string[] | null
          board_id: string
          created_at?: string
          created_by: string
          day_of_month?: number | null
          description?: string | null
          end_date?: string | null
          frequency: string
          id?: string
          is_active?: boolean
          last_generated_at?: string | null
          next_run_date: string
          priority?: string | null
          service_id?: string | null
          start_date: string
          status_id: string
          team_id: string
          title: string
          updated_at?: string
          weekdays?: number[] | null
        }
        Update: {
          assignee_ids?: string[] | null
          board_id?: string
          created_at?: string
          created_by?: string
          day_of_month?: number | null
          description?: string | null
          end_date?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          last_generated_at?: string | null
          next_run_date?: string
          priority?: string | null
          service_id?: string | null
          start_date?: string
          status_id?: string
          team_id?: string
          title?: string
          updated_at?: string
          weekdays?: number[] | null
        }
        Relationships: []
      }
      services: {
        Row: {
          board_id: string | null
          created_at: string
          created_by: string
          description: string | null
          estimated_hours: number
          id: string
          name: string
          parent_id: string | null
          price_cents: number
          team_id: string
          updated_at: string
        }
        Insert: {
          board_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          estimated_hours?: number
          id?: string
          name: string
          parent_id?: string | null
          price_cents?: number
          team_id: string
          updated_at?: string
        }
        Update: {
          board_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          estimated_hours?: number
          id?: string
          name?: string
          parent_id?: string | null
          price_cents?: number
          team_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string
          id: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          team_id: string
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          plan_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          team_id: string
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          team_id?: string
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      team_join_requests: {
        Row: {
          id: string
          message: string | null
          requested_at: string
          responded_at: string | null
          responded_by: string | null
          status: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          message?: string | null
          requested_at?: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          message?: string | null
          requested_at?: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          team_id?: string
          user_id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          id: string
          joined_at: string
          position_id: string | null
          role: Database["public"]["Enums"]["team_role"]
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          position_id?: string | null
          role?: Database["public"]["Enums"]["team_role"]
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          position_id?: string | null
          role?: Database["public"]["Enums"]["team_role"]
          team_id?: string
          user_id?: string
        }
        Relationships: []
      }
      team_positions: {
        Row: {
          color: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          team_id: string
          text_color: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          team_id: string
          text_color?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          team_id?: string
          text_color?: string | null
        }
        Relationships: []
      }
      teams: {
        Row: {
          access_code: string
          active: boolean | null
          contract_end_date: string | null
          contract_start_date: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          monthly_demand_limit: number | null
          name: string
          scope_description: string | null
          updated_at: string
        }
        Insert: {
          access_code: string
          active?: boolean | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          monthly_demand_limit?: number | null
          name: string
          scope_description?: string | null
          updated_at?: string
        }
        Update: {
          access_code?: string
          active?: boolean | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          monthly_demand_limit?: number | null
          name?: string
          scope_description?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      trial_coupons: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number
          plan_id: string
          times_used: number
          trial_days: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          plan_id: string
          times_used?: number
          trial_days?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          plan_id?: string
          times_used?: number
          trial_days?: number
        }
        Relationships: []
      }
      usage_records: {
        Row: {
          boards_count: number | null
          created_at: string | null
          demands_created: number | null
          id: string
          members_count: number | null
          notes_count: number | null
          period_end: string
          period_start: string
          storage_bytes: number | null
          team_id: string
          updated_at: string | null
        }
        Insert: {
          boards_count?: number | null
          created_at?: string | null
          demands_created?: number | null
          id?: string
          members_count?: number | null
          notes_count?: number | null
          period_end: string
          period_start: string
          storage_bytes?: number | null
          team_id: string
          updated_at?: string | null
        }
        Update: {
          boards_count?: number | null
          created_at?: string | null
          demands_created?: number | null
          id?: string
          members_count?: number | null
          notes_count?: number | null
          period_end?: string
          period_start?: string
          storage_bytes?: number | null
          team_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          id: string
          preference_key: string
          preference_value: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          preference_key: string
          preference_value?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          preference_key?: string
          preference_value?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string
          event: string
          id: string
          payload: Json | null
          response_body: string | null
          response_status: number | null
          subscription_id: string
          success: boolean
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          subscription_id: string
          success?: boolean
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          subscription_id?: string
          success?: boolean
        }
        Relationships: []
      }
      webhook_subscriptions: {
        Row: {
          created_at: string
          created_by: string
          events: string[]
          id: string
          is_active: boolean
          last_triggered_at: string | null
          secret_hash: string
          secret_prefix: string
          team_id: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by: string
          events?: string[]
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          secret_hash: string
          secret_prefix: string
          team_id: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string
          events?: string[]
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          secret_hash?: string
          secret_prefix?: string
          team_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      whatsapp_inbound_logs: {
        Row: {
          ai_extraction: Json | null
          created_at: string
          created_demand_id: string | null
          created_request_id: string | null
          error: string | null
          from_phone: string
          id: string
          matched_board_id: string | null
          matched_user_id: string | null
          raw_message: string | null
          status: string
          to_phone: string | null
        }
        Insert: {
          ai_extraction?: Json | null
          created_at?: string
          created_demand_id?: string | null
          created_request_id?: string | null
          error?: string | null
          from_phone: string
          id?: string
          matched_board_id?: string | null
          matched_user_id?: string | null
          raw_message?: string | null
          status?: string
          to_phone?: string | null
        }
        Update: {
          ai_extraction?: Json | null
          created_at?: string
          created_demand_id?: string | null
          created_request_id?: string | null
          error?: string | null
          from_phone?: string
          id?: string
          matched_board_id?: string | null
          matched_user_id?: string | null
          raw_message?: string | null
          status?: string
          to_phone?: string | null
        }
        Relationships: []
      }
      whatsapp_phone_codes: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          phone: string
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_team_ids: { Args: { _user_id: string }; Returns: string[] }
      is_team_admin: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_admin_or_moderator: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_owner: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      adjustment_type: "none" | "internal" | "external"
      app_role: "admin" | "member"
      note_share_permission: "viewer" | "editor"
      team_role: "admin" | "moderator" | "requester" | "executor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      adjustment_type: ["none", "internal", "external"],
      app_role: ["admin", "member"],
      note_share_permission: ["viewer", "editor"],
      team_role: ["admin", "moderator", "requester", "executor"],
    },
  },
} as const
