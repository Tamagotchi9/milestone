export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
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
      pomodoro_stats: {
        Args: { p_task_id?: string | null }
        Returns: {
          completed_today: number
          seconds_today: number
          completed_week: number
          seconds_week: number
          completed_for_task: number
          seconds_for_task: number
        }[]
      }
    }
    Enums: {
      pomodoro_session_status:
        | 'running'
        | 'paused'
        | 'completed'
        | 'abandoned'
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
