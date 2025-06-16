export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
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
