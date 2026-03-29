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
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      clients: {
        Row: {
          archived: boolean
          color: string | null
          created_at: string
          email: string | null
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
          email?: string | null
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
          email?: string | null
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
          is_archived: boolean | null
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
          is_archived?: boolean | null
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
          is_archived?: boolean | null
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
            referencedRelation: "invoice_summary"
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
      expenses: {
        Row: {
          amount: number
          billable: boolean
          category: string | null
          client_id: string
          created_at: string
          date: string
          description: string
          id: string
          invoice_id: string | null
          matter_id: string
          receipt_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          billable?: boolean
          category?: string | null
          client_id: string
          created_at?: string
          date?: string
          description: string
          id?: string
          invoice_id?: string | null
          matter_id: string
          receipt_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          billable?: boolean
          category?: string | null
          client_id?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          invoice_id?: string | null
          matter_id?: string
          receipt_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_delivery_audit: {
        Row: {
          body: string
          created_at: string
          error_message: string | null
          id: string
          invoice_id: string
          metadata: Json
          pdf_path: string | null
          provider: string
          provider_message_id: string | null
          recipient_email: string
          status: string
          subject: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          error_message?: string | null
          id?: string
          invoice_id: string
          metadata?: Json
          pdf_path?: string | null
          provider?: string
          provider_message_id?: string | null
          recipient_email: string
          status: string
          subject: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          error_message?: string | null
          id?: string
          invoice_id?: string
          metadata?: Json
          pdf_path?: string | null
          provider?: string
          provider_message_id?: string | null
          recipient_email?: string
          status?: string
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_delivery_audit_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_delivery_audit_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          amount: number
          created_at: string
          date: string
          description: string
          entry_id: string | null
          expense_id: string | null
          id: string
          invoice_id: string
          line_type: string
          matter_name: string | null
          quantity: number | null
          rate: number | null
          sort_order: number
        }
        Insert: {
          amount: number
          created_at?: string
          date: string
          description: string
          entry_id?: string | null
          expense_id?: string | null
          id?: string
          invoice_id: string
          line_type: string
          matter_name?: string | null
          quantity?: number | null
          rate?: number | null
          sort_order?: number
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          description?: string
          entry_id?: string | null
          expense_id?: string | null
          id?: string
          invoice_id?: string
          line_type?: string
          matter_name?: string | null
          quantity?: number | null
          rate?: number | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "unbilled_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_sequences: {
        Row: {
          created_at: string
          next_number: number
          prefix: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          next_number?: number
          prefix?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          next_number?: number
          prefix?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          issued_date: string
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
          issued_date?: string
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
          issued_date?: string
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
      matters: {
        Row: {
          billing_type: string | null
          client_id: string
          created_at: string | null
          description: string | null
          flat_fee: number | null
          hourly_rate: number | null
          id: string
          is_pinned: boolean | null
          matter_number: string | null
          name: string
          status: string
          trust_balance: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          billing_type?: string | null
          client_id: string
          created_at?: string | null
          description?: string | null
          flat_fee?: number | null
          hourly_rate?: number | null
          id?: string
          is_pinned?: boolean | null
          matter_number?: string | null
          name: string
          status?: string
          trust_balance?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          billing_type?: string | null
          client_id?: string
          created_at?: string | null
          description?: string | null
          flat_fee?: number | null
          hourly_rate?: number | null
          id?: string
          is_pinned?: boolean | null
          matter_number?: string | null
          name?: string
          status?: string
          trust_balance?: number | null
          updated_at?: string | null
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
        ]
      }
      payments: {
        Row: {
          account_type: string
          amount: number
          created_at: string
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string
          payment_method: string
          reference_number: string | null
          status: string
          stripe_payment_intent_id: string | null
          user_id: string
        }
        Insert: {
          account_type?: string
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date?: string
          payment_method: string
          reference_number?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          user_id: string
        }
        Update: {
          account_type?: string
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          reference_number?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
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
          correction_of?: string | null
          created_at?: string
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
          correction_of?: string | null
          created_at?: string
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
            foreignKeyName: "trust_ledger_correction_of_fkey"
            columns: ["correction_of"]
            isOneToOne: false
            referencedRelation: "trust_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trust_ledger_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_summary"
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
      user_settings: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          attorney_name: string | null
          bar_number: string | null
          billing_increment: number | null
          city: string | null
          created_at: string
          default_rate: number | null
          default_tax_rate: number | null
          email_body_template: string | null
          email_from_address: string | null
          email_from_name: string | null
          email_subject_template: string | null
          firm_name: string | null
          invoice_notes: string | null
          logo_url: string | null
          pass_fees_to_client: boolean | null
          payment_terms: string | null
          phone: string | null
          reply_to_email: string | null
          rounding_rule: string | null
          state: string | null
          stripe_connected: boolean | null
          stripe_publishable_key: string | null
          timekeeper_classification: string | null
          updated_at: string
          user_id: string
          zip: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          attorney_name?: string | null
          bar_number?: string | null
          billing_increment?: number | null
          city?: string | null
          created_at?: string
          default_rate?: number | null
          default_tax_rate?: number | null
          email_body_template?: string | null
          email_from_address?: string | null
          email_from_name?: string | null
          email_subject_template?: string | null
          firm_name?: string | null
          invoice_notes?: string | null
          logo_url?: string | null
          pass_fees_to_client?: boolean | null
          payment_terms?: string | null
          phone?: string | null
          reply_to_email?: string | null
          rounding_rule?: string | null
          state?: string | null
          stripe_connected?: boolean | null
          stripe_publishable_key?: string | null
          timekeeper_classification?: string | null
          updated_at?: string
          user_id: string
          zip?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          attorney_name?: string | null
          bar_number?: string | null
          billing_increment?: number | null
          city?: string | null
          created_at?: string
          default_rate?: number | null
          default_tax_rate?: number | null
          email_body_template?: string | null
          email_from_address?: string | null
          email_from_name?: string | null
          email_subject_template?: string | null
          firm_name?: string | null
          invoice_notes?: string | null
          logo_url?: string | null
          pass_fees_to_client?: boolean | null
          payment_terms?: string | null
          phone?: string | null
          reply_to_email?: string | null
          rounding_rule?: string | null
          state?: string | null
          stripe_connected?: boolean | null
          stripe_publishable_key?: string | null
          timekeeper_classification?: string | null
          updated_at?: string
          user_id?: string
          zip?: string | null
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
          issued_date: string | null
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
        Relationships: [
          {
            foreignKeyName: "trust_ledger_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
      trust_balance_by_client: {
        Row: {
          client_id: string | null
          matter_count: number | null
          total_trust_balance: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trust_ledger_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "trust_ledger_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
          is_archived: boolean | null
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
            referencedRelation: "invoice_summary"
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
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "trust_ledger"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_invoice_from_entries:
        | {
            Args: {
              p_client_id: string
              p_due_date?: string
              p_entry_ids?: string[]
              p_expense_ids?: string[]
              p_auto_apply_trust?: boolean
              p_issued_date?: string
              p_matter_id?: string
              p_notes?: string
              p_payment_terms?: string
              p_tax_rate?: number
              p_user_id: string
            }
            Returns: {
              amount_paid: number
              balance_due: number
              client_id: string
              created_at: string
              date_range_end: string | null
              date_range_start: string | null
              due_date: string
              id: string
              invoice_number: string
              issued_date: string
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
            SetofOptions: {
              from: "*"
              to: "invoices"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_auto_apply_trust?: boolean
              p_client_id: string
              p_due_date?: string
              p_entry_ids?: string[]
              p_issued_date?: string
              p_matter_id?: string
              p_notes?: string
              p_payment_terms?: string
              p_tax_rate?: number
              p_user_id: string
            }
            Returns: {
              amount_paid: number
              balance_due: number
              client_id: string
              created_at: string
              date_range_end: string | null
              date_range_start: string | null
              due_date: string
              id: string
              invoice_number: string
              issued_date: string
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
            SetofOptions: {
              from: "*"
              to: "invoices"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      get_next_invoice_number: { Args: { p_user_id: string }; Returns: string }
      migrate_existing_entries_to_matters: { Args: never; Returns: undefined }
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
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "trust_ledger"
          isOneToOne: true
          isSetofReturn: false
        }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
