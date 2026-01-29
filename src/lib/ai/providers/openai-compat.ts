import { AISettings } from '@/lib/utils/ai-config'
import { ChatRequest, ChatResponse, AIProvider, TestConnectionResult } from './index'
import { logger } from '@/lib/utils/logger'

export class OpenAICompatProvider implements AIProvider {
  async chat(request: ChatRequest, settings: AISettings): Promise<ChatResponse> {
    const { message, history = [] } = request

    if (!settings.openaiUrl || !settings.openaiApiKey || !settings.openaiModel) {
      return { success: false, error: 'OpenAI compatible API is not configured' }
    }

    const messages = [
      ...history.map((msg) => ({ role: msg.role, content: msg.content })),
      { role: 'user' as const, content: message },
    ]

    const apiUrl = settings.openaiUrl.endsWith('/')
      ? `${settings.openaiUrl}v1/chat/completions`
      : `${settings.openaiUrl}/v1/chat/completions`

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: settings.openaiModel,
          messages,
          stream: false,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error('OpenAI', 'API error', { data: { status: response.status, error: errorText.slice(0, 200) } })
        return { success: false, error: 'Failed to get AI response' }
      }

      const data = await response.json()
      const aiMessage = data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.'

      return {
        success: true,
        data: { message: aiMessage, model: settings.openaiModel },
      }
    } catch (error) {
      logger.error('OpenAI', 'Request failed', { data: { error: error instanceof Error ? error.message : error } })
      return { success: false, error: 'Request failed' }
    }
  }

  async testConnection(settings: AISettings): Promise<TestConnectionResult> {
    const startTime = Date.now()

    if (!settings.openaiUrl || !settings.openaiApiKey || !settings.openaiModel) {
      return {
        success: false,
        connectivity: false,
        functional: false,
        error: 'OpenAI compatible API is not configured',
      }
    }

    const apiUrl = settings.openaiUrl.endsWith('/')
      ? `${settings.openaiUrl}v1/chat/completions`
      : `${settings.openaiUrl}/v1/chat/completions`

    // Step 1: Test connectivity
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: settings.openaiModel,
          messages: [{ role: 'user', content: 'Hello, this is a connection test' }],
          stream: false,
        }),
        signal: AbortSignal.timeout(15000),
      })

      const responseTime = Date.now() - startTime

      // Server is reachable
      if (!response.ok) {
        const errorText = await response.text()
        return {
          success: false,
          connectivity: true,
          functional: false,
          error: `API error: ${response.status} - ${errorText.slice(0, 100)}`,
          responseTime,
        }
      }

      // Step 2: Test AI functionality
      const data = await response.json()
      const aiMessage = data.choices?.[0]?.message?.content

      if (!aiMessage) {
        return {
          success: false,
          connectivity: true,
          functional: false,
          error: 'AI response is empty or malformed',
          responseTime,
        }
      }

      return {
        success: true,
        connectivity: true,
        functional: true,
        responseTime,
        testResponse: aiMessage,
      }
    } catch (error) {
      const responseTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

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
