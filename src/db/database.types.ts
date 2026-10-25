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
      board_cells: {
        Row: {
          claimed_at: string | null
          claimed_by_player_id: string | null
          id: string
          phrase: string
          position: number
          reward_id: string | null
          session_id: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_by_player_id?: string | null
          id?: string
          phrase: string
          position: number
          reward_id?: string | null
          session_id: string
        }
        Update: {
          claimed_at?: string | null
          claimed_by_player_id?: string | null
          id?: string
          phrase?: string
          position?: number
          reward_id?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_cells_claimed_by_player_id_fkey"
            columns: ["claimed_by_player_id"]
            isOneToOne: false
            referencedRelation: "session_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_cells_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_cells_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      board_lines: {
        Row: {
          axis: string
          index: number
          reward_id: string
          session_id: string
        }
        Insert: {
          axis: string
          index: number
          reward_id: string
          session_id: string
        }
        Update: {
          axis?: string
          index?: number
          reward_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_lines_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_lines_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      phrases: {
        Row: {
          created_at: string
          id: string
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          text?: string
        }
        Relationships: []
      }
      rewards: {
        Row: {
          created_at: string
          description: string
          id: string
          label: string
          slug: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          label: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          label?: string
          slug?: string
        }
        Relationships: []
      }
      session_players: {
        Row: {
          claim_token: string
          color: number
          created_at: string
          id: string
          nick: string
          session_id: string
          threshold_reward_id: string | null
        }
        Insert: {
          claim_token?: string
          color: number
          created_at?: string
          id?: string
          nick: string
          session_id: string
          threshold_reward_id?: string | null
        }
        Update: {
          claim_token?: string
          color?: number
          created_at?: string
          id?: string
          nick?: string
          session_id?: string
          threshold_reward_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_players_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_players_threshold_reward_id_fkey"
            columns: ["threshold_reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      session_reward_pool: {
        Row: {
          kind: string
          reward_id: string
          session_id: string
        }
        Insert: {
          kind: string
          reward_id: string
          session_id: string
        }
        Update: {
          kind?: string
          reward_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_reward_pool_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_reward_pool_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          code: string
          created_at: string
          gm_id: string
          id: string
          replaced_by_session_id: string | null
          size: number
          status: string
          threshold_count: number | null
        }
        Insert: {
          code: string
          created_at?: string
          gm_id: string
          id?: string
          replaced_by_session_id?: string | null
          size: number
          status?: string
          threshold_count?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          gm_id?: string
          id?: string
          replaced_by_session_id?: string | null
          size?: number
          status?: string
          threshold_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_replaced_by_session_id_fkey"
            columns: ["replaced_by_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_board_cell: {
        Args: { p_claim_token: string; p_code: string; p_position: number }
        Returns: {
          claimed_by_color: number | null
          has_reward: boolean
          occupant_color: number | null
          occupant_nick: string | null
          phrase: string
          position: number
          reward_label: string | null
          reward_slug: string | null
          status: string
        }[]
      }
      close_session_as_replaced: {
        Args: { p_replaced_by: string; p_session_id: string }
        Returns: undefined
      }
      delete_session: { Args: { p_session_id: string }; Returns: undefined }
      get_active_board_by_code: {
        Args: { p_code: string }
        Returns: {
          claimed_by_color: number | null
          code: string
          has_reward: boolean
          phrase: string
          position: number
          reward_label: string | null
          reward_slug: string | null
          size: number
          status: string
          successor_code: string | null
        }[]
      }
      get_player_reward_inputs: {
        Args: { p_claim_token: string; p_code: string }
        Returns: Json
      }
      get_session_players_by_code: {
        Args: { p_code: string }
        Returns: {
          claimed_count: number
          color: number
          created_at: string
          nick: string
          threshold_count: number | null
          threshold_reward_label: string | null
          threshold_reward_slug: string | null
        }[]
      }
      join_session_player: {
        Args: { p_claim_token?: string; p_code: string; p_nick: string }
        Returns: {
          claim_token: string
          color: number
          id: string
          nick: string
        }[]
      }
      commit_phrase_rerolls: {
        Args: { p_changes: Json; p_session_id: string }
        Returns: {
          claimed_by_color: number | null
          has_reward: boolean
          phrase: string
          position: number
          reward_label: string | null
          reward_slug: string | null
        }[]
      }
      undo_board_cell: {
        Args: { p_position: number; p_session_id: string }
        Returns: {
          claimed_by_color: number | null
          has_reward: boolean
          phrase: string
          position: number
          reward_label: string | null
          reward_slug: string | null
        }[]
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
