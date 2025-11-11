/**
 * API Request/Response Types
 * 
 * Type definitions for API endpoints
 */

import { z } from 'zod'

// ============================================================================
// Common Types
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
}

export interface PaginationParams {
  page?: number
  limit?: number
  offset?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// ============================================================================
// Conversation Types
// ============================================================================

export const CreateConversationSchema = z.object({
  business_type_id: z.string().uuid().optional(),
  initial_message: z.string().min(1).max(5000).optional(),
})

export type CreateConversationRequest = z.infer<typeof CreateConversationSchema>

export const UpdateConversationSchema = z.object({
  staff_id: z.string().uuid().optional(),
  status: z.enum(['active', 'waiting', 'closed']).optional(),
})

export type UpdateConversationRequest = z.infer<typeof UpdateConversationSchema>

// ============================================================================
// Message Types
// ============================================================================

export const CreateMessageSchema = z.object({
  conversation_id: z.string(), // Can be UUID or numeric ticket ID
  content: z.string().min(1).max(5000),
  message_type: z.enum(['text', 'image', 'file', 'system']).default('text'),
  metadata: z.record(z.any()).optional(),
})

export type CreateMessageRequest = z.infer<typeof CreateMessageSchema>

// ============================================================================
// File Upload Types
// ============================================================================

export const FileUploadSchema = z.object({
  reference_type: z.enum(['message', 'user_profile', 'ticket']),
  reference_id: z.string().uuid().optional(),
})

export type FileUploadRequest = z.infer<typeof FileUploadSchema>

export interface FileUploadResponse {
  id: string
  bucket_name: string
  file_path: string
  file_name: string
  file_size: number
  mime_type: string
  url: string
}

// ============================================================================
// User Profile Types
// ============================================================================

export const UpdateUserProfileSchema = z.object({
  full_name: z.string().min(1).max(255).optional(),
  avatar_url: z.string().url().optional(),
  language: z.enum(['en', 'zh-CN', 'fr', 'es', 'ru', 'pt']).optional(),
  timezone: z.string().optional(),
})

export type UpdateUserProfileRequest = z.infer<typeof UpdateUserProfileSchema>

// ============================================================================
// FAQ Types
// ============================================================================

export const SearchFAQSchema = z.object({
  query: z.string().min(1).max(200),
  locale: z.enum(['en', 'zh-CN', 'fr', 'es', 'ru', 'pt']).default('en'),
  category_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(50).default(10),
})

export type SearchFAQRequest = z.infer<typeof SearchFAQSchema>

// ============================================================================
// Webhook Types
// ============================================================================

export interface ZammadWebhookPayload {
  event: 'ticket.create' | 'ticket.update' | 'ticket.close' | 'ticket.escalation'
  ticket: {
    id: number
    number: string
    title: string
    state: string
    priority: string
    customer_id: number
    owner_id: number
    created_at: string
    updated_at: string
  }
}

// ============================================================================
// Session Types
// ============================================================================

export interface SessionInfo {
  id: string
  user_id: string
  ip_address: string | null
  user_agent: string | null
  is_active: boolean
  last_activity_at: string
  created_at: string
  expires_at: string | null
}

