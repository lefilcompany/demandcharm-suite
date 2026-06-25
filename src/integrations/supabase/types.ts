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
      [_ in never]: never
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
      get_team_by_access_code: {
        Args: { code: string }
        Returns: {
          created_at: string
          description: string
          id: string
          name: string
        }[]
      }
      get_user_board_ids: { Args: { _user_id: string }; Returns: string[] }
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
