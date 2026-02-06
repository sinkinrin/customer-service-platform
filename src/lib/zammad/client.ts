/**
 * Zammad API Client
 *
 * Wrapper for Zammad REST API with error handling and retry mechanism
 */

import { ATTACHMENT_LIMITS } from '@/lib/constants/attachments'
import { logger } from '@/lib/utils/logger'
import type {
  ZammadTicket,
  CreateTicketRequest,
  UpdateTicketRequest,
  ZammadArticle,
  CreateArticleRequest,
  ZammadTagsResponse,
  AddTagRequest,
  RemoveTagRequest,
  ZammadSLA,
  ZammadUser,
  CreateUserRequest,
  UpdateUserRequest,
  SetOutOfOfficeRequest,
  OutOfOfficeStatus,
  ZammadGroup,
  CreateGroupRequest,
  ZammadSearchResponse,
  ZammadError,
  ZammadKnowledgeBaseInitResponse,
  ZammadKnowledgeBaseLocale,
  ZammadKnowledgeBaseCategory,
  ZammadKnowledgeBaseAnswer,
  ZammadKnowledgeBaseSearchResult,
  ZammadTrigger,
  CreateTriggerRequest,
  UpdateTriggerRequest,
} from './types'

export class ZammadClient {
  private baseUrl: string
  private apiToken: string
  private timeout: number
  private maxRetries: number

  constructor(
    baseUrl?: string,
    apiToken?: string,
    timeout: number = 5000, // 减少到 5秒
    maxRetries: number = 1  // 减少重试次数
  ) {
    this.baseUrl = (baseUrl || process.env.ZAMMAD_URL || '').replace(/\/$/, '')
    this.apiToken = apiToken || process.env.ZAMMAD_API_TOKEN || ''
    this.timeout = timeout
    this.maxRetries = maxRetries

    // Note: Configuration validation is deferred to request time
    // This allows the module to load even when Zammad is not configured,
    // enabling health checks to report configuration errors gracefully
  }

  /**
   * Make HTTP request to Zammad API with retry mechanism
   * @param endpoint - API endpoint (e.g., '/tickets')
   * @param options - Fetch options
   * @param retryCount - Current retry count
   * @param onBehalfOf - User email/login/ID for X-On-Behalf-Of header (requires admin.user permission)
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount: number = 0,
    onBehalfOf?: string
  ): Promise<T> {
    // Validate configuration before making requests
    if (!this.baseUrl || !this.apiToken) {
      throw new Error(
        'Zammad is not configured. Please set ZAMMAD_URL and ZAMMAD_API_TOKEN environment variables.'
      )
    }

    const url = `${this.baseUrl}/api/v1${endpoint}`

    try {
      const headers: Record<string, string> = {
        'Authorization': `Token token=${this.apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }

      // Add X-On-Behalf-Of header if provided
      // This allows admin users to perform actions on behalf of other users
      // Requires admin.user permission on the API token
      if (onBehalfOf) {
        headers['X-On-Behalf-Of'] = onBehalfOf
      }

      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
        signal: AbortSignal.timeout(this.timeout),
      })

      if (!response.ok) {
        const error: ZammadError = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`,
        }))

        // Retry on 5xx errors
        if (response.status >= 500 && retryCount < this.maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000 // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay))
          return this.request<T>(endpoint, options, retryCount + 1, onBehalfOf)
        }

        throw new Error(error.error_human || error.error)
      }

      return await response.json()
    } catch (error) {
      // Retry on network errors
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout')
      }

      if (retryCount < this.maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.request<T>(endpoint, options, retryCount + 1, onBehalfOf)
      }

      throw error
    }
  }

  // ============================================================================
  // Ticket Management
  // ============================================================================

  /**
   * Create a new ticket
   * @param data - Ticket data
   * @param onBehalfOf - User email/login/ID to create ticket on behalf of (requires admin.user permission)
   */
  async createTicket(data: CreateTicketRequest, onBehalfOf?: string): Promise<ZammadTicket> {
    return this.request<ZammadTicket>(
      '/tickets',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      0,
      onBehalfOf
    )
  }

  /**
   * Get ticket by ID
   * @param id - Ticket ID
   * @param onBehalfOf - User email/login/ID to get ticket on behalf of
   */
  async getTicket(id: number, onBehalfOf?: string): Promise<ZammadTicket> {
    return this.request<ZammadTicket>(`/tickets/${id}`, {}, 0, onBehalfOf)
  }

  /**
   * Get tickets with pagination
   * @param page - Page number (1-indexed)
   * @param perPage - Items per page (default 100, max 500 in Zammad)
   * @param onBehalfOf - User email/login/ID to get tickets on behalf of
   */
  async getTickets(page: number = 1, perPage: number = 100, onBehalfOf?: string): Promise<ZammadTicket[]> {
    return this.request<ZammadTicket[]>(`/tickets?page=${page}&per_page=${perPage}`, {}, 0, onBehalfOf)
  }

  /**
   * Get all tickets by iterating through all pages
   * Performance optimized: stops when a page returns fewer items than requested
   * @param onBehalfOf - User email/login/ID to get tickets on behalf of
   * @param maxPages - Maximum pages to fetch (safety limit, default 10 = 1000 tickets)
   */
  async getAllTickets(onBehalfOf?: string, maxPages: number = 10): Promise<ZammadTicket[]> {
    const allTickets: ZammadTicket[] = []
    const perPage = 100
    let page = 1

    while (page <= maxPages) {
      const tickets = await this.getTickets(page, perPage, onBehalfOf)
      allTickets.push(...tickets)

      // If we got fewer tickets than requested, we've reached the last page
      if (tickets.length < perPage) {
        break
      }
      page++
    }

    logger.info('ZammadClient', `Fetched ${allTickets.length} tickets across ${page} pages`)
    return allTickets
  }

  /**
   * Update ticket
   * @param id - Ticket ID
   * @param data - Update data
   * @param onBehalfOf - User email/login/ID to update ticket on behalf of
   */
  async updateTicket(id: number, data: UpdateTicketRequest, onBehalfOf?: string): Promise<ZammadTicket> {
    return this.request<ZammadTicket>(
      `/tickets/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      0,
      onBehalfOf
    )
  }

  /**
   * Delete ticket
   * @param id - Ticket ID
   * @param onBehalfOf - User email/login/ID to delete ticket on behalf of
   */
  async deleteTicket(id: number, onBehalfOf?: string): Promise<void> {
    await this.request<void>(
      `/tickets/${id}`,
      {
        method: 'DELETE',
      },
      0,
      onBehalfOf
    )
  }

  /**
   * Format search query for Zammad search syntax
   * @param rawQuery - Raw search query from user
   * @returns Formatted query for Zammad API
   */
  private formatSearchQuery(rawQuery: string): string {
    const trimmed = rawQuery.trim()

    // If query is purely numeric, search by ticket number
    if (/^\d+$/.test(trimmed)) {
      return `number:${trimmed}`
    }

    // If query already contains Zammad syntax (contains ':'), use as-is
    if (trimmed.includes(':')) {
      return trimmed
    }

    // Otherwise, search by title with wildcard
    return `title:*${trimmed}*`
  }

  /**
   * Search tickets
   * @param query - Search query (will be auto-formatted for Zammad syntax)
   * @param limit - Maximum number of results
   * @param onBehalfOf - User email/login/ID to search tickets on behalf of
   * @param page - Page number (1-indexed)
   * @param sortBy - Sort field supported by Zammad search
   * @param orderBy - Sort direction (asc/desc)
   */
  async searchTickets(
    query: string,
    limit: number = 10,
    onBehalfOf?: string,
    page: number = 1,
    sortBy?: string,
    orderBy?: 'asc' | 'desc'
  ): Promise<ZammadSearchResponse> {
    logger.debug('ZammadClient', 'searchTickets - Raw query', { data: { query } })
    const formattedQuery = this.formatSearchQuery(query)
    logger.debug('ZammadClient', 'searchTickets - Formatted query', { data: { formattedQuery } })
    logger.debug('ZammadClient', 'searchTickets - Pagination', { data: { limit, page } })
    logger.debug('ZammadClient', 'searchTickets - OnBehalfOf', { data: { onBehalfOf } })

    const params = new URLSearchParams({
      query: formattedQuery,
      limit: limit.toString(),
      page: page.toString(),
    })
    if (sortBy) {
      params.set('sort_by', sortBy)
    }
    if (orderBy) {
      params.set('order_by', orderBy)
    }
    const url = `/tickets/search?${params}`
    logger.debug('ZammadClient', 'searchTickets - Full URL', { data: { url } })

    // Zammad search API returns an array directly, not an object
    const tickets = await this.request<ZammadTicket[]>(url, {}, 0, onBehalfOf)
    logger.debug('ZammadClient', 'searchTickets - Raw response from Zammad', { data: { tickets } })

    // Wrap the array in the expected response format
    const result: ZammadSearchResponse = {
      tickets: tickets || [],
      tickets_count: tickets?.length || 0
    }
    logger.debug('ZammadClient', 'searchTickets - Wrapped response', { data: { result } })

    return result
  }

  /**
   * Get total ticket count for a search query.
   * Uses Zammad `only_total_count=true` mode to avoid fetching full result sets.
   */
  async searchTicketsTotalCount(query: string, onBehalfOf?: string): Promise<number> {
    const formattedQuery = this.formatSearchQuery(query)
    const params = new URLSearchParams({
      query: formattedQuery,
      only_total_count: 'true',
    })
    const url = `/tickets/search?${params}`
    const response = await this.request<{ total_count?: number }>(url, {}, 0, onBehalfOf)
    return response.total_count ?? 0
  }

  // ============================================================================
  // Article Management
  // ============================================================================

  /**
   * Create a new article (reply)
   * @param data - Article data
   * @param onBehalfOf - User email/login/ID to create article on behalf of
   */
  async createArticle(data: CreateArticleRequest, onBehalfOf?: string): Promise<ZammadArticle> {
    return this.request<ZammadArticle>(
      '/ticket_articles',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      0,
      onBehalfOf
    )
  }

  /**
   * Get article by ID
   * @param id - Article ID
   * @param onBehalfOf - User email/login/ID to get article on behalf of
   */
  async getArticle(id: number, onBehalfOf?: string): Promise<ZammadArticle> {
    return this.request<ZammadArticle>(`/ticket_articles/${id}`, {}, 0, onBehalfOf)
  }

  /**
   * Get all articles for a ticket
   * @param ticketId - Ticket ID
   * @param onBehalfOf - User email/login/ID to get articles on behalf of
   */
  async getArticlesByTicket(ticketId: number, onBehalfOf?: string): Promise<ZammadArticle[]> {
    return this.request<ZammadArticle[]>(`/ticket_articles/by_ticket/${ticketId}`, {}, 0, onBehalfOf)
  }

  /**
   * Download attachment
   * @param ticketId - Ticket ID
   * @param articleId - Article ID
   * @param attachmentId - Attachment ID
   * @param onBehalfOf - User email/login/ID to download attachment on behalf of
   */
  async downloadAttachment(
    ticketId: number,
    articleId: number,
    attachmentId: number,
    onBehalfOf?: string
  ): Promise<Blob> {
    const url = `${this.baseUrl}/api/v1/ticket_attachment/${ticketId}/${articleId}/${attachmentId}`

    const headers: Record<string, string> = {
      'Authorization': `Token token=${this.apiToken}`,
    }

    // Add X-On-Behalf-Of header if provided
    if (onBehalfOf) {
      headers['X-On-Behalf-Of'] = onBehalfOf
    }

    // Use longer timeout for attachment downloads (120 seconds)
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(ATTACHMENT_LIMITS.DOWNLOAD_TIMEOUT),
    })

    if (!response.ok) {
      throw new Error(`Failed to download attachment: ${response.statusText}`)
    }

    return await response.blob()
  }

  /**
   * Upload attachment to Zammad using upload_caches endpoint
   * All roles should use X-On-Behalf-Of for unified permission control
   *
   * Zammad uses POST /api/v1/upload_caches/{form_id} for file uploads.
   * Files are cached under a form_id, which can later be referenced when
   * creating tickets or articles.
   *
   * @param file - File buffer or Blob to upload
   * @param filename - Original filename
   * @param mimeType - MIME type of the file
   * @param onBehalfOf - User email (required for proper ownership)
   * @param formId - Unique form ID to group uploads (will be generated if not provided)
   * @returns Upload result with store info for later reference
   */
  async uploadAttachment(
    file: Buffer | Blob,
    filename: string,
    mimeType: string,
    onBehalfOf: string,
    formId?: string
  ): Promise<{ id: number; store_id?: number; filename?: string; form_id: string }> {
    if (!this.baseUrl || !this.apiToken) {
      throw new Error(
        'Zammad is not configured. Please set ZAMMAD_URL and ZAMMAD_API_TOKEN environment variables.'
      )
    }

    // Generate form_id if not provided (use timestamp + random for uniqueness)
    const effectiveFormId = formId || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const url = `${this.baseUrl}/api/v1/upload_caches/${effectiveFormId}`

    const formData = new FormData()
    // Convert Buffer to Uint8Array for Blob compatibility (Node.js Buffer isn't directly assignable to BlobPart)
    const blob = file instanceof Blob ? file : new Blob([new Uint8Array(file)], { type: mimeType })
    // Zammad expects the file field to be named 'File' (capital F)
    formData.append('File', blob, filename)

    const headers: Record<string, string> = {
      'Authorization': `Token token=${this.apiToken}`,
      'X-On-Behalf-Of': onBehalfOf,
    }

    // Use configurable timeout for uploads (default: 120 seconds)
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      signal: AbortSignal.timeout(ATTACHMENT_LIMITS.UPLOAD_TIMEOUT),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText)
      throw new Error(`Attachment upload failed: ${errorText}`)
    }

    const result = await response.json()
    // Include form_id in the response for later reference
    return { ...result, form_id: effectiveFormId }
  }

  // ============================================================================
  // Tag Management
  // ============================================================================

  /**
   * Get tags for a ticket
   * @param ticketId - Ticket ID
   * @param onBehalfOf - User email/login/ID to get tags on behalf of
   */
  async getTags(ticketId: number, onBehalfOf?: string): Promise<string[]> {
    const params = new URLSearchParams({ object: 'Ticket', o_id: ticketId.toString() })
    const response = await this.request<ZammadTagsResponse>(`/tags?${params}`, {}, 0, onBehalfOf)
    return response.tags
  }

  /**
   * Add tag to ticket
   * @param ticketId - Ticket ID
   * @param tag - Tag name
   * @param onBehalfOf - User email/login/ID to add tag on behalf of
   */
  async addTag(ticketId: number, tag: string, onBehalfOf?: string): Promise<void> {
    const data: AddTagRequest = {
      item: tag,
      object: 'Ticket',
      o_id: ticketId,
    }
    await this.request<void>(
      '/tags/add',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      0,
      onBehalfOf
    )
  }

  /**
   * Remove tag from ticket
   * @param ticketId - Ticket ID
   * @param tag - Tag name
   * @param onBehalfOf - User email/login/ID to remove tag on behalf of
   */
  async removeTag(ticketId: number, tag: string, onBehalfOf?: string): Promise<void> {
    const data: RemoveTagRequest = {
      item: tag,
      object: 'Ticket',
      o_id: ticketId,
    }
    await this.request<void>(
      '/tags/remove',
      {
        method: 'DELETE',
        body: JSON.stringify(data),
      },
      0,
      onBehalfOf
    )
  }

  // ============================================================================
  // SLA Management
  // ============================================================================

  /**
   * Get all SLAs
   */
  async getSLAs(): Promise<ZammadSLA[]> {
    return this.request<ZammadSLA[]>('/slas')
  }

  /**
   * Get SLA by ID
   */
  async getSLA(id: number): Promise<ZammadSLA> {
    return this.request<ZammadSLA>(`/slas/${id}`)
  }

  // ============================================================================
  // User Management
  // ============================================================================

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<ZammadUser> {
    return this.request<ZammadUser>('/users/me')
  }

  /**
   * Get user by ID
   * @param id - User ID
   */
  async getUser(id: number): Promise<ZammadUser> {
    return this.request<ZammadUser>(`/users/${id}`)
  }

  /**
   * Get users with pagination.
   * @param page - Page number (1-indexed)
   * @param perPage - Items per page
   */
  async getUsers(page: number = 1, perPage: number = 100): Promise<ZammadUser[]> {
    return this.request<ZammadUser[]>(`/users?page=${page}&per_page=${perPage}`)
  }

  /**
   * Create a new user
   * @param data - User data
   * @returns Created user object
   */
  async createUser(data: CreateUserRequest): Promise<ZammadUser> {
    return this.request<ZammadUser>(
      '/users',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  /**
   * Update user
   * @param id - User ID
   * @param data - Update data
   * @returns Updated user object
   */
  async updateUser(id: number, data: UpdateUserRequest): Promise<ZammadUser> {
    return this.request<ZammadUser>(
      `/users/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    )
  }

  /**
   * Search users
   * @param query - Search query (email, login, name, etc.)
   * @returns Array of matching users
   */
  async searchUsers(query: string): Promise<ZammadUser[]> {
    const params = new URLSearchParams({ query })
    return this.request<ZammadUser[]>(`/users/search?${params}`)
  }

  /**
   * Search users with explicit pagination.
   * @param query - Search query
   * @param limit - Page size
   * @param page - Page number (1-indexed)
   */
  async searchUsersPaginated(query: string, limit: number = 20, page: number = 1): Promise<ZammadUser[]> {
    const params = new URLSearchParams({
      query,
      limit: limit.toString(),
      page: page.toString(),
    })
    return this.request<ZammadUser[]>(`/users/search?${params}`)
  }

  /**
   * Get total user count for a search query.
   * Uses Zammad `only_total_count=true` mode to avoid fetching full result sets.
   */
  async searchUsersTotalCount(query: string): Promise<number> {
    const params = new URLSearchParams({
      query,
      only_total_count: 'true',
    })
    const response = await this.request<{ total_count?: number }>(`/users/search?${params}`)
    return response.total_count ?? 0
  }

  /**
   * Authenticate user with email and password using HTTP Basic Auth
   * @param email - User email or login
   * @param password - User password
   * @returns Authenticated user object or null if authentication fails
   */
  async authenticateUser(email: string, password: string): Promise<ZammadUser | null> {
    // Validate configuration
    if (!this.baseUrl) {
      logger.error('ZammadClient', 'Base URL not configured')
      return null
    }

    const url = `${this.baseUrl}/api/v1/users/me`

    try {
      // Use HTTP Basic Authentication
      const credentials = Buffer.from(`${email}:${password}`).toString('base64')

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(this.timeout),
      })

      if (!response.ok) {
        logger.info('ZammadClient', 'Authentication failed', { data: { status: response.status } })
        return null
      }

      const userData = await response.json()

      if (!userData || !userData.id) {
        logger.info('ZammadClient', 'No user data in response')
        return null
      }

      // /users/me doesn't return all fields (e.g., note) due to Zammad permissions
      // Fetch complete user data using API token to get all fields
      try {
        const fullUserData = await this.getUser(userData.id)
        if (fullUserData) {
          logger.info('ZammadClient', 'Fetched complete user data with note field')
          return fullUserData
        }
      } catch (fetchError) {
        logger.warning('ZammadClient', 'Failed to fetch complete user data, using partial data', {
          data: { error: fetchError instanceof Error ? fetchError.message : fetchError }
        })
      }

      return userData as ZammadUser
    } catch (error) {
      logger.error('ZammadClient', 'Error during authentication', {
        data: { error: error instanceof Error ? error.message : error }
      })
      return null
    }
  }

  /**
   * Get user by email
   * @param email - User email
   * @returns User object or null if not found
   */
  async getUserByEmail(email: string): Promise<ZammadUser | null> {
    try {
      const users = await this.searchUsers(email)
      // Find exact match by email
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase())
      return user || null
    } catch (error) {
      logger.error('ZammadClient', 'Error fetching user by email', {
        data: { error: error instanceof Error ? error.message : error }
      })
      return null
    }
  }

  /**
   * Get multiple users by ID with concurrency control
   * @param ids - Array of user IDs to fetch
   * @param concurrency - Max concurrent requests (default: 20)
   * @returns Array of users (failed fetches will be omitted)
   */
  async getUsersByIds(ids: number[], concurrency: number = 20): Promise<ZammadUser[]> {
    const uniqueIds = [...new Set(ids)]
    const results: ZammadUser[] = []

    // Split IDs into chunks based on concurrency
    const chunks: number[][] = []
    for (let i = 0; i < uniqueIds.length; i += concurrency) {
      chunks.push(uniqueIds.slice(i, i + concurrency))
    }

    // Process chunks
    for (const chunk of chunks) {
      try {
        const chunkResults = await Promise.all(
          chunk.map(async (id) => {
            try {
              return await this.getUser(id)
            } catch (error) {
              logger.error('ZammadClient', `Failed to fetch user ${id}`, {
                data: { error: error instanceof Error ? error.message : error }
              })
              return null
            }
          })
        )

        // Filter out nulls (failed fetches)
        const validUsers = chunkResults.filter((u): u is ZammadUser => u !== null)
        results.push(...validUsers)
      } catch (error) {
        logger.error('ZammadClient', 'Error processing user chunk', {
          data: { error: error instanceof Error ? error.message : error }
        })
      }
    }

    return results
  }

  // ============================================================================
  // Out-of-Office (Vacation) Management
  // ============================================================================

  /**
   * Get user's Out-of-Office status
   * @param userId - User ID (if not provided, gets current user's status)
   * @returns Out-of-Office status with replacement user info
   */
  async getOutOfOffice(userId?: number): Promise<OutOfOfficeStatus> {
    const user = userId
      ? await this.getUser(userId)
      : await this.getCurrentUser()

    const status: OutOfOfficeStatus = {
      out_of_office: user.out_of_office,
      out_of_office_start_at: user.out_of_office_start_at,
      out_of_office_end_at: user.out_of_office_end_at,
      out_of_office_replacement_id: user.out_of_office_replacement_id,
    }

    // Fetch replacement user details if set
    if (user.out_of_office_replacement_id) {
      try {
        status.replacement_user = await this.getUser(user.out_of_office_replacement_id)
      } catch {
        // Replacement user might not exist anymore
        status.replacement_user = null
      }
    }

    return status
  }

  /**
   * Set Out-of-Office status for a user
   * @param userId - User ID
   * @param data - Out-of-Office settings
   * @returns Updated user object
   */
  async setOutOfOffice(userId: number, data: SetOutOfOfficeRequest): Promise<ZammadUser> {
    return this.updateUser(userId, {
      out_of_office: data.out_of_office,
      out_of_office_start_at: data.out_of_office_start_at,
      out_of_office_end_at: data.out_of_office_end_at,
      out_of_office_replacement_id: data.out_of_office_replacement_id,
    })
  }

  /**
   * Cancel Out-of-Office status for a user
   * @param userId - User ID
   * @returns Updated user object
   */
  async cancelOutOfOffice(userId: number): Promise<ZammadUser> {
    return this.updateUser(userId, {
      out_of_office: false,
      out_of_office_start_at: null,
      out_of_office_end_at: null,
      out_of_office_replacement_id: null,
    })
  }

  // ============================================================================
  // Agent Management
  // ============================================================================

  /**
   * Get all agents (users with Agent role)
   * Zammad role_id=2 is typically the Agent role
   * @param activeOnly - If true, only return active agents (default: true)
   * @returns Array of agent users
   */
  async getAgents(activeOnly: boolean = true): Promise<ZammadUser[]> {
    // Get all users from Zammad
    const allUsers = await this.request<ZammadUser[]>('/users')

    // Filter for users with Agent role (role_id = 2)
    // Note: role_ids is an array of role IDs the user has
    const agents = allUsers.filter(user => {
      const roleIds = user.role_ids || []
      return roleIds.includes(2) // role_id 2 = Agent
    })

    if (activeOnly) {
      return agents.filter(user => user.active)
    }

    return agents
  }

  /**
   * Get available agents (not on vacation)
   * @returns Array of available agent users
   */
  async getAvailableAgents(): Promise<ZammadUser[]> {
    const agents = await this.getAgents(true)
    const now = new Date()

    return agents.filter(agent => {
      // Not on vacation
      if (!agent.out_of_office) return true

      // Check if vacation period is current
      const startDate = agent.out_of_office_start_at
        ? new Date(agent.out_of_office_start_at)
        : null
      const endDate = agent.out_of_office_end_at
        ? new Date(agent.out_of_office_end_at)
        : null

      // If start date is in future, agent is available
      if (startDate && now < startDate) return true

      // If end date is in past, agent is available
      if (endDate && now > endDate) return true

      // Agent is currently on vacation
      return false
    })
  }

  // ============================================================================
  // Group Management
  // ============================================================================

  /**
   * Get all groups
   */
  async getGroups(): Promise<ZammadGroup[]> {
    return this.request<ZammadGroup[]>('/groups')
  }

  /**
   * Get group by ID
   */
  async getGroup(id: number): Promise<ZammadGroup> {
    return this.request<ZammadGroup>(`/groups/${id}`)
  }

  /**
   * Create a new group
   * @param data - Group data
   * @returns Created group object
   */
  async createGroup(data: CreateGroupRequest): Promise<ZammadGroup> {
    return this.request<ZammadGroup>(
      '/groups',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  // ============================================================================
  // Knowledge Base Management
  // ============================================================================

  /**
   * Get Knowledge Base initialization data
   * Returns all knowledge bases, locales, categories, and answers
   */
  async getKnowledgeBaseInit(): Promise<ZammadKnowledgeBaseInitResponse> {
    return this.request<ZammadKnowledgeBaseInitResponse>('/knowledge_bases/init')
  }

  /**
   * Get all knowledge base locales
   */
  async getKnowledgeBaseLocales(): Promise<ZammadKnowledgeBaseLocale[]> {
    return this.request<ZammadKnowledgeBaseLocale[]>('/knowledge_base/locales')
  }

  /**
   * Get knowledge base categories
   * @param locale - Language locale (e.g., 'en', 'zh-cn')
   */
  async getKnowledgeBaseCategories(locale?: string): Promise<ZammadKnowledgeBaseCategory[]> {
    const params = locale ? `?locale=${locale}` : ''
    return this.request<ZammadKnowledgeBaseCategory[]>(`/knowledge_base/categories${params}`)
  }

  /**
   * Get all knowledge base answers
   * @param locale - Language locale (e.g., 'en', 'zh-cn')
   */
  async getKnowledgeBaseAnswers(locale?: string): Promise<ZammadKnowledgeBaseAnswer[]> {
    const params = locale ? `?locale=${locale}` : ''
    return this.request<ZammadKnowledgeBaseAnswer[]>(`/knowledge_base/answers${params}`)
  }

  /**
   * Get knowledge base answer by ID
   * @param id - Answer ID
   * @param locale - Language locale
   */
  async getKnowledgeBaseAnswer(id: number, locale?: string): Promise<ZammadKnowledgeBaseAnswer> {
    const params = locale ? `?locale=${locale}` : ''
    return this.request<ZammadKnowledgeBaseAnswer>(`/knowledge_base/answers/${id}${params}`)
  }

  /**
   * Search knowledge base articles
   * @param query - Search query
   * @param locale - Language locale (e.g., 'en', 'zh-cn')
   * @param limit - Maximum number of results
   */
  async searchKnowledgeBase(
    query: string,
    locale: string = 'en',
    limit: number = 10
  ): Promise<ZammadKnowledgeBaseSearchResult[]> {
    const params = new URLSearchParams({
      query,
      locale,
      limit: limit.toString(),
    })
    return this.request<ZammadKnowledgeBaseSearchResult[]>(`/knowledge_bases/search?${params}`)
  }

  // ==========================================================================
  // Trigger API (for Email Notifications)
  // ==========================================================================

  /**
   * Get all triggers
   * @returns Array of triggers
   */
  async getTriggers(): Promise<ZammadTrigger[]> {
    return this.request<ZammadTrigger[]>('/triggers')
  }

  /**
   * Get a trigger by ID
   * @param id - Trigger ID
   */
  async getTrigger(id: number): Promise<ZammadTrigger> {
    return this.request<ZammadTrigger>(`/triggers/${id}`)
  }

  /**
   * Create a new trigger
   * @param trigger - Trigger configuration
   */
  async createTrigger(trigger: CreateTriggerRequest): Promise<ZammadTrigger> {
    return this.request<ZammadTrigger>('/triggers', {
      method: 'POST',
      body: JSON.stringify(trigger),
    })
  }

  /**
   * Update an existing trigger
   * @param id - Trigger ID
   * @param trigger - Updated trigger configuration
   */
  async updateTrigger(id: number, trigger: UpdateTriggerRequest): Promise<ZammadTrigger> {
    return this.request<ZammadTrigger>(`/triggers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(trigger),
    })
  }

  /**
   * Delete a trigger
   * @param id - Trigger ID
   */
  async deleteTrigger(id: number): Promise<void> {
    await this.request<void>(`/triggers/${id}`, {
      method: 'DELETE',
    })
  }

  /**
   * Find a trigger by name
   * @param name - Trigger name to search for
   * @returns Trigger if found, null otherwise
   */
  async findTriggerByName(name: string): Promise<ZammadTrigger | null> {
    const triggers = await this.getTriggers()
    return triggers.find(t => t.name === name) || null
  }
}

/**
 * Create a singleton Zammad client instance
 */
export const zammadClient = new ZammadClient()

