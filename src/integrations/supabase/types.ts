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
        Relationships: [
          {
            foreignKeyName: "api_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "api_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "board_approval_notify_settings_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "board_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_members_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "board_services_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "board_statuses_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_statuses_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "demand_statuses"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "board_summary_history_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_summary_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "board_summary_share_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_summary_share_tokens_summary_id_fkey"
            columns: ["summary_id"]
            isOneToOne: false
            referencedRelation: "board_summary_history"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "board_whatsapp_keywords_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "boards_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "contracts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "trial_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "demand_approval_notify_settings_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "demand_assignees_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_assignees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "demand_attachments_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_attachments_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "demand_interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "demand_dependencies_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_dependencies_depends_on_demand_id_fkey"
            columns: ["depends_on_demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "demand_interactions_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "demand_request_attachments_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "demand_request_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_request_attachments_demand_request_id_fkey"
            columns: ["demand_request_id"]
            isOneToOne: false
            referencedRelation: "demand_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_request_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "demand_request_comments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "demand_requests"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "demand_requests_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_requests_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "demand_share_tokens_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "demand_statuses_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "demand_subtasks_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "demand_templates_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_templates_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_templates_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "demand_time_entries_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "demands_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demands_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demands_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demands_parent_demand_id_fkey"
            columns: ["parent_demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demands_recurring_demand_id_fkey"
            columns: ["recurring_demand_id"]
            isOneToOne: false
            referencedRelation: "recurring_demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demands_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demands_status_changed_by_fkey"
            columns: ["status_changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demands_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "demand_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demands_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "note_share_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_share_tokens_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "note_shares_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_shares_shared_by_user_id_fkey"
            columns: ["shared_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_shares_shared_with_user_id_fkey"
            columns: ["shared_with_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "note_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_tags_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
      password_reset_codes: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          email: string
          expires_at: string
          id: string
          used: boolean
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          used?: boolean
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          used?: boolean
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
        Relationships: [
          {
            foreignKeyName: "payments_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_demand_request_id_fkey"
            columns: ["demand_request_id"]
            isOneToOne: false
            referencedRelation: "demand_requests"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "profiles_default_whatsapp_board_id_fkey"
            columns: ["default_whatsapp_board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "project_demands_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_demands_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "project_shares_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "recurring_demands_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_demands_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_demands_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "demand_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_demands_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "services_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "team_join_requests_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_join_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "team_members_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "team_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "team_positions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "teams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "trial_coupons_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "usage_records_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_board_ai_insights: {
        Row: {
          board_id: string
          created_at: string
          expires_at: string
          generated_at: string
          id: string
          insights: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          board_id: string
          created_at?: string
          expires_at: string
          generated_at?: string
          id?: string
          insights: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          board_id?: string
          created_at?: string
          expires_at?: string
          generated_at?: string
          id?: string
          insights?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_board_ai_insights_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "webhook_logs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "webhook_subscriptions"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "webhook_subscriptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_subscriptions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "whatsapp_inbound_logs_created_demand_id_fkey"
            columns: ["created_demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_inbound_logs_created_request_id_fkey"
            columns: ["created_request_id"]
            isOneToOne: false
            referencedRelation: "demand_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_inbound_logs_matched_board_id_fkey"
            columns: ["matched_board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
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
      can_create_demand: { Args: { _team_id: string }; Returns: boolean }
      can_create_demand_with_service: {
        Args: { _board_id: string; _service_id: string }
        Returns: boolean
      }
      can_edit_note: {
        Args: { _note_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_demand_assignees: {
        Args: { _demand_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_demand_channel: {
        Args: { _channel: string; _demand_id: string; _user_id: string }
        Returns: boolean
      }
      check_access_code_exists: { Args: { code: string }; Returns: boolean }
      check_plan_limit: {
        Args: { _resource: string; _team_id: string }
        Returns: Json
      }
      check_subscription_limit: {
        Args: { _resource_type: string; _team_id: string }
        Returns: boolean
      }
      create_approval_notifications: {
        Args: {
          p_demand_id: string
          p_link?: string
          p_message: string
          p_recipient_ids: string[]
          p_title: string
          p_type?: string
        }
        Returns: number
      }
      create_board_membership_notification: {
        Args: {
          p_board_id: string
          p_link?: string
          p_message: string
          p_title: string
          p_type?: string
          p_user_id: string
        }
        Returns: string
      }
      create_board_with_services: {
        Args: {
          p_description?: string
          p_members?: Json
          p_name: string
          p_services?: Json
          p_stages?: Json
          p_team_id: string
        }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "boards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_demand_with_subdemands: {
        Args: { p_dependencies?: Json; p_parent: Json; p_subdemands?: Json }
        Returns: Json
      }
      email_exists: { Args: { _email: string }; Returns: boolean }
      get_board_role: {
        Args: { _board_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["team_role"]
      }
      get_board_service_demand_count: {
        Args: { _board_id: string; _service_id: string }
        Returns: number
      }
      get_join_request_profiles: {
        Args: { request_team_id: string }
        Returns: {
          avatar_url: string
          email: string
          full_name: string
          id: string
        }[]
      }
      get_monthly_demand_count: {
        Args: { _month: number; _team_id: string; _year: number }
        Returns: number
      }
      get_shared_board_summary: { Args: { p_token: string }; Returns: Json }
      get_team_active_plan: {
        Args: { _team_id: string }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_team_by_access_code: {
        Args: { code: string }
        Returns: {
          created_at: string
          description: string
          id: string
          name: string
        }[]
      }
      get_team_plan: {
        Args: { _team_id: string }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_user_board_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_id_by_email: { Args: { _email: string }; Returns: string }
      get_user_team_ids: { Args: { _user_id: string }; Returns: string[] }
      has_board_role: {
        Args: {
          _board_id: string
          _role: Database["public"]["Enums"]["team_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_folder_access: {
        Args: { _folder_id: string; _user_id: string }
        Returns: boolean
      }
      has_folder_edit_access: {
        Args: { _folder_id: string; _user_id: string }
        Returns: boolean
      }
      has_project_access: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      has_project_edit_access: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_team_role: {
        Args: {
          _role: Database["public"]["Enums"]["team_role"]
          _team_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_board_admin_in_team: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_board_admin_or_moderator: {
        Args: { _board_id: string; _user_id: string }
        Returns: boolean
      }
      is_board_member: {
        Args: { _board_id: string; _user_id: string }
        Returns: boolean
      }
      is_demand_shared: { Args: { demand_id_param: string }; Returns: boolean }
      is_folder_owner: {
        Args: { _folder_id: string; _user_id: string }
        Returns: boolean
      }
      is_note_owner: {
        Args: { _note_id: string; _user_id: string }
        Returns: boolean
      }
      is_note_shared: { Args: { note_id_param: string }; Returns: boolean }
      is_note_shared_with_user: {
        Args: { _note_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_owner: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_admin: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_admin_or_moderator: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_admin_or_moderator_for_board: {
        Args: { _board_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_creator: {
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
      join_board_via_share_token: { Args: { p_token: string }; Returns: Json }
      join_team_with_code: { Args: { p_code: string }; Returns: string }
      promote_to_admin_by_email: {
        Args: { p_email: string }
        Returns: undefined
      }
      propagate_status_to_subdemands: {
        Args: { p_new_status_id: string; p_parent_id: string }
        Returns: Json
      }
      redeem_trial_coupon: {
        Args: { p_code: string; p_team_id: string }
        Returns: Json
      }
      refresh_overdue_demands: { Args: never; Returns: number }
      reorder_subdemands: {
        Args: { p_ordered_ids: string[]; p_parent_id: string }
        Returns: undefined
      }
      update_trial_coupon: {
        Args: {
          p_coupon_id: string
          p_description?: string
          p_expires_at?: string
          p_max_uses: number
          p_plan_id: string
          p_propagate?: boolean
          p_trial_days: number
        }
        Returns: Json
      }
      verify_demand_share_token: {
        Args: { p_token: string }
        Returns: {
          demand_id: string
          expires_at: string
          id: string
          is_active: boolean
        }[]
      }
      verify_note_share_token: {
        Args: { p_token: string }
        Returns: {
          expires_at: string
          id: string
          is_active: boolean
          note_id: string
        }[]
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
