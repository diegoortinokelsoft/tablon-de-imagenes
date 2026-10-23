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
      rounds: {
        Row: {
          archived_at: string | null
          closed_at: string | null
          created_at: string
          finalized_at: string | null
          id: string
          name: string
          opened_at: string | null
          status: Database["public"]["Enums"]["round_status"]
          winner_submission_id: string | null
        }
        Insert: {
          archived_at?: string | null
          closed_at?: string | null
          created_at?: string
          finalized_at?: string | null
          id?: string
          name: string
          opened_at?: string | null
          status?: Database["public"]["Enums"]["round_status"]
          winner_submission_id?: string | null
        }
        Update: {
          archived_at?: string | null
          closed_at?: string | null
          created_at?: string
          finalized_at?: string | null
          id?: string
          name?: string
          opened_at?: string | null
          status?: Database["public"]["Enums"]["round_status"]
          winner_submission_id?: string | null
        }
        Relationships: [
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
      admin_delete_archived_round: {
        Args: { p_round_id: string }
        Returns: string
      }
      admin_delete_submission: {
        Args: { p_submission_id: string }
        Returns: string
      }
      admin_finalize_round: {
        Args: { p_winner_submission_id: string }
        Returns: undefined
      }
      admin_hard_reset: { Args: { p_name: string }; Returns: string }
      admin_rename_round: { Args: { p_name: string }; Returns: undefined }
      admin_set_round_status: {
        Args: { p_status: Database["public"]["Enums"]["round_status"] }
        Returns: undefined
      }
      admin_start_new_round: { Args: { p_name: string }; Returns: string }
      assert_admin: { Args: never; Returns: undefined }
      cast_vote: { Args: { p_submission_id: string }; Returns: undefined }
      check_image_path: {
        Args: { p_image_path: string; p_round_id: string; p_uid: string }
        Returns: undefined
      }
      clean_round_name: { Args: { p_name: string }; Returns: string }
      clean_title: { Args: { p_title: string }; Returns: string }
      create_submission: {
        Args: {
          p_height: number
          p_image_path: string
          p_title: string
          p_width: number
        }
        Returns: string
      }
      current_round: {
        Args: never
        Returns: {
          archived_at: string | null
          closed_at: string | null
          created_at: string
          finalized_at: string | null
          id: string
          name: string
          opened_at: string | null
          status: Database["public"]["Enums"]["round_status"]
          winner_submission_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "rounds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_my_submission: { Args: never; Returns: string }
      hook_before_user_created: { Args: { event: Json }; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      is_allowed_email: { Args: { p_email: string }; Returns: boolean }
      is_allowed_user: { Args: never; Returns: boolean }
      remove_vote: { Args: { p_submission_id: string }; Returns: undefined }
      replace_submission_image: {
        Args: { p_height: number; p_image_path: string; p_width: number }
        Returns: string
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
      update_submission_title: { Args: { p_title: string }; Returns: undefined }
    }
    Enums: {
      round_status: "pending" | "open" | "closed" | "finalized" | "archived"
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
      round_status: ["pending", "open", "closed", "finalized", "archived"],
    },
  },
} as const
