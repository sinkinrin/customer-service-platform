import { AISettings } from '@/lib/utils/ai-config'
import { ChatRequest, ChatResponse, AIProvider } from './index'
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
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value, { stream: true })
        const lines = text.split('\n').filter(Boolean)

        for (const line of lines) {
          try {
            const chunk = JSON.parse(line)
            if (chunk.response) {
              fullResponse += chunk.response
            }
            // Handle final message or status
            if (chunk.status === 'done' || chunk.status === 'error') {
              break
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
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

  async testConnection(settings: AISettings): Promise<{ success: boolean; error?: string }> {
    try {
      // Just try to get a token
      await this.getToken(settings)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}

// Export function to clear token cache (useful for testing or logout)
export function clearYuxiTokenCache(): void {
  cachedToken = null
}
