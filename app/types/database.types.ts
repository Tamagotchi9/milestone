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
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      habit_checkins: {
        Row: {
          completed_on: string
          created_at: string
          habit_id: string
          user_id: string
        }
        Insert: {
          completed_on: string
          created_at?: string
          habit_id: string
          user_id?: string
        }
        Update: {
          completed_on?: string
          created_at?: string
          habit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'habit_checkins_habit_owner_fkey'
            columns: ['habit_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'habits'
            referencedColumns: ['id', 'user_id']
          },
        ]
      }
      habits: {
        Row: {
          archived_on: string | null
          created_at: string
          id: string
          name: string
          starts_on: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_on?: string | null
          created_at?: string
          id?: string
          name: string
          starts_on: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          archived_on?: string | null
          created_at?: string
          id?: string
          name?: string
          starts_on?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pomodoro_sessions: {
        Row: {
          actual_seconds: number | null
          completed_at: string | null
          duration_minutes: number
          id: string
          started_at: string
          status: Database['public']['Enums']['pomodoro_session_status']
          task_id: string | null
          user_id: string
          was_completed: boolean
        }
        Insert: {
          actual_seconds?: number | null
          completed_at?: string | null
          duration_minutes?: number
          id?: string
          started_at?: string
          status?: Database['public']['Enums']['pomodoro_session_status']
          task_id?: string | null
          user_id?: string
          was_completed?: boolean
        }
        Update: {
          actual_seconds?: number | null
          completed_at?: string | null
          duration_minutes?: number
          id?: string
          started_at?: string
          status?: Database['public']['Enums']['pomodoro_session_status']
          task_id?: string | null
          user_id?: string
          was_completed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'pomodoro_sessions_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string | null
          deadline: string | null
          description: string | null
          id: string
          parent_task_id: string | null
          priority: Database['public']['Enums']['tasks_priority']
          status: Database['public']['Enums']['tasks_status']
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          parent_task_id?: string | null
          priority?: Database['public']['Enums']['tasks_priority']
          status?: Database['public']['Enums']['tasks_status']
          title: string
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          parent_task_id?: string | null
          priority?: Database['public']['Enums']['tasks_priority']
          status?: Database['public']['Enums']['tasks_status']
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tasks_parent_task_id_fkey'
            columns: ['parent_task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      habit_stats: {
        Args: {
          p_habit_id: string
          p_month_end: string
          p_month_start: string
          p_today: string
        }
        Returns: {
          completed_in_month: number
          current_streak: number
          eligible_days_in_month: number
        }[]
      }
      pomodoro_stats: {
        Args: { p_task_id?: string | null }
        Returns: {
          completed_for_task: number
          completed_today: number
          completed_week: number
          seconds_for_task: number
          seconds_today: number
          seconds_week: number
        }[]
      }
    }
    Enums: {
      pomodoro_session_status: 'running' | 'paused' | 'completed' | 'abandoned'
      tasks_priority: 'low' | 'medium' | 'high'
      tasks_status:
        | 'created'
        | 'in_progress'
        | 'completed'
        | 'on_hold'
        | 'blocked'
        | 'abandoned'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      pomodoro_session_status: ['running', 'paused', 'completed', 'abandoned'],
      tasks_priority: ['low', 'medium', 'high'],
      tasks_status: [
        'created',
        'in_progress',
        'completed',
        'on_hold',
        'blocked',
        'abandoned',
      ],
    },
  },
} as const
