/**
 * Database Types
 *
 * Type definitions for the database schema.
 * These represent the data structures we would use with a real database.
 * Currently using mock data storage in-memory.
 * Based on the database design v2.2
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      business_types: {
        Row: {
          id: string
          name: string
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      user_profiles: {
        Row: {
          id: string
          user_id: string
          full_name: string | null
          avatar_url: string | null
          role: 'customer' | 'staff' | 'admin'
          language: 'en' | 'zh-CN' | 'fr' | 'es' | 'ru' | 'pt'
          timezone: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          full_name?: string | null
          avatar_url?: string | null
          role?: 'customer' | 'staff' | 'admin'
          language?: 'en' | 'zh-CN' | 'fr' | 'es' | 'ru' | 'pt'
          timezone?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          full_name?: string | null
          avatar_url?: string | null
          role?: 'customer' | 'staff' | 'admin'
          language?: 'en' | 'zh-CN' | 'fr' | 'es' | 'ru' | 'pt'
          timezone?: string
          created_at?: string
          updated_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          customer_id: string
          staff_id: string | null
          business_type_id: string | null
          status: 'active' | 'waiting' | 'closed'
          message_count: number
          last_message_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          staff_id?: string | null
          business_type_id?: string | null
          status?: 'active' | 'waiting' | 'closed'
          message_count?: number
          last_message_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          staff_id?: string | null
          business_type_id?: string | null
          status?: 'active' | 'waiting' | 'closed'
          message_count?: number
          last_message_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          content: string
          message_type: 'text' | 'image' | 'file' | 'system'
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          content: string
          message_type?: 'text' | 'image' | 'file' | 'system'
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string
          content?: string
          message_type?: 'text' | 'image' | 'file' | 'system'
          metadata?: Json
          created_at?: string
        }
      }
      zammad_sync: {
        Row: {
          id: string
          conversation_id: string
          zammad_ticket_id: number
          zammad_ticket_number: string | null
          status: string | null
          synced_at: string
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          zammad_ticket_id: number
          zammad_ticket_number?: string | null
          status?: string | null
          synced_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          zammad_ticket_id?: number
          zammad_ticket_number?: string | null
          status?: string | null
          synced_at?: string
          created_at?: string
        }
      }
      faq_categories: {
        Row: {
          id: string
          parent_id: string | null
          i18n_key: string
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          parent_id?: string | null
          i18n_key: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          parent_id?: string | null
          i18n_key?: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      faq_items: {
        Row: {
          id: string
          category_id: string
          i18n_key: string
          sort_order: number
          view_count: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          category_id: string
          i18n_key: string
          sort_order?: number
          view_count?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          category_id?: string
          i18n_key?: string
          sort_order?: number
          view_count?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      faq_translations: {
        Row: {
          id: string
          faq_item_id: string
          locale: 'en' | 'zh-CN' | 'fr' | 'es' | 'ru' | 'pt'
          title: string
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          faq_item_id: string
          locale: 'en' | 'zh-CN' | 'fr' | 'es' | 'ru' | 'pt'
          title: string
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          faq_item_id?: string
          locale?: 'en' | 'zh-CN' | 'fr' | 'es' | 'ru' | 'pt'
          title?: string
          content?: string
          created_at?: string
          updated_at?: string
        }
      }
      keywords: {
        Row: {
          id: string
          faq_item_id: string
          keyword: string
          locale: 'en' | 'zh-CN' | 'fr' | 'es' | 'ru' | 'pt'
          created_at: string
        }
        Insert: {
          id?: string
          faq_item_id: string
          keyword: string
          locale: 'en' | 'zh-CN' | 'fr' | 'es' | 'ru' | 'pt'
          created_at?: string
        }
        Update: {
          id?: string
          faq_item_id?: string
          keyword?: string
          locale?: 'en' | 'zh-CN' | 'fr' | 'es' | 'ru' | 'pt'
          created_at?: string
        }
      }
      customer_tags: {
        Row: {
          id: string
          customer_id: string
          tag: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          tag: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          tag?: string
          created_by?: string | null
          created_at?: string
        }
      }
      file_references: {
        Row: {
          id: string
          bucket_name: string
          file_path: string
          file_name: string
          file_size: number | null
          mime_type: string | null
          reference_type: 'message' | 'user_profile' | 'ticket'
          reference_id: string | null
          uploaded_by: string
          created_at: string
        }
        Insert: {
          id?: string
          bucket_name: string
          file_path: string
          file_name: string
          file_size?: number | null
          mime_type?: string | null
          reference_type: 'message' | 'user_profile' | 'ticket'
          reference_id?: string | null
          uploaded_by: string
          created_at?: string
        }
        Update: {
          id?: string
          bucket_name?: string
          file_path?: string
          file_name?: string
          file_size?: number | null
          mime_type?: string | null
          reference_type?: 'message' | 'user_profile' | 'ticket'
          reference_id?: string | null
          uploaded_by?: string
          created_at?: string
        }
      }
      webhook_logs: {
        Row: {
          id: string
          event_type: string
          zammad_ticket_id: number | null
          payload: Json
          processed: boolean
          error_message: string | null
          created_at: string
          processed_at: string | null
        }
        Insert: {
          id?: string
          event_type: string
          zammad_ticket_id?: number | null
          payload: Json
          processed?: boolean
          error_message?: string | null
          created_at?: string
          processed_at?: string | null
        }
        Update: {
          id?: string
          event_type?: string
          zammad_ticket_id?: number | null
          payload?: Json
          processed?: boolean
          error_message?: string | null
          created_at?: string
          processed_at?: string | null
        }
      }
      user_sessions: {
        Row: {
          id: string
          user_id: string
          session_token: string | null
          ip_address: string | null
          user_agent: string | null
          is_active: boolean
          last_activity_at: string
          created_at: string
          expires_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          session_token?: string | null
          ip_address?: string | null
          user_agent?: string | null
          is_active?: boolean
          last_activity_at?: string
          created_at?: string
          expires_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          session_token?: string | null
          ip_address?: string | null
          user_agent?: string | null
          is_active?: boolean
          last_activity_at?: string
          created_at?: string
          expires_at?: string | null
        }
      }
      notification_preferences: {
        Row: {
          id: string
          user_id: string
          email_notifications: boolean
          push_notifications: boolean
          sms_notifications: boolean
          notification_types: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email_notifications?: boolean
          push_notifications?: boolean
          sms_notifications?: boolean
          notification_types?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          email_notifications?: boolean
          push_notifications?: boolean
          sms_notifications?: boolean
          notification_types?: Json
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

