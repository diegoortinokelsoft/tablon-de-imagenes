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
      access_requests: {
        Row: {
          created_at: string
          id: string
          resolved_at: string | null
          round_id: string
          status: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          resolved_at?: string | null
          round_id: string
          status?: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          resolved_at?: string | null
          round_id?: string
          status?: Database["public"]["Enums"]["request_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_requests_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admins: {
        Row: {
          email: string
        }
        Insert: {
          email: string
        }
        Update: {
          email?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      round_archives: {
        Row: {
          drive_url: string | null
          exported_at: string
          round_id: string
          snapshot: Json | null
        }
        Insert: {
          drive_url?: string | null
          exported_at?: string
          round_id: string
          snapshot?: Json | null
        }
        Update: {
          drive_url?: string | null
          exported_at?: string
          round_id?: string
          snapshot?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "round_archives_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      round_deletions: {
        Row: {
          deleted_at: string
          deleted_by: string
          round_id: string
        }
        Insert: {
          deleted_at?: string
          deleted_by: string
          round_id: string
        }
        Update: {
          deleted_at?: string
          deleted_by?: string
          round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_deletions_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      round_invites: {
        Row: {
          created_at: string
          round_id: string
          token: string
        }
        Insert: {
          created_at?: string
          round_id: string
          token?: string
        }
        Update: {
          created_at?: string
          round_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_invites_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      round_members: {
        Row: {
          joined_at: string
          round_id: string
          source: Database["public"]["Enums"]["member_source"]
          user_id: string
        }
        Insert: {
          joined_at?: string
          round_id: string
          source: Database["public"]["Enums"]["member_source"]
          user_id: string
        }
        Update: {
          joined_at?: string
          round_id?: string
          source?: Database["public"]["Enums"]["member_source"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_members_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rounds: {
        Row: {
          cleaned_at: string | null
          closed_at: string | null
          created_at: string
          finalized_at: string | null
          id: string
          last_activity_at: string
          name: string
          opened_at: string | null
          owner_id: string
          status: Database["public"]["Enums"]["round_status"]
          visibility: Database["public"]["Enums"]["round_visibility"]
          winner_submission_id: string | null
        }
        Insert: {
          cleaned_at?: string | null
          closed_at?: string | null
          created_at?: string
          finalized_at?: string | null
          id?: string
          last_activity_at?: string
          name: string
          opened_at?: string | null
          owner_id: string
          status?: Database["public"]["Enums"]["round_status"]
          visibility?: Database["public"]["Enums"]["round_visibility"]
          winner_submission_id?: string | null
        }
        Update: {
          cleaned_at?: string | null
          closed_at?: string | null
          created_at?: string
          finalized_at?: string | null
          id?: string
          last_activity_at?: string
          name?: string
          opened_at?: string | null
          owner_id?: string
          status?: Database["public"]["Enums"]["round_status"]
          visibility?: Database["public"]["Enums"]["round_visibility"]
          winner_submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rounds_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_winner_fk"
            columns: ["winner_submission_id"]
            isOneToOne: false
            referencedRelation: "board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_winner_fk"
            columns: ["winner_submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          created_at: string
          height: number | null
          id: string
          image_path: string
          round_id: string
          title: string
          updated_at: string
          user_id: string
          width: number | null
        }
        Insert: {
          created_at?: string
          height?: number | null
          id?: string
          image_path: string
          round_id: string
          title: string
          updated_at?: string
          user_id: string
          width?: number | null
        }
        Update: {
          created_at?: string
          height?: number | null
          id?: string
          image_path?: string
          round_id?: string
          title?: string
          updated_at?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          created_at: string
          id: string
          round_id: string
          submission_id: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          round_id: string
          submission_id: string
          voter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          round_id?: string
          submission_id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      board: {
        Row: {
          author_avatar: string | null
          author_name: string | null
          created_at: string | null
          height: number | null
          id: string | null
          image_path: string | null
          position: number | null
          round_id: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
          vote_count: number | null
          width: number | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vote_details: {
        Row: {
          round_id: string | null
          submission_id: string | null
          vote_count: number | null
          voter_avatar: string | null
          voter_id: string | null
          voter_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "votes_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_member: {
        Args: { p_round_id: string; p_user_id: string }
        Returns: undefined
      }
      admin_archives: {
        Args: never
        Returns: {
          cleaned_at: string
          drive_url: string
          exported_at: string
          id: string
          name: string
          owner_name: string
          visibility: Database["public"]["Enums"]["round_visibility"]
        }[]
      }
      admin_clean_round: { Args: { p_round_id: string }; Returns: string }
      admin_mark_exported: {
        Args: { p_drive_url: string; p_round_id: string }
        Returns: undefined
      }
      admin_rounds_to_archive: {
        Args: never
        Returns: {
          drive_url: string
          exported_at: string
          id: string
          last_activity_at: string
          name: string
          owner_name: string
          status: Database["public"]["Enums"]["round_status"]
          submission_count: number
          visibility: Database["public"]["Enums"]["round_visibility"]
        }[]
      }
      assert_admin: { Args: never; Returns: undefined }
      can_manage_round_files: { Args: { p_round_id: string }; Returns: boolean }
      can_view_round: { Args: { p_round_id: string }; Returns: boolean }
      cast_vote: { Args: { p_submission_id: string }; Returns: undefined }
      check_image_path: {
        Args: { p_image_path: string; p_round_id: string; p_uid: string }
        Returns: undefined
      }
      clean_round_name: { Args: { p_name: string }; Returns: string }
      clean_title: { Args: { p_title: string }; Returns: string }
      create_round: {
        Args: {
          p_name: string
          p_visibility: Database["public"]["Enums"]["round_visibility"]
        }
        Returns: string
      }
      create_submission: {
        Args: {
          p_height: number
          p_image_path: string
          p_round_id: string
          p_title: string
          p_width: number
        }
        Returns: string
      }
      delete_my_submission: { Args: { p_round_id: string }; Returns: string }
      delete_round: { Args: { p_round_id: string }; Returns: string }
      delete_submission: { Args: { p_submission_id: string }; Returns: string }
      finalize_round: {
        Args: { p_round_id: string; p_winner_submission_id: string }
        Returns: undefined
      }
      get_invite_link: { Args: { p_round_id: string }; Returns: string }
      hook_before_user_created: { Args: { event: Json }; Returns: Json }
      hub_rounds: {
        Args: never
        Returns: {
          cleaned_at: string
          cover_path: string
          created_at: string
          finalized_at: string
          id: string
          last_activity_at: string
          my_access: string
          my_involvement: boolean
          name: string
          opened_at: string
          owner_avatar: string
          owner_id: string
          owner_name: string
          participant_count: number
          pending_requests: number
          status: Database["public"]["Enums"]["round_status"]
          visibility: Database["public"]["Enums"]["round_visibility"]
          winner_author: string
          winner_title: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_allowed_email: { Args: { p_email: string }; Returns: boolean }
      is_allowed_user: { Args: never; Returns: boolean }
      is_round_owner: { Args: { p_round_id: string }; Returns: boolean }
      join_with_invite: { Args: { p_token: string }; Returns: string }
      leave_round: { Args: { p_round_id: string }; Returns: string }
      purge_participant: {
        Args: {
          p_round: Database["public"]["Tables"]["rounds"]["Row"]
          p_user_id: string
        }
        Returns: string
      }
      regenerate_invite_link: { Args: { p_round_id: string }; Returns: string }
      remove_member: {
        Args: { p_round_id: string; p_user_id: string }
        Returns: string
      }
      remove_vote: { Args: { p_submission_id: string }; Returns: undefined }
      rename_round: {
        Args: { p_name: string; p_round_id: string }
        Returns: undefined
      }
      replace_submission_image: {
        Args: {
          p_height: number
          p_image_path: string
          p_round_id: string
          p_width: number
        }
        Returns: string
      }
      request_access: { Args: { p_round_id: string }; Returns: string }
      resolve_access_request: {
        Args: { p_approve: boolean; p_request_id: string }
        Returns: undefined
      }
      round_for_owner: {
        Args: { p_round_id: string }
        Returns: {
          cleaned_at: string | null
          closed_at: string | null
          created_at: string
          finalized_at: string | null
          id: string
          last_activity_at: string
          name: string
          opened_at: string | null
          owner_id: string
          status: Database["public"]["Enums"]["round_status"]
          visibility: Database["public"]["Enums"]["round_visibility"]
          winner_submission_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "rounds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      round_for_participant: {
        Args: { p_round_id: string }
        Returns: {
          cleaned_at: string | null
          closed_at: string | null
          created_at: string
          finalized_at: string | null
          id: string
          last_activity_at: string
          name: string
          opened_at: string | null
          owner_id: string
          status: Database["public"]["Enums"]["round_status"]
          visibility: Database["public"]["Enums"]["round_visibility"]
          winner_submission_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "rounds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      round_stats: {
        Args: { p_round_id: string }
        Returns: {
          participants: number
          submissions: number
          votes: number
        }[]
      }
      set_round_status: {
        Args: {
          p_round_id: string
          p_status: Database["public"]["Enums"]["round_status"]
        }
        Returns: undefined
      }
      set_round_visibility: {
        Args: {
          p_round_id: string
          p_visibility: Database["public"]["Enums"]["round_visibility"]
        }
        Returns: undefined
      }
      sync_my_profile: {
        Args: never
        Returns: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      try_uuid: { Args: { p_text: string }; Returns: string }
      update_submission_title: {
        Args: { p_round_id: string; p_title: string }
        Returns: undefined
      }
    }
    Enums: {
      member_source: "invite_link" | "added" | "request"
      request_status: "pending" | "approved" | "rejected"
      round_status: "pending" | "open" | "closed" | "finalized"
      round_visibility: "public" | "private"
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
      member_source: ["invite_link", "added", "request"],
      request_status: ["pending", "approved", "rejected"],
      round_status: ["pending", "open", "closed", "finalized"],
      round_visibility: ["public", "private"],
    },
  },
} as const
