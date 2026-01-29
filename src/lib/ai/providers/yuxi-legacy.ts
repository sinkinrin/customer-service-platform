import { AISettings } from '@/lib/utils/ai-config'
import { ChatRequest, ChatResponse, AIProvider, TestConnectionResult } from './index'
import { logger } from '@/lib/utils/logger'

// Simple in-memory token cache
let cachedToken: { token: string; expiresAt: number } | null = null

export class YuxiLegacyProvider implements AIProvider {
  private async getToken(settings: AISettings): Promise<string> {
    // Check cache (with 5 min buffer)
    if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
      return cachedToken.token
    }

    const tokenUrl = settings.yuxiUrl.endsWith('/')
      ? `${settings.yuxiUrl}api/auth/token`
      : `${settings.yuxiUrl}/api/auth/token`

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        username: settings.yuxiUsername,
        password: settings.yuxiPassword,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to get token: ${response.status}`)
    }

    const data = await response.json()

    // Cache token (assume 1 hour expiry if not specified)
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    }

    return data.access_token
  }

  async chat(request: ChatRequest, settings: AISettings): Promise<ChatResponse> {
    const { message } = request

    if (!settings.yuxiUrl || !settings.yuxiUsername || !settings.yuxiPassword || !settings.yuxiAgentId) {
      return { success: false, error: 'Yuxi-Know is not configured' }
    }

    try {
      const token = await this.getToken(settings)

      const chatUrl = settings.yuxiUrl.endsWith('/')
        ? `${settings.yuxiUrl}api/chat/agent/${settings.yuxiAgentId}`
        : `${settings.yuxiUrl}/api/chat/agent/${settings.yuxiAgentId}`

      const response = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: message,
          config: {},
          meta: {},
        }),
      })

      if (!response.ok) {
        // Clear token cache on auth error
        if (response.status === 401) {
          cachedToken = null
        }
        const errorText = await response.text()
        logger.error('YuxiLegacy', 'API error', { data: { status: response.status, error: errorText.slice(0, 200) } })
        return { success: false, error: 'Failed to get AI response' }
      }

      // Parse streaming response (NDJSON)
      const reader = response.body?.getReader()
      if (!reader) {
        return { success: false, error: 'No response body' }
      }

      let fullResponse = ''
      let errorMessage = ''
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value, { stream: true })
        const lines = text.split('\n').filter(Boolean)

        for (const line of lines) {
          try {
            const chunk = JSON.parse(line)
            // Accumulate response content
            if (chunk.response) {
              fullResponse += chunk.response
            }
            // Check for error status
            if (chunk.status === 'error') {
              errorMessage = chunk.error_message || chunk.message || 'Unknown error from AI'
              break
            }
            // Handle final status (Yuxi-Know uses 'finished', not 'done')
            if (chunk.status === 'finished' || chunk.status === 'interrupted') {
              break
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }

      // Return error if we got one
      if (errorMessage) {
        logger.error('YuxiLegacy', 'AI error', { data: { error: errorMessage } })
        return { success: false, error: errorMessage }
      }

      return {
        success: true,
        data: { message: fullResponse || 'Sorry, I could not generate a response.', model: settings.yuxiAgentId },
      }
    } catch (error) {
      // Clear token cache on error
      cachedToken = null
      logger.error('YuxiLegacy', 'Request failed', { data: { error: error instanceof Error ? error.message : error } })
      return { success: false, error: error instanceof Error ? error.message : 'Request failed' }
    }
  }

  async testConnection(settings: AISettings): Promise<TestConnectionResult> {
    const startTime = Date.now()

    if (!settings.yuxiUrl || !settings.yuxiUsername || !settings.yuxiPassword || !settings.yuxiAgentId) {
      return {
        success: false,
        connectivity: false,
        functional: false,
        error: 'Yuxi-Know is not configured',
      }
    }

    // Step 1: Test connectivity by getting a token
    try {
      const token = await this.getToken(settings)
      const responseTime = Date.now() - startTime

      // Step 2: Test AI functionality with a simple query
      const chatUrl = settings.yuxiUrl.endsWith('/')
        ? `${settings.yuxiUrl}api/chat/agent/${settings.yuxiAgentId}`
        : `${settings.yuxiUrl}/api/chat/agent/${settings.yuxiAgentId}`

      const chatResponse = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: '你好，这是连接测试',
          config: {},
          meta: {},
        }),
        signal: AbortSignal.timeout(15000),
      })

      if (!chatResponse.ok) {
        const errorText = await chatResponse.text()
        return {
          success: false,
          connectivity: true,
          functional: false,
          error: `API error: ${chatResponse.status} - ${errorText.slice(0, 100)}`,
          responseTime,
        }
      }

      // Parse streaming response to verify AI functionality
      const reader = chatResponse.body?.getReader()
      if (!reader) {
        return {
          success: false,
          connectivity: true,
          functional: false,
          error: 'No response body',
          responseTime,
        }
      }

      let fullResponse = ''
      let errorMessage = ''
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value, { stream: true })
        const lines = text.split('\n').filter(Boolean)

        for (const line of lines) {
          try {
            const chunk = JSON.parse(line)
            // Accumulate response content
            if (chunk.response) {
              fullResponse += chunk.response
            }
            // Check for error status
            if (chunk.status === 'error') {
              errorMessage = chunk.error_message || chunk.message || 'Unknown error from AI'
              break
            }
            // Handle final status (Yuxi-Know uses 'finished', not 'done')
            if (chunk.status === 'finished' || chunk.status === 'interrupted') {
              break
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }

      // Return error if we got one
      if (errorMessage) {
        return {
          success: false,
          connectivity: true,
          functional: false,
          error: errorMessage,
          responseTime: Date.now() - startTime,
        }
      }

      if (!fullResponse) {
        return {
          success: false,
          connectivity: true,
          functional: false,
          error: 'AI response is empty',
          responseTime: Date.now() - startTime,
        }
      }

      return {
        success: true,
        connectivity: true,
        functional: true,
        responseTime: Date.now() - startTime,
        testResponse: fullResponse,
      }
    } catch (error) {
      const responseTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Clear token cache on error
      cachedToken = null

      // Determine if it's a connectivity issue
      const isConnectivityError =
        errorMessage.includes('fetch') ||
        errorMessage.includes('network') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('abort')

      return {
        success: false,
        connectivity: !isConnectivityError,
        functional: false,
        error: errorMessage,
        responseTime,
      }
    }
  }
}

// Export function to clear token cache (useful for testing or logout)
export function clearYuxiTokenCache(): void {
  cachedToken = null
}
