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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          archived: boolean
          color: string | null
          created_at: string
          hourly_rate: number
          id: string
          name: string
          notes: string | null
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string | null
          created_at?: string
          hourly_rate?: number
          id?: string
          name: string
          notes?: string | null
          user_id: string
        }
        Update: {
          archived?: boolean
          color?: string | null
          created_at?: string
          hourly_rate?: number
          id?: string
          name?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      entries: {
        Row: {
          archived: boolean
          billed: boolean
          client_id: string
          created_at: string
          duration_sec: number | null
          end_at: string | null
          id: string
          invoice_id: string | null
          matter_id: string | null
          notes: string | null
          paused_at: string | null
          start_at: string
          total_paused_seconds: number | null
          user_id: string
        }
        Insert: {
          archived?: boolean
          billed?: boolean
          client_id: string
          created_at?: string
          duration_sec?: number | null
          end_at?: string | null
          id?: string
          invoice_id?: string | null
          matter_id?: string | null
          notes?: string | null
          paused_at?: string | null
          start_at: string
          total_paused_seconds?: number | null
          user_id: string
        }
        Update: {
          archived?: boolean
          billed?: boolean
          client_id?: string
          created_at?: string
          duration_sec?: number | null
          end_at?: string | null
          id?: string
          invoice_id?: string | null
          matter_id?: string | null
          notes?: string | null
          paused_at?: string | null
          start_at?: string
          total_paused_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          balance_due: number
          client_id: string
          created_at: string
          date_range_end: string | null
          date_range_start: string | null
          due_date: string
          id: string
          invoice_number: string
          matter_id: string | null
          notes: string | null
          paid_at: string | null
          payment_link: string | null
          payment_terms: string | null
          pdf_url: string | null
          sent_at: string | null
          status: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          trust_applied: number
          updated_at: string
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          amount_paid?: number
          balance_due?: number
          client_id: string
          created_at?: string
          date_range_end?: string | null
          date_range_start?: string | null
          due_date?: string
          id?: string
          invoice_number: string
          matter_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_link?: string | null
          payment_terms?: string | null
          pdf_url?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          trust_applied?: number
          updated_at?: string
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          amount_paid?: number
          balance_due?: number
          client_id?: string
          created_at?: string
          date_range_end?: string | null
          date_range_start?: string | null
          due_date?: string
          id?: string
          invoice_number?: string
          matter_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_link?: string | null
          payment_terms?: string | null
          pdf_url?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          trust_applied?: number
          updated_at?: string
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      trust_ledger: {
        Row: {
          amount: number
          client_id: string
          correction_of: string | null
          created_at: string
          description: string
          id: string
          invoice_id: string | null
          matter_id: string
          payor_payee: string | null
          reconciled: boolean
          reconciled_at: string | null
          reconciled_by: string | null
          reference_number: string | null
          running_balance: number
          transaction_date: string
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          correction_of?: string | null
          description: string
          id?: string
          invoice_id?: string | null
          matter_id: string
          payor_payee?: string | null
          reconciled?: boolean
          reconciled_at?: string | null
          reconciled_by?: string | null
          reference_number?: string | null
          running_balance: number
          transaction_date?: string
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          correction_of?: string | null
          description?: string
          id?: string
          invoice_id?: string | null
          matter_id?: string
          payor_payee?: string | null
          reconciled?: boolean
          reconciled_at?: string | null
          reconciled_by?: string | null
          reference_number?: string | null
          running_balance?: number
          transaction_date?: string
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trust_ledger_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trust_ledger_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trust_ledger_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      matters: {
        Row: {
          billing_type: string | null
          client_id: string
          created_at: string
          description: string | null
          flat_fee: number | null
          hourly_rate: number | null
          id: string
          matter_number: string | null
          name: string
          status: string
          trust_balance: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_type?: string | null
          client_id: string
          created_at?: string
          description?: string | null
          flat_fee?: number | null
          hourly_rate?: number | null
          id?: string
          matter_number?: string | null
          name: string
          status?: string
          trust_balance?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_type?: string | null
          client_id?: string
          created_at?: string
          description?: string | null
          flat_fee?: number | null
          hourly_rate?: number | null
          id?: string
          matter_number?: string | null
          name?: string
          status?: string
          trust_balance?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matters_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      invoice_summary: {
        Row: {
          amount_paid: number | null
          balance_due: number | null
          client_id: string | null
          client_name: string | null
          created_at: string | null
          date_range_end: string | null
          date_range_start: string | null
          due_date: string | null
          id: string | null
          invoice_number: string | null
          line_item_count: number | null
          matter_id: string | null
          matter_name: string | null
          notes: string | null
          paid_at: string | null
          payment_count: number | null
          payment_link: string | null
          payment_terms: string | null
          pdf_url: string | null
          sent_at: string | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          tax_rate: number | null
          total: number | null
          trust_applied: number | null
          updated_at: string | null
          user_id: string | null
          viewed_at: string | null
        }
        Relationships: []
      }
      trust_balance_by_client: {
        Row: {
          client_id: string | null
          matter_count: number | null
          total_trust_balance: number | null
          user_id: string | null
        }
        Relationships: []
      }
      trust_balance_by_matter: {
        Row: {
          client_id: string | null
          current_balance: number | null
          last_transaction_at: string | null
          last_transaction_date: string | null
          matter_id: string | null
          user_id: string | null
        }
        Relationships: []
      }
      trust_activity_summary: {
        Row: {
          client_id: string | null
          matter_id: string | null
          month: string | null
          total_amount: number | null
          transaction_count: number | null
          transaction_type: string | null
          user_id: string | null
        }
        Relationships: []
      }
      unbilled_entries: {
        Row: {
          archived: boolean | null
          billed: boolean | null
          billed_hours: number | null
          client_id: string | null
          client_name: string | null
          client_rate: number | null
          created_at: string | null
          duration_sec: number | null
          effective_rate: number | null
          end_at: string | null
          id: string | null
          invoice_id: string | null
          matter_id: string | null
          matter_name: string | null
          matter_number: string | null
          matter_rate: number | null
          notes: string | null
          paused_at: string | null
          start_at: string | null
          total_paused_seconds: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_trust_to_invoice: {
        Args: {
          p_amount: number
          p_description?: string
          p_invoice_id: string
          p_reference?: string
          p_transaction_date?: string
          p_user_id: string
        }
        Returns: Database["public"]["Tables"]["trust_ledger"]["Row"]
      }
      migrate_existing_entries_to_matters: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      record_trust_transaction: {
        Args: {
          p_amount: number
          p_client_id: string
          p_correction_of?: string
          p_description: string
          p_invoice_id?: string
          p_matter_id: string
          p_payor_payee?: string
          p_reference?: string
          p_transaction_date?: string
          p_type: string
          p_user_id: string
        }
        Returns: Database["public"]["Tables"]["trust_ledger"]["Row"]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
