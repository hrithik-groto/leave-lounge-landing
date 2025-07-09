export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admin_granted_leaves: {
        Row: {
          created_at: string | null
          expires_at: string | null
          granted_amount: number
          granted_at: string | null
          granted_by: string
          id: string
          leave_type_id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          granted_amount?: number
          granted_at?: string | null
          granted_by: string
          id?: string
          leave_type_id: string
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          granted_amount?: number
          granted_at?: string | null
          granted_by?: string
          id?: string
          leave_type_id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_admin_granted_leaves_leave_type_id"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          approver_id: string
          comments: string | null
          created_at: string
          decided_at: string | null
          decision: Database["public"]["Enums"]["approval_decision"] | null
          id: string
          request_id: string
        }
        Insert: {
          approver_id: string
          comments?: string | null
          created_at?: string
          decided_at?: string | null
          decision?: Database["public"]["Enums"]["approval_decision"] | null
          id?: string
          request_id: string
        }
        Update: {
          approver_id?: string
          comments?: string | null
          created_at?: string
          decided_at?: string | null
          decision?: Database["public"]["Enums"]["approval_decision"] | null
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      company_holidays: {
        Row: {
          created_at: string | null
          date: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          date: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          joining_date: string
          name: string
          role: Database["public"]["Enums"]["employee_role"]
          team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          joining_date: string
          name: string
          role?: Database["public"]["Enums"]["employee_role"]
          team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          joining_date?: string
          name?: string
          role?: Database["public"]["Enums"]["employee_role"]
          team_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      holiday_calendars: {
        Row: {
          created_at: string
          date: string
          id: string
          is_active: boolean
          label: string
          region: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          is_active?: boolean
          label: string
          region: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_active?: boolean
          label?: string
          region?: string
        }
        Relationships: []
      }
      leave_applied_users: {
        Row: {
          applied_at: string | null
          approved_at: string | null
          approved_by: string | null
          end_date: string
          holiday_name: string | null
          hours_requested: number | null
          id: string
          is_half_day: boolean | null
          leave_duration_type: string | null
          leave_time_end: string | null
          leave_time_start: string | null
          leave_type_id: string | null
          meeting_details: string | null
          reason: string | null
          start_date: string
          status: string | null
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          end_date: string
          holiday_name?: string | null
          hours_requested?: number | null
          id?: string
          is_half_day?: boolean | null
          leave_duration_type?: string | null
          leave_time_end?: string | null
          leave_time_start?: string | null
          leave_type_id?: string | null
          meeting_details?: string | null
          reason?: string | null
          start_date: string
          status?: string | null
          user_id: string
        }
        Update: {
          applied_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          end_date?: string
          holiday_name?: string | null
          hours_requested?: number | null
          id?: string
          is_half_day?: boolean | null
          leave_duration_type?: string | null
          leave_time_end?: string | null
          leave_time_start?: string | null
          leave_type_id?: string | null
          meeting_details?: string | null
          reason?: string | null
          start_date?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_leave_applied_users_leave_type"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_leave_applied_users_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_leave_applied_users_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_applied_users_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_applied_users_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_applied_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_policies: {
        Row: {
          annual_allowance: number
          carry_forward_limit: number | null
          created_at: string
          id: string
          is_active: boolean
          leave_type_id: string
          updated_at: string
        }
        Insert: {
          annual_allowance: number
          carry_forward_limit?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          leave_type_id: string
          updated_at?: string
        }
        Update: {
          annual_allowance?: number
          carry_forward_limit?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          leave_type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_policies_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          conflict_flag: boolean
          created_at: string
          days_requested: number
          employee_id: string
          end_date: string
          id: string
          reason: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          type_id: string
          updated_at: string
        }
        Insert: {
          conflict_flag?: boolean
          created_at?: string
          days_requested: number
          employee_id: string
          end_date: string
          id?: string
          reason?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          type_id: string
          updated_at?: string
        }
        Update: {
          conflict_flag?: boolean
          created_at?: string
          days_requested?: number
          employee_id?: string
          end_date?: string
          id?: string
          reason?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests_additional: {
        Row: {
          admin_comments: string | null
          created_at: string | null
          id: string
          leave_type_id: string
          reason: string
          requested_amount: number
          requested_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_comments?: string | null
          created_at?: string | null
          id?: string
          leave_type_id: string
          reason: string
          requested_amount?: number
          requested_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_comments?: string | null
          created_at?: string | null
          id?: string
          leave_type_id?: string
          reason?: string
          requested_amount?: number
          requested_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_leave_requests_additional_leave_type_id"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          accrual_rule: Database["public"]["Enums"]["accrual_rule"]
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          label: string
          requires_approval: boolean
          updated_at: string
        }
        Insert: {
          accrual_rule?: Database["public"]["Enums"]["accrual_rule"]
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          requires_approval?: boolean
          updated_at?: string
        }
        Update: {
          accrual_rule?: Database["public"]["Enums"]["accrual_rule"]
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          requires_approval?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          id: string
          is_read: boolean
          message: string
          sent_at: string
          user_id: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["notification_channel"]
          id?: string
          is_read?: boolean
          message: string
          sent_at?: string
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          id?: string
          is_read?: boolean
          message?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_notifications_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          id: string
          joined_at: string | null
          organization_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          organization_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          organization_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id: string
          name: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      slack_tokens: {
        Row: {
          access_token: string | null
          created_at: string | null
          id: string
          refresh_token: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string | null
          id?: string
          refresh_token?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string | null
          id?: string
          refresh_token?: string | null
          user_id?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          approver_ids: string[] | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          approver_ids?: string[] | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          approver_ids?: string[] | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_leave_balances: {
        Row: {
          allocated_days: number | null
          carried_forward_days: number | null
          created_at: string | null
          id: string
          leave_type_id: string | null
          updated_at: string | null
          used_days: number | null
          user_id: string
          year: number | null
        }
        Insert: {
          allocated_days?: number | null
          carried_forward_days?: number | null
          created_at?: string | null
          id?: string
          leave_type_id?: string | null
          updated_at?: string | null
          used_days?: number | null
          user_id: string
          year?: number | null
        }
        Update: {
          allocated_days?: number | null
          carried_forward_days?: number | null
          created_at?: string | null
          id?: string
          leave_type_id?: string | null
          updated_at?: string | null
          used_days?: number | null
          user_id?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      user_slack_integrations: {
        Row: {
          access_token: string | null
          created_at: string
          id: string
          slack_team_id: string
          slack_user_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          id?: string
          slack_team_id: string
          slack_user_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          id?: string
          slack_team_id?: string
          slack_user_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_monthly_leave_balance: {
        Args: {
          p_user_id: string
          p_leave_type_id: string
          p_month?: number
          p_year?: number
        }
        Returns: Json
      }
      get_total_remaining_leaves: {
        Args: { p_user_id: string; p_month?: number; p_year?: number }
        Returns: Json
      }
      initialize_user_leave_balances: {
        Args: { user_uuid: string }
        Returns: undefined
      }
    }
    Enums: {
      accrual_rule: "annual" | "monthly" | "pro_rata" | "fixed"
      approval_decision: "approved" | "rejected"
      employee_role: "employee" | "manager" | "admin" | "hr"
      leave_status: "pending" | "approved" | "rejected" | "cancelled"
      notification_channel: "email" | "slack" | "web"
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
      accrual_rule: ["annual", "monthly", "pro_rata", "fixed"],
      approval_decision: ["approved", "rejected"],
      employee_role: ["employee", "manager", "admin", "hr"],
      leave_status: ["pending", "approved", "rejected", "cancelled"],
      notification_channel: ["email", "slack", "web"],
    },
  },
} as const
