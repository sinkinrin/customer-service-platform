/**
 * Zammad API Types
 * 
 * TypeScript type definitions for Zammad API
 */

// ============================================================================
// Ticket Types
// ============================================================================

export interface ZammadTicket {
  id: number
  group_id: number
  priority_id: number
  state_id: number
  organization_id: number | null
  number: string
  title: string
  owner_id: number | null
  customer_id: number
  note: string | null
  first_response_at: string | null
  first_response_escalation_at: string | null
  first_response_in_min: number | null
  first_response_diff_in_min: number | null
  close_at: string | null
  close_escalation_at: string | null
  close_in_min: number | null
  close_diff_in_min: number | null
  update_escalation_at: string | null
  update_in_min: number | null
  update_diff_in_min: number | null
  last_contact_at: string | null
  last_contact_agent_at: string | null
  last_contact_customer_at: string | null
  last_owner_update_at: string | null
  create_article_type_id: number
  create_article_sender_id: number
  article_count: number
  escalation_at: string | null
  pending_time: string | null
  type: string | null
  time_unit: string | null
  preferences: Record<string, any>
  updated_by_id: number
  created_by_id: number
  created_at: string
  updated_at: string
  article_ids?: number[]
  ticket_time_accounting_ids?: number[]
}

export interface CreateTicketRequest {
  title: string
  group: string
  group_id?: number
  customer?: string
  customer_id?: number
  priority_id?: number
  state_id?: number
  article: {
    subject: string
    body: string
    type: string
    internal: boolean
    sender?: 'Customer' | 'Agent' | 'System'
    origin_by_id?: number // Zammad user ID who actually wrote the article
    attachments?: {
      filename: string
      data: string // base64 encoded
      'mime-type': string
    }[]
    // Reference pre-uploaded attachments by ID
    attachment_ids?: number[]
    // Reference cached form uploads from upload_caches API
    form_id?: string
  }
  mentions?: number[]
}

export interface UpdateTicketRequest {
  title?: string
  group?: string
  state?: string
  priority?: string
  owner_id?: number
  pending_time?: string // ISO 8601 datetime string (required for pending states)
  article?: {
    subject: string
    body: string
    internal: boolean
  }
}

// ============================================================================
// Article Types
// ============================================================================

export interface ZammadArticle {
  id: number
  ticket_id: number
  type_id: number
  sender_id: number
  from: string
  to: string | null
  cc: string | null
  subject: string | null
  reply_to: string | null
  message_id: string | null
  message_id_md5: string | null
  in_reply_to: string | null
  content_type: string
  references: string | null
  body: string
  internal: boolean
  preferences: Record<string, any>
  updated_by_id: number
  created_by_id: number
  origin_by_id: number | null
  created_at: string
  updated_at: string
  attachments: ZammadAttachment[]
  type: string
  sender: string
  created_by: string
  updated_by: string
  time_unit: string | null
}

export interface CreateArticleRequest {
  ticket_id: number
  subject?: string
  body: string
  content_type: string
  type: string  // 'note' = internal, 'email' = send email to customer
  internal: boolean
  sender?: string  // 'Agent' | 'Customer' | 'System'
  to?: string  // Required for type='email', recipient email address
  cc?: string  // Optional CC recipients
  time_unit?: string
  // Method 1: Base64 embedded attachments (legacy, higher bandwidth)
  attachments?: {
    filename: string
    data: string // base64 encoded
    'mime-type': string
  }[]
  // Method 2: Reference pre-uploaded attachments by ID (recommended)
  // Use zammadClient.uploadAttachment() first, then pass the IDs here
  attachment_ids?: number[]
  // Method 3: Reference cached form uploads (Zammad's upload_caches)
  // Use the same form_id that was passed to uploadAttachment()
  form_id?: string
  origin_by_id?: number
}

// Response from Zammad attachment upload API
export interface ZammadUploadResponse {
  id: number
  store_id?: number
  filename?: string
}

export interface ZammadAttachment {
  id: number
  filename: string
  size: string
  preferences: {
    'Content-Type': string
    'Mime-Type': string
    'Content-ID'?: string
    'Content-Disposition'?: string
  }
}

// ============================================================================
// Tag Types
// ============================================================================

export interface ZammadTagsResponse {
  tags: string[]
}

export interface AddTagRequest {
  item: string
  object: 'Ticket'
  o_id: number
}

export interface RemoveTagRequest {
  item: string
  object: 'Ticket'
  o_id: number
}

// ============================================================================
// SLA Types
// ============================================================================

export interface ZammadSLA {
  id: number
  calendar_id: number
  name: string
  first_response_time: number
  response_time: number | null
  update_time: number
  solution_time: number
  condition: Record<string, any>
  updated_by_id: number
  created_by_id: number
  created_at: string
  updated_at: string
}

export interface CreateSLARequest {
  name: string
  first_response_time: string
  response_time?: string
  update_time: string
  solution_time: string
  condition: Record<string, any>
  calendar_id: string
}

// ============================================================================
// User Types
// ============================================================================

export interface ZammadUser {
  id: number
  organization_id: number | null
  login: string
  firstname: string
  lastname: string
  email: string
  image: string | null
  image_source: string | null
  web: string
  phone: string
  fax: string
  mobile: string
  department: string
  street: string
  zip: string
  city: string
  country: string
  address: string
  vip: boolean
  verified: boolean
  active: boolean
  note: string
  last_login: string | null
  source: string | null
  login_failed: number
  out_of_office: boolean
  out_of_office_start_at: string | null
  out_of_office_end_at: string | null
  out_of_office_replacement_id: number | null
  preferences: Record<string, any>
  updated_by_id: number
  created_by_id: number
  created_at: string
  updated_at: string
  role_ids?: number[]
  roles?: string[]
  group_ids?: Record<string, string[]>
}

export interface CreateUserRequest {
  login: string
  email: string
  firstname: string
  lastname: string
  roles: string[]
  password?: string
  verified?: boolean
  active?: boolean
  organization_id?: number
  phone?: string
  mobile?: string
  note?: string
  group_ids?: Record<string, string[]>  // { "1": ["full"], "2": ["read"] }
}

export interface UpdateUserRequest {
  firstname?: string
  lastname?: string
  email?: string
  phone?: string
  mobile?: string
  note?: string
  password?: string
  roles?: string[]
  group_ids?: Record<string, string[]>
  active?: boolean
  verified?: boolean
  out_of_office?: boolean
  out_of_office_start_at?: string | null
  out_of_office_end_at?: string | null
  out_of_office_replacement_id?: number | null
}

/**
 * Request to set Out-of-Office status
 * Used for vacation/leave management
 */
export interface SetOutOfOfficeRequest {
  out_of_office: boolean
  out_of_office_start_at: string | null  // ISO date string: "2024-12-20"
  out_of_office_end_at: string | null    // ISO date string: "2024-12-27"
  out_of_office_replacement_id: number | null  // ID of the replacement agent
}

/**
 * Response for Out-of-Office status
 */
export interface OutOfOfficeStatus {
  out_of_office: boolean
  out_of_office_start_at: string | null
  out_of_office_end_at: string | null
  out_of_office_replacement_id: number | null
  replacement_user?: ZammadUser | null  // Populated when fetching status
}

// ============================================================================
// Group Types
// ============================================================================

export interface ZammadGroup {
  id: number
  name: string
  assignment_timeout: number | null
  follow_up_possible: string
  follow_up_assignment: boolean
  email_address_id: number | null
  signature_id: number | null
  note: string
  active: boolean
  shared_drafts: boolean
  updated_by_id: number
  created_by_id: number
  created_at: string
  updated_at: string
  user_ids?: number[]
}

export interface CreateGroupRequest {
  name: string
  active?: boolean
  note?: string
  email_address_id?: number | null
  signature_id?: number | null
  assignment_timeout?: number | null
  follow_up_possible?: string
  follow_up_assignment?: boolean
  shared_drafts?: boolean
}

// ============================================================================
// Webhook Types
// ============================================================================

export interface ZammadWebhookPayload {
  event: 'ticket.create' | 'ticket.update' | 'ticket.close' | 'ticket.escalation'
  ticket: ZammadTicket
  article?: Partial<ZammadArticle> & { id: number }
}

// ============================================================================
// Search Types
// ============================================================================

export interface ZammadSearchResponse {
  tickets: ZammadTicket[]
  tickets_count: number
}

// ============================================================================
// Error Types
// ============================================================================

export interface ZammadError {
  error: string
  error_human?: string
}

// ============================================================================
// Knowledge Base Types
// ============================================================================

export interface ZammadKnowledgeBase {
  id: number
  name: string
  icon_font: string | null
  footer_note: string | null
  homepage_layout: string
  category_layout: string
  active: boolean
  created_at: string
  updated_at: string
  color_highlight: string
  color_header: string
  kb_locale_ids: number[]
}

export interface ZammadKnowledgeBaseLocale {
  id: number
  knowledge_base_id: number
  system_locale_id: number
  primary: boolean
  created_at: string
  updated_at: string
}

export interface ZammadKnowledgeBaseCategory {
  id: number
  knowledge_base_id: number
  parent_id: number | null
  position: number
  created_at: string
  updated_at: string
  category_icon: string | null
  schedule_at: string | null
  translations: ZammadKnowledgeBaseCategoryTranslation[]
}

export interface ZammadKnowledgeBaseCategoryTranslation {
  id: number
  kb_locale_id: number
  title: string
  keywords: string | null
  created_at: string
  updated_at: string
  footer_note: string | null
  category_id: number
  ui_color: string | null
}

export interface ZammadKnowledgeBaseAnswer {
  id: number
  category_id: number
  position: number
  promoted: boolean
  internal_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  translations: ZammadKnowledgeBaseAnswerTranslation[]
}

export interface ZammadKnowledgeBaseAnswerTranslation {
  id: number
  kb_locale_id: number
  title: string
  content: {
    body: string
  }
  keywords: string | null
  title_tag: string | null
  meta_description: string | null
  created_at: string
  updated_at: string
  answer_id: number
  ui_color: string | null
}

export interface ZammadKnowledgeBaseInitResponse {
  knowledge_bases: ZammadKnowledgeBase[]
  kb_locales: ZammadKnowledgeBaseLocale[]
  categories: ZammadKnowledgeBaseCategory[]
  answers: ZammadKnowledgeBaseAnswer[]
}

export interface ZammadKnowledgeBaseSearchResult {
  id: number
  title: string
  content: string
  category_id: number
  category_name: string
  kb_locale_id: number
  locale: string
  url: string
}

// ============================================================================
// Trigger Types (for Email Notifications)
// ============================================================================

export interface ZammadTriggerCondition {
  operator: 'is' | 'is not' | 'contains' | 'contains not' | 'starts with' | 'ends with' | 'regex match'
  value: string | string[]
}

export interface ZammadTriggerPerformEmail {
  recipient: 'ticket_customer' | 'ticket_owner' | 'ticket_agents' | 'article_last_sender' | string[]
  subject: string
  body: string
  include_attachments?: 'true' | 'false'
}

export interface ZammadTriggerPerform {
  'notification.email'?: ZammadTriggerPerformEmail
  'ticket.state_id'?: { value: string }
  'ticket.priority_id'?: { value: string }
  'ticket.owner_id'?: { value: string }
  'ticket.tags'?: { operator: 'add' | 'remove'; value: string }
  [key: string]: unknown
}

export interface ZammadTrigger {
  id: number
  name: string
  condition: Record<string, ZammadTriggerCondition>
  perform: ZammadTriggerPerform
  disable_notification: boolean
  active: boolean
  execution_condition_mode: 'selective' | 'always'
  note: string | null
  updated_by_id: number
  created_by_id: number
  created_at: string
  updated_at: string
}

export interface CreateTriggerRequest {
  name: string
  condition: Record<string, ZammadTriggerCondition>
  perform: ZammadTriggerPerform
  active?: boolean
  disable_notification?: boolean
  execution_condition_mode?: 'selective' | 'always'
  note?: string
}

export interface UpdateTriggerRequest {
  name?: string
  condition?: Record<string, ZammadTriggerCondition>
  perform?: ZammadTriggerPerform
  active?: boolean
  disable_notification?: boolean
  execution_condition_mode?: 'selective' | 'always'
  note?: string
}

