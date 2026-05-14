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
      athlete_results: {
        Row: {
          age_class: string
          athlete_key: string
          captured_at: string
          competition_date: string | null
          competition_id: number
          competition_name: string
          event_category: string
          event_id: number
          event_name: string
          firstname: string
          id: string
          location: string
          organization: string
          organization_id: number | null
          result_numeric: number | null
          result_rank: number | null
          result_text: string
          sub_category: string
          surname: string
          was_pb: boolean
          wind: number | null
        }
        Insert: {
          age_class?: string
          athlete_key: string
          captured_at?: string
          competition_date?: string | null
          competition_id: number
          competition_name?: string
          event_category?: string
          event_id: number
          event_name?: string
          firstname: string
          id?: string
          location?: string
          organization?: string
          organization_id?: number | null
          result_numeric?: number | null
          result_rank?: number | null
          result_text?: string
          sub_category?: string
          surname: string
          was_pb?: boolean
          wind?: number | null
        }
        Update: {
          age_class?: string
          athlete_key?: string
          captured_at?: string
          competition_date?: string | null
          competition_id?: number
          competition_name?: string
          event_category?: string
          event_id?: number
          event_name?: string
          firstname?: string
          id?: string
          location?: string
          organization?: string
          organization_id?: number | null
          result_numeric?: number | null
          result_rank?: number | null
          result_text?: string
          sub_category?: string
          surname?: string
          was_pb?: boolean
          wind?: number | null
        }
        Relationships: []
      }
      competition_locations: {
        Row: {
          competition_id: number
          lat: number | null
          lng: number | null
          location: string
          updated_at: string
        }
        Insert: {
          competition_id: number
          lat?: number | null
          lng?: number | null
          location?: string
          updated_at?: string
        }
        Update: {
          competition_id?: number
          lat?: number | null
          lng?: number | null
          location?: string
          updated_at?: string
        }
        Relationships: []
      }
      harvest_competitions: {
        Row: {
          competition_date: string | null
          competition_id: number
          done: boolean
          exists_in_source: boolean
          last_scanned_at: string
          row_count: number
        }
        Insert: {
          competition_date?: string | null
          competition_id: number
          done?: boolean
          exists_in_source?: boolean
          last_scanned_at?: string
          row_count?: number
        }
        Update: {
          competition_date?: string | null
          competition_id?: number
          done?: boolean
          exists_in_source?: boolean
          last_scanned_at?: string
          row_count?: number
        }
        Relationships: []
      }
      harvest_state: {
        Row: {
          id: string
          last_run_at: string | null
          latest_id: number
          next_id: number
          updated_at: string
        }
        Insert: {
          id?: string
          last_run_at?: string | null
          latest_id?: number
          next_id?: number
          updated_at?: string
        }
        Update: {
          id?: string
          last_run_at?: string | null
          latest_id?: number
          next_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      organization_locations: {
        Row: {
          city: string
          lat: number | null
          lng: number | null
          organization_id: number
          organization_name: string
          updated_at: string
        }
        Insert: {
          city?: string
          lat?: number | null
          lng?: number | null
          organization_id: number
          organization_name?: string
          updated_at?: string
        }
        Update: {
          city?: string
          lat?: number | null
          lng?: number | null
          organization_id?: number
          organization_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      record_baseline: {
        Row: {
          athlete_id: number
          captured_at: string
          competition_id: number
          event_id: number
          pb: string
          sb: string
        }
        Insert: {
          athlete_id: number
          captured_at?: string
          competition_id: number
          event_id: number
          pb?: string
          sb?: string
        }
        Update: {
          athlete_id?: number
          captured_at?: string
          competition_id?: number
          event_id?: number
          pb?: string
          sb?: string
        }
        Relationships: []
      }
      watched_athletes: {
        Row: {
          athlete_key: string
          created_at: string
          firstname: string
          id: string
          organization: string
          organization_id: number | null
          surname: string
          user_id: string
        }
        Insert: {
          athlete_key: string
          created_at?: string
          firstname: string
          id?: string
          organization?: string
          organization_id?: number | null
          surname: string
          user_id: string
        }
        Update: {
          athlete_key?: string
          created_at?: string
          firstname?: string
          id?: string
          organization?: string
          organization_id?: number | null
          surname?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      harvest_try_lock: { Args: never; Returns: boolean }
      harvest_unlock: { Args: never; Returns: undefined }
      mark_pbs_for_competitions: {
        Args: { comp_ids: number[] }
        Returns: number
      }
      normalize_event_name: { Args: { name: string }; Returns: string }
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
