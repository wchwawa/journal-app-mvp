export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '12.2.12 (cd3cf9e)';
  };
  public: {
    Tables: {
      audio_files: {
        Row: {
          created_at: string | null;
          duration_ms: number | null;
          id: string;
          mime_type: string | null;
          storage_path: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          duration_ms?: number | null;
          id?: string;
          mime_type?: string | null;
          storage_path: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          duration_ms?: number | null;
          id?: string;
          mime_type?: string | null;
          storage_path?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      daily_question: {
        Row: {
          created_at: string | null;
          day_quality: string;
          emotions: string[];
          id: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          day_quality: string;
          emotions?: string[];
          id?: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          day_quality?: string;
          emotions?: string[];
          id?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      daily_summaries: {
        Row: {
          achievements: string[] | null;
          commitments: string[] | null;
          created_at: string | null;
          date: string;
          dominant_emotions: string[] | null;
          edited: boolean | null;
          entry_count: number | null;
          flashback: string | null;
          gen_version: string | null;
          id: string;
          last_generated_at: string | null;
          mood_overall: string | null;
          mood_quality: string | null;
          mood_reason: string | null;
          stats: Json | null;
          summary: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          achievements?: string[] | null;
          commitments?: string[] | null;
          created_at?: string | null;
          date: string;
          dominant_emotions?: string[] | null;
          edited?: boolean | null;
          entry_count?: number | null;
          flashback?: string | null;
          gen_version?: string | null;
          id?: string;
          last_generated_at?: string | null;
          mood_overall?: string | null;
          mood_quality?: string | null;
          mood_reason?: string | null;
          stats?: Json | null;
          summary: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          achievements?: string[] | null;
          commitments?: string[] | null;
          created_at?: string | null;
          date?: string;
          dominant_emotions?: string[] | null;
          edited?: boolean | null;
          entry_count?: number | null;
          flashback?: string | null;
          gen_version?: string | null;
          id?: string;
          last_generated_at?: string | null;
          mood_overall?: string | null;
          mood_quality?: string | null;
          mood_reason?: string | null;
          stats?: Json | null;
          summary?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      period_reflections: {
        Row: {
          achievements: string[] | null;
          commitments: string[] | null;
          created_at: string | null;
          edited: boolean | null;
          flashback: string | null;
          gen_version: string | null;
          id: string;
          last_generated_at: string | null;
          mood_overall: string | null;
          mood_reason: string | null;
          period_end: string;
          period_start: string;
          period_type: string;
          stats: Json | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          achievements?: string[] | null;
          commitments?: string[] | null;
          created_at?: string | null;
          edited?: boolean | null;
          flashback?: string | null;
          gen_version?: string | null;
          id?: string;
          last_generated_at?: string | null;
          mood_overall?: string | null;
          mood_reason?: string | null;
          period_end: string;
          period_start: string;
          period_type: string;
          stats?: Json | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          achievements?: string[] | null;
          commitments?: string[] | null;
          created_at?: string | null;
          edited?: boolean | null;
          flashback?: string | null;
          gen_version?: string | null;
          id?: string;
          last_generated_at?: string | null;
          mood_overall?: string | null;
          mood_reason?: string | null;
          period_end?: string;
          period_start?: string;
          period_type?: string;
          stats?: Json | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      transcripts: {
        Row: {
          audio_id: string;
          created_at: string | null;
          id: string;
          language: string | null;
          rephrased_text: string | null;
          text: string | null;
          user_id: string;
        };
        Insert: {
          audio_id: string;
          created_at?: string | null;
          id?: string;
          language?: string | null;
          rephrased_text?: string | null;
          text?: string | null;
          user_id: string;
        };
        Update: {
          audio_id?: string;
          created_at?: string | null;
          id?: string;
          language?: string | null;
          rephrased_text?: string | null;
          text?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'transcripts_audio_id_fkey';
            columns: ['audio_id'];
            isOneToOne: false;
            referencedRelation: 'audio_files';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {}
  }
} as const;
