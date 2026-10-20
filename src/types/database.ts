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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          archived: boolean
          currency: Database["public"]["Enums"]["currency_code"]
          household_id: string
          id: string
          name: string
          owner_user_id: string | null
          type: Database["public"]["Enums"]["account_type"]
        }
        Insert: {
          archived?: boolean
          currency?: Database["public"]["Enums"]["currency_code"]
          household_id: string
          id?: string
          name: string
          owner_user_id?: string | null
          type: Database["public"]["Enums"]["account_type"]
        }
        Update: {
          archived?: boolean
          currency?: Database["public"]["Enums"]["currency_code"]
          household_id?: string
          id?: string
          name?: string
          owner_user_id?: string | null
          type?: Database["public"]["Enums"]["account_type"]
        }
        Relationships: [
          {
            foreignKeyName: "accounts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_lines: {
        Row: {
          category_id: string
          fixed_amount_cad: number | null
          household_id: string
          id: string
          month: string
          split_pct: number | null
          user_id: string
        }
        Insert: {
          category_id: string
          fixed_amount_cad?: number | null
          household_id: string
          id?: string
          month: string
          split_pct?: number | null
          user_id: string
        }
        Update: {
          category_id?: string
          fixed_amount_cad?: number | null
          household_id?: string
          id?: string
          month?: string
          split_pct?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_lines_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          archived: boolean
          bucket: Database["public"]["Enums"]["budget_bucket"] | null
          default_split: number | null
          household_id: string
          id: string
          is_rent: boolean
          kind: Database["public"]["Enums"]["category_kind"]
          name: string
          sort_order: number
        }
        Insert: {
          archived?: boolean
          bucket?: Database["public"]["Enums"]["budget_bucket"] | null
          default_split?: number | null
          household_id: string
          id?: string
          is_rent?: boolean
          kind: Database["public"]["Enums"]["category_kind"]
          name: string
          sort_order?: number
        }
        Update: {
          archived?: boolean
          bucket?: Database["public"]["Enums"]["budget_bucket"] | null
          default_split?: number | null
          household_id?: string
          id?: string
          is_rent?: boolean
          kind?: Database["public"]["Enums"]["category_kind"]
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_accounts: {
        Row: {
          autopay: boolean
          closed_on: string | null
          credit_limit: number
          current_balance: number
          due_day: number | null
          household_id: string
          id: string
          name: string
          opened_on: string | null
          statement_day: number | null
          type: Database["public"]["Enums"]["credit_type"]
          user_id: string
        }
        Insert: {
          autopay?: boolean
          closed_on?: string | null
          credit_limit?: number
          current_balance?: number
          due_day?: number | null
          household_id: string
          id?: string
          name: string
          opened_on?: string | null
          statement_day?: number | null
          type: Database["public"]["Enums"]["credit_type"]
          user_id: string
        }
        Update: {
          autopay?: boolean
          closed_on?: string | null
          credit_limit?: number
          current_balance?: number
          due_day?: number | null
          household_id?: string
          id?: string
          name?: string
          opened_on?: string | null
          statement_day?: number | null
          type?: Database["public"]["Enums"]["credit_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_accounts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_score_logs: {
        Row: {
          equifax: number | null
          hard_inquiries: number
          id: string
          month: string
          notes: string | null
          paid_on_time: number
          payments_due: number
          transunion: number | null
          user_id: string
          utilisation_at_statement: number | null
        }
        Insert: {
          equifax?: number | null
          hard_inquiries?: number
          id?: string
          month: string
          notes?: string | null
          paid_on_time?: number
          payments_due?: number
          transunion?: number | null
          user_id: string
          utilisation_at_statement?: number | null
        }
        Update: {
          equifax?: number | null
          hard_inquiries?: number
          id?: string
          month?: string
          notes?: string | null
          paid_on_time?: number
          payments_due?: number
          transunion?: number | null
          user_id?: string
          utilisation_at_statement?: number | null
        }
        Relationships: []
      }
      fx_rates: {
        Row: {
          base: string
          fetched_at: string
          id: number
          quote: string
          rate: number
          source: string
        }
        Insert: {
          base?: string
          fetched_at?: string
          id?: number
          quote?: string
          rate: number
          source: string
        }
        Update: {
          base?: string
          fetched_at?: string
          id?: number
          quote?: string
          rate?: number
          source?: string
        }
        Relationships: []
      }
      household_members: {
        Row: {
          created_at: string
          display_name: string
          household_id: string
          joint_share: number
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          household_id: string
          joint_share: number
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          household_id?: string
          joint_share?: number
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_settings: {
        Row: {
          fx_override_ngn_per_cad: number | null
          household_id: string
          max_hard_inquiries: number
          rent_total_cad: number
          statement_alert_days: number
          target_emergency: number
          target_investment: number
          target_needs: number
          updated_at: string
          util_ceiling: number
          util_ideal: number
        }
        Insert: {
          fx_override_ngn_per_cad?: number | null
          household_id: string
          max_hard_inquiries?: number
          rent_total_cad?: number
          statement_alert_days?: number
          target_emergency?: number
          target_investment?: number
          target_needs?: number
          updated_at?: string
          util_ceiling?: number
          util_ideal?: number
        }
        Update: {
          fx_override_ngn_per_cad?: number | null
          household_id?: string
          max_hard_inquiries?: number
          rent_total_cad?: number
          statement_alert_days?: number
          target_emergency?: number
          target_investment?: number
          target_needs?: number
          updated_at?: string
          util_ceiling?: number
          util_ideal?: number
        }
        Relationships: [
          {
            foreignKeyName: "household_settings_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: true
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          household_id: string
          id: string
          invited_by: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          household_id: string
          id?: string
          invited_by: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          household_id?: string
          id?: string
          invited_by?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      login_otps: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          session_id: string
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          session_id: string
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      member_private: {
        Row: {
          household_id: string
          take_home_cad: number
          updated_at: string
          user_id: string
        }
        Insert: {
          household_id: string
          take_home_cad?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          household_id?: string
          take_home_cad?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_private_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          amount_cad: number
          category_id: string
          created_at: string
          created_by: string
          currency: Database["public"]["Enums"]["currency_code"]
          description: string
          fx_ngn_per_cad: number | null
          household_id: string
          id: string
          month: string | null
          occurred_on: string
          scope: Database["public"]["Enums"]["txn_scope"]
          type: Database["public"]["Enums"]["txn_type"]
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          amount_cad: number
          category_id: string
          created_at?: string
          created_by: string
          currency?: Database["public"]["Enums"]["currency_code"]
          description?: string
          fx_ngn_per_cad?: number | null
          household_id: string
          id?: string
          month?: string | null
          occurred_on: string
          scope: Database["public"]["Enums"]["txn_scope"]
          type: Database["public"]["Enums"]["txn_type"]
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          amount_cad?: number
          category_id?: string
          created_at?: string
          created_by?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          description?: string
          fx_ngn_per_cad?: number | null
          household_id?: string
          id?: string
          month?: string | null
          occurred_on?: string
          scope?: Database["public"]["Enums"]["txn_scope"]
          type?: Database["public"]["Enums"]["txn_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      verified_sessions: {
        Row: {
          expires_at: string
          session_id: string
          user_id: string
          verified_at: string
        }
        Insert: {
          expires_at: string
          session_id: string
          user_id: string
          verified_at?: string
        }
        Update: {
          expires_at?: string
          session_id?: string
          user_id?: string
          verified_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: {
        Args: {
          p_display_name: string
          p_take_home_cad: number
          p_token: string
        }
        Returns: string
      }
      create_household: {
        Args: {
          p_display_name: string
          p_household_name?: string
          p_rent_total_cad?: number
          p_take_home_cad: number
        }
        Returns: string
      }
      ensure_budget_month: { Args: { p_month: string }; Returns: undefined }
      get_feed: {
        Args: { p_limit?: number; p_month: string; p_view?: string }
        Returns: {
          amount_cad: number
          category_name: string
          description: string
          id: string
          is_mine: boolean
          occurred_on: string
          owner_name: string
          scope: Database["public"]["Enums"]["txn_scope"]
          type: Database["public"]["Enums"]["txn_type"]
          view_amount_cad: number
        }[]
      }
      get_month_summary: {
        Args: { p_month: string; p_view?: string }
        Returns: Json
      }
      is_primary: { Args: never; Returns: boolean }
      is_session_verified: { Args: never; Returns: boolean }
      my_household_id: { Args: never; Returns: string }
      seed_household_defaults: {
        Args: { p_household: string }
        Returns: undefined
      }
      session_verified: { Args: never; Returns: boolean }
      set_joint_share: { Args: { p_primary_share: number }; Returns: undefined }
      set_partner_display_name: {
        Args: { p_display_name: string }
        Returns: undefined
      }
      cancel_invite: { Args: never; Returns: undefined }
      remove_partner: { Args: never; Returns: undefined }
      update_my_profile: {
        Args: { p_display_name: string; p_take_home_cad: number }
        Returns: undefined
      }
    }
    Enums: {
      account_type: "bank" | "credit" | "cash"
      budget_bucket: "needs" | "investment" | "emergency"
      category_kind: "fixed" | "variable" | "income"
      credit_type: "card" | "line" | "loan"
      currency_code: "CAD" | "NGN"
      member_role: "primary" | "partner"
      txn_scope: "personal" | "joint"
      txn_type: "expense" | "income" | "transfer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      account_type: ["bank", "credit", "cash"],
      budget_bucket: ["needs", "investment", "emergency"],
      category_kind: ["fixed", "variable", "income"],
      credit_type: ["card", "line", "loan"],
      currency_code: ["CAD", "NGN"],
      member_role: ["primary", "partner"],
      txn_scope: ["personal", "joint"],
      txn_type: ["expense", "income", "transfer"],
    },
  },
} as const
