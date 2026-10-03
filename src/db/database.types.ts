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
        }
        Insert: {
          claim_token?: string
          color: number
          created_at?: string
          id?: string
          nick: string
          session_id: string
        }
        Update: {
          claim_token?: string
          color?: number
          created_at?: string
          id?: string
          nick?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_players_session_id_fkey"
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
          size: number
          status: string
        }
        Insert: {
          code: string
          created_at?: string
          gm_id: string
          id?: string
          size: number
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          gm_id?: string
          id?: string
          size?: number
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_board_cell: {
        Args: {
          p_code: string
          p_claim_token: string
          p_position: number
        }
        Returns: {
          status: string
          position: number
          phrase: string
          has_reward: boolean
          reward_slug: string | null
          reward_label: string | null
          claimed_by_color: number | null
          occupant_nick: string | null
          occupant_color: number | null
        }[]
      }
      get_active_board_by_code: {
        Args: {
          p_code: string
        }
        Returns: {
          code: string
          size: number
          position: number
          phrase: string
          has_reward: boolean
          reward_slug: string | null
          reward_label: string | null
          claimed_by_color: number | null
        }[]
      }
      get_session_players_by_code: {
        Args: {
          p_code: string
        }
        Returns: {
          nick: string
          color: number
          created_at: string
        }[]
      }
      join_session_player: {
        Args: {
          p_code: string
          p_nick: string
          p_claim_token?: string
        }
        Returns: {
          id: string
          claim_token: string
          color: number
          nick: string
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
  public: {
    Enums: {},
  },
} as const
