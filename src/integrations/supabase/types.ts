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
      analytics_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          metadata: Json | null
          path: string
          role: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          metadata?: Json | null
          path?: string
          role?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          metadata?: Json | null
          path?: string
          role?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      announcer_settings: {
        Row: {
          settings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          settings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          settings?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      athlete_notes: {
        Row: {
          athlete_key: string
          competition_id: number
          created_at: string
          event_name: string
          id: string
          note: string
          sub_category: string
          updated_at: string
          user_id: string
        }
        Insert: {
          athlete_key: string
          competition_id: number
          created_at?: string
          event_name: string
          id?: string
          note?: string
          sub_category?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          athlete_key?: string
          competition_id?: number
          created_at?: string
          event_name?: string
          id?: string
          note?: string
          sub_category?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
          result_round_name: string
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
          result_round_name?: string
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
          result_round_name?: string
          result_text?: string
          sub_category?: string
          surname?: string
          was_pb?: boolean
          wind?: number | null
        }
        Relationships: []
      }
      athlete_shares: {
        Row: {
          athlete_key: string
          created_at: string
          firstname: string
          organization: string
          organization_id: number | null
          owner_label: string
          revoked_at: string | null
          surname: string
          token: string
          user_id: string
        }
        Insert: {
          athlete_key: string
          created_at?: string
          firstname?: string
          organization?: string
          organization_id?: number | null
          owner_label?: string
          revoked_at?: string | null
          surname?: string
          token: string
          user_id: string
        }
        Update: {
          athlete_key?: string
          created_at?: string
          firstname?: string
          organization?: string
          organization_id?: number | null
          owner_label?: string
          revoked_at?: string | null
          surname?: string
          token?: string
          user_id?: string
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
      competition_plans: {
        Row: {
          allow_distance_change_same_venue: boolean
          created_at: string
          day_windows: Json | null
          default_between_heats_min: number
          default_hurdle_setup_min: number
          default_hurdle_teardown_min: number
          default_recovery_min: number
          default_setup_field_min: number
          default_setup_vertical_min: number
          ends_at: string
          group_same_event_consecutively: boolean
          id: string
          is_multi_day: boolean
          min_distance_change_gap_min: number
          name: string
          notes: string | null
          officials_changeover_min: number | null
          optimize_by_start_location: boolean
          stadium_id: string | null
          starts_at: string
          total_officials_available: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_distance_change_same_venue?: boolean
          created_at?: string
          day_windows?: Json | null
          default_between_heats_min?: number
          default_hurdle_setup_min?: number
          default_hurdle_teardown_min?: number
          default_recovery_min?: number
          default_setup_field_min?: number
          default_setup_vertical_min?: number
          ends_at: string
          group_same_event_consecutively?: boolean
          id?: string
          is_multi_day?: boolean
          min_distance_change_gap_min?: number
          name: string
          notes?: string | null
          officials_changeover_min?: number | null
          optimize_by_start_location?: boolean
          stadium_id?: string | null
          starts_at: string
          total_officials_available?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_distance_change_same_venue?: boolean
          created_at?: string
          day_windows?: Json | null
          default_between_heats_min?: number
          default_hurdle_setup_min?: number
          default_hurdle_teardown_min?: number
          default_recovery_min?: number
          default_setup_field_min?: number
          default_setup_vertical_min?: number
          ends_at?: string
          group_same_event_consecutively?: boolean
          id?: string
          is_multi_day?: boolean
          min_distance_change_gap_min?: number
          name?: string
          notes?: string | null
          officials_changeover_min?: number | null
          optimize_by_start_location?: boolean
          stadium_id?: string | null
          starts_at?: string
          total_officials_available?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_plans_stadium_id_fkey"
            columns: ["stadium_id"]
            isOneToOne: false
            referencedRelation: "stadiums"
            referencedColumns: ["id"]
          },
        ]
      }
      event_duration_overrides: {
        Row: {
          age_class: string | null
          base_min: number
          created_at: string
          event_key: string
          id: string
          notes: string | null
          per_participant_min: number
          updated_at: string
        }
        Insert: {
          age_class?: string | null
          base_min?: number
          created_at?: string
          event_key: string
          id?: string
          notes?: string | null
          per_participant_min?: number
          updated_at?: string
        }
        Update: {
          age_class?: string | null
          base_min?: number
          created_at?: string
          event_key?: string
          id?: string
          notes?: string | null
          per_participant_min?: number
          updated_at?: string
        }
        Relationships: []
      }
      event_duration_stats: {
        Row: {
          category: string
          event_name: string
          group_name: string
          id: string
          last_updated: string
          max_participants: number | null
          median_duration_min: number | null
          median_participants: number | null
          n_samples: number
          p10_duration_min: number | null
          p90_duration_min: number | null
          sub_category: string
        }
        Insert: {
          category?: string
          event_name: string
          group_name: string
          id?: string
          last_updated?: string
          max_participants?: number | null
          median_duration_min?: number | null
          median_participants?: number | null
          n_samples?: number
          p10_duration_min?: number | null
          p90_duration_min?: number | null
          sub_category?: string
        }
        Update: {
          category?: string
          event_name?: string
          group_name?: string
          id?: string
          last_updated?: string
          max_participants?: number | null
          median_duration_min?: number | null
          median_participants?: number | null
          n_samples?: number
          p10_duration_min?: number | null
          p90_duration_min?: number | null
          sub_category?: string
        }
        Relationships: []
      }
      external_competitions: {
        Row: {
          classification: string
          created_at: string
          end_date: string | null
          id: string
          last_seen_at: string
          location: string
          name: string
          organizer: string
          raw: Json | null
          registration_deadline: string
          source: string
          source_id: number
          start_date: string
          updated_at: string
          url: string
        }
        Insert: {
          classification?: string
          created_at?: string
          end_date?: string | null
          id?: string
          last_seen_at?: string
          location?: string
          name?: string
          organizer?: string
          raw?: Json | null
          registration_deadline?: string
          source?: string
          source_id: number
          start_date: string
          updated_at?: string
          url?: string
        }
        Update: {
          classification?: string
          created_at?: string
          end_date?: string | null
          id?: string
          last_seen_at?: string
          location?: string
          name?: string
          organizer?: string
          raw?: Json | null
          registration_deadline?: string
          source?: string
          source_id?: number
          start_date?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      external_harvest_state: {
        Row: {
          id: string
          last_run_at: string | null
          last_status: string
          scanned_count: number
          updated_at: string
          upserted_count: number
        }
        Insert: {
          id?: string
          last_run_at?: string | null
          last_status?: string
          scanned_count?: number
          updated_at?: string
          upserted_count?: number
        }
        Update: {
          id?: string
          last_run_at?: string | null
          last_status?: string
          scanned_count?: number
          updated_at?: string
          upserted_count?: number
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
      note_link_invites: {
        Row: {
          created_at: string
          email: string
          id: string
          inviter_user_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["note_link_invite_status"]
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          inviter_user_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["note_link_invite_status"]
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          inviter_user_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["note_link_invite_status"]
        }
        Relationships: []
      }
      note_links: {
        Row: {
          created_at: string
          id: string
          user_a_id: string
          user_b_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_a_id: string
          user_b_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_a_id?: string
          user_b_id?: string
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
      plan_conflict_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          max_concurrent: number
          name: string
          plan_id: string
          source_stadium_group_id: string | null
          updated_at: string
          venue_ids: string[]
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          max_concurrent?: number
          name: string
          plan_id: string
          source_stadium_group_id?: string | null
          updated_at?: string
          venue_ids?: string[]
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          max_concurrent?: number
          name?: string
          plan_id?: string
          source_stadium_group_id?: string | null
          updated_at?: string
          venue_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "plan_conflict_groups_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "competition_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_conflict_groups_source_stadium_group_id_fkey"
            columns: ["source_stadium_group_id"]
            isOneToOne: false
            referencedRelation: "stadium_conflict_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_events: {
        Row: {
          age_class: string
          allowed_days: string[] | null
          between_heats_min: number | null
          created_at: string
          event_name: string
          final_cut: number | null
          final_format: string
          heat_size: number
          hurdle_setup_min: number | null
          hurdle_teardown_min: number | null
          id: string
          notes: string | null
          officials_count: number | null
          officials_count_overridden: boolean
          officials_role_breakdown: Json | null
          override_duration_min: number | null
          participants: number
          plan_id: string
          setup_before_min: number | null
          sort_order: number
          station_count: number
          sub_category: string | null
          updated_at: string
        }
        Insert: {
          age_class: string
          allowed_days?: string[] | null
          between_heats_min?: number | null
          created_at?: string
          event_name: string
          final_cut?: number | null
          final_format?: string
          heat_size?: number
          hurdle_setup_min?: number | null
          hurdle_teardown_min?: number | null
          id?: string
          notes?: string | null
          officials_count?: number | null
          officials_count_overridden?: boolean
          officials_role_breakdown?: Json | null
          override_duration_min?: number | null
          participants?: number
          plan_id: string
          setup_before_min?: number | null
          sort_order?: number
          station_count?: number
          sub_category?: string | null
          updated_at?: string
        }
        Update: {
          age_class?: string
          allowed_days?: string[] | null
          between_heats_min?: number | null
          created_at?: string
          event_name?: string
          final_cut?: number | null
          final_format?: string
          heat_size?: number
          hurdle_setup_min?: number | null
          hurdle_teardown_min?: number | null
          id?: string
          notes?: string | null
          officials_count?: number | null
          officials_count_overridden?: boolean
          officials_role_breakdown?: Json | null
          override_duration_min?: number | null
          participants?: number
          plan_id?: string
          setup_before_min?: number | null
          sort_order?: number
          station_count?: number
          sub_category?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_events_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "competition_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_schedule_items: {
        Row: {
          auto_generated: boolean
          created_at: string
          ends_at: string
          id: string
          notes: string | null
          phase: string
          plan_event_id: string
          plan_id: string
          starts_at: string
          venue_id: string
        }
        Insert: {
          auto_generated?: boolean
          created_at?: string
          ends_at: string
          id?: string
          notes?: string | null
          phase?: string
          plan_event_id: string
          plan_id: string
          starts_at: string
          venue_id: string
        }
        Update: {
          auto_generated?: boolean
          created_at?: string
          ends_at?: string
          id?: string
          notes?: string | null
          phase?: string
          plan_event_id?: string
          plan_id?: string
          starts_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_schedule_items_plan_event_id_fkey"
            columns: ["plan_event_id"]
            isOneToOne: false
            referencedRelation: "plan_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_schedule_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "competition_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_schedule_items_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "plan_venues"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_venues: {
        Row: {
          created_at: string
          id: string
          included: boolean
          kind: string
          name: string
          next_to_throw_cage: boolean
          notes: string | null
          plan_id: string
          sort_order: number
          stadium_venue_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          included?: boolean
          kind?: string
          name: string
          next_to_throw_cage?: boolean
          notes?: string | null
          plan_id: string
          sort_order?: number
          stadium_venue_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          included?: boolean
          kind?: string
          name?: string
          next_to_throw_cage?: boolean
          notes?: string | null
          plan_id?: string
          sort_order?: number
          stadium_venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_venues_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "competition_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_venues_stadium_venue_id_fkey"
            columns: ["stadium_venue_id"]
            isOneToOne: false
            referencedRelation: "stadium_venues"
            referencedColumns: ["id"]
          },
        ]
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
      relay_legs: {
        Row: {
          age_class: string
          athlete_id: number | null
          athlete_key: string
          captured_at: string
          competition_id: number
          event_id: number
          event_name: string
          firstname: string
          leg_index: number
          organization: string
          organization_id: number | null
          surname: string
          team_alloc_id: number
          team_athlete_key: string
        }
        Insert: {
          age_class?: string
          athlete_id?: number | null
          athlete_key: string
          captured_at?: string
          competition_id: number
          event_id: number
          event_name?: string
          firstname: string
          leg_index: number
          organization?: string
          organization_id?: number | null
          surname: string
          team_alloc_id: number
          team_athlete_key: string
        }
        Update: {
          age_class?: string
          athlete_id?: number | null
          athlete_key?: string
          captured_at?: string
          competition_id?: number
          event_id?: number
          event_name?: string
          firstname?: string
          leg_index?: number
          organization?: string
          organization_id?: number | null
          surname?: string
          team_alloc_id?: number
          team_athlete_key?: string
        }
        Relationships: []
      }
      result_videos: {
        Row: {
          athlete_key: string
          competition_id: number
          created_at: string
          event_name: string
          id: string
          is_public: boolean
          sub_category: string
          updated_at: string
          user_id: string
          youtube_url: string
          youtube_video_id: string
        }
        Insert: {
          athlete_key: string
          competition_id: number
          created_at?: string
          event_name: string
          id?: string
          is_public?: boolean
          sub_category?: string
          updated_at?: string
          user_id: string
          youtube_url: string
          youtube_video_id: string
        }
        Update: {
          athlete_key?: string
          competition_id?: number
          created_at?: string
          event_name?: string
          id?: string
          is_public?: boolean
          sub_category?: string
          updated_at?: string
          user_id?: string
          youtube_url?: string
          youtube_video_id?: string
        }
        Relationships: []
      }
      stadium_conflict_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          max_concurrent: number
          name: string
          stadium_id: string
          updated_at: string
          venue_ids: string[]
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          max_concurrent?: number
          name: string
          stadium_id: string
          updated_at?: string
          venue_ids?: string[]
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          max_concurrent?: number
          name?: string
          stadium_id?: string
          updated_at?: string
          venue_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "stadium_conflict_groups_stadium_id_fkey"
            columns: ["stadium_id"]
            isOneToOne: false
            referencedRelation: "stadiums"
            referencedColumns: ["id"]
          },
        ]
      }
      stadium_venues: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string
          next_to_throw_cage: boolean
          notes: string | null
          sort_order: number
          stadium_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          name: string
          next_to_throw_cage?: boolean
          notes?: string | null
          sort_order?: number
          stadium_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string
          next_to_throw_cage?: boolean
          notes?: string | null
          sort_order?: number
          stadium_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stadium_venues_stadium_id_fkey"
            columns: ["stadium_id"]
            isOneToOne: false
            referencedRelation: "stadiums"
            referencedColumns: ["id"]
          },
        ]
      }
      stadiums: {
        Row: {
          created_at: string
          id: string
          location: string | null
          name: string
          notes: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      team_invites: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_by: string
          responded_at: string | null
          role: Database["public"]["Enums"]["team_role"]
          status: Database["public"]["Enums"]["team_invite_status"]
          team_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_by: string
          responded_at?: string | null
          role?: Database["public"]["Enums"]["team_role"]
          status?: Database["public"]["Enums"]["team_invite_status"]
          team_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          responded_at?: string | null
          role?: Database["public"]["Enums"]["team_role"]
          status?: Database["public"]["Enums"]["team_invite_status"]
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["team_role"]
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["team_role"]
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["team_role"]
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
      watch_shares: {
        Row: {
          competition_id: number
          created_at: string
          owner_label: string
          revoked_at: string | null
          token: string
          user_id: string
        }
        Insert: {
          competition_id: number
          created_at?: string
          owner_label?: string
          revoked_at?: string | null
          token: string
          user_id: string
        }
        Update: {
          competition_id?: number
          created_at?: string
          owner_label?: string
          revoked_at?: string | null
          token?: string
          user_id?: string
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
      welcome_messages: {
        Row: {
          body: string
          enabled: boolean
          id: string
          singleton: boolean
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: string
          enabled?: boolean
          id?: string
          singleton?: boolean
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          enabled?: boolean
          id?: string
          singleton?: boolean
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      event_pb_key: {
        Args: { age_class: string; event_name: string }
        Returns: string
      }
      event_spec_suffix: {
        Args: { age_class: string; event_name: string }
        Returns: string
      }
      fix_running_times_numeric: {
        Args: never
        Returns: {
          affected_competitions: number[]
          updated_count: number
        }[]
      }
      get_competition_structure: {
        Args: { p_competition_id: number }
        Returns: {
          age_class: string
          duration_min: number
          event_key: string
          event_name_display: string
          first_capture: string
          last_capture: string
          participants: number
        }[]
      }
      get_event_catalog: {
        Args: never
        Returns: {
          age_class: string
          event_key: string
          event_name_display: string
          sample_count: number
        }[]
      }
      get_event_catalog_full: {
        Args: never
        Returns: {
          age_class: string
          event_key: string
          event_name_display: string
          sample_count: number
        }[]
      }
      get_shared_athlete: {
        Args: { p_token: string }
        Returns: {
          athlete_key: string
          firstname: string
          organization: string
          organization_id: number
          owner_label: string
          revoked: boolean
          surname: string
        }[]
      }
      get_shared_athlete_results: {
        Args: { p_token: string }
        Returns: {
          age_class: string
          athlete_key: string
          competition_date: string
          competition_id: number
          competition_name: string
          event_category: string
          event_id: number
          event_name: string
          firstname: string
          id: string
          location: string
          organization: string
          organization_id: number
          result_numeric: number
          result_rank: number
          result_text: string
          sub_category: string
          surname: string
          was_pb: boolean
          wind: number
        }[]
      }
      get_shared_watch: {
        Args: { p_token: string }
        Returns: {
          athlete_key: string
          competition_id: number
          firstname: string
          organization: string
          organization_id: number
          owner_label: string
          revoked: boolean
          surname: string
        }[]
      }
      get_shared_watch_history: {
        Args: { p_exclude_competition_id: number; p_token: string }
        Returns: {
          age_class: string
          athlete_key: string
          competition_date: string
          event_category: string
          event_name: string
          result_numeric: number
          result_text: string
          sub_category: string
        }[]
      }
      get_user_id_by_email: { Args: { _email: string }; Returns: string }
      grant_role_by_email: {
        Args: { _email: string; _role: Database["public"]["Enums"]["app_role"] }
        Returns: string
      }
      harvest_try_lock: { Args: never; Returns: boolean }
      harvest_unlock: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_user: { Args: never; Returns: boolean }
      is_team_member: {
        Args: { _team: string; _user: string }
        Returns: boolean
      }
      is_team_owner: {
        Args: { _team: string; _user: string }
        Returns: boolean
      }
      list_auth_users: {
        Args: never
        Returns: {
          email: string
          last_sign_in_at: string
          user_id: string
        }[]
      }
      list_planner_template_competitions: {
        Args: { p_year: number }
        Returns: {
          age_class_count: number
          competition_date: string
          competition_id: number
          competition_name: string
          duration_days: number
          event_count: number
          location: string
          result_count: number
        }[]
      }
      list_role_members: {
        Args: never
        Returns: {
          created_at: string
          email: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      mark_pbs_for_competitions: {
        Args: { comp_ids: number[] }
        Returns: number
      }
      normalize_event_name: { Args: { name: string }; Returns: string }
      revoke_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      shared_note_owner_ids: { Args: { _user: string }; Returns: string[] }
      shared_team_user_ids: { Args: { _user: string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "planner"
      note_link_invite_status: "pending" | "accepted" | "declined" | "revoked"
      team_invite_status: "pending" | "accepted" | "declined" | "revoked"
      team_role: "owner" | "coach" | "member"
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
      app_role: ["admin", "planner"],
      note_link_invite_status: ["pending", "accepted", "declined", "revoked"],
      team_invite_status: ["pending", "accepted", "declined", "revoked"],
      team_role: ["owner", "coach", "member"],
    },
  },
} as const
