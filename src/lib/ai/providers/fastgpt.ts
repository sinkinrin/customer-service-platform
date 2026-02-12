import { AISettings } from '@/lib/utils/ai-config'
import { ChatRequest, ChatResponse, ChatStreamResponse, AIProvider, TestConnectionResult } from './index'
import { logger } from '@/lib/utils/logger'

export class FastGPTProvider implements AIProvider {
  private buildMessages(request: ChatRequest) {
    const { message, history = [] } = request
    return [
      ...history.map((msg) => ({ role: msg.role, content: msg.content })),
      { role: 'user' as const, content: message },
    ]
  }

  private buildChatUrl(settings: AISettings) {
    return settings.fastgptUrl.endsWith('/')
      ? `${settings.fastgptUrl}api/v1/chat/completions`
      : `${settings.fastgptUrl}/api/v1/chat/completions`
  }

  async chat(request: ChatRequest, settings: AISettings): Promise<ChatResponse> {
    if (!settings.fastgptUrl || !settings.fastgptApiKey) {
      return { success: false, error: 'FastGPT is not configured' }
    }
    const messages = this.buildMessages(request)
    const fastgptUrl = this.buildChatUrl(settings)

    try {
      const response = await fetch(fastgptUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.fastgptApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: request.conversationId,
          stream: false,
          detail: false,
          messages,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error('FastGPT', 'API error', { data: { status: response.status, error: errorText.slice(0, 200) } })
        return { success: false, error: 'Failed to get AI response' }
      }

      const data = await response.json()
      const aiMessage = data.choices?.[0]?.message?.content || data.data || 'Sorry, I could not generate a response.'

      return {
        success: true,
        data: { message: aiMessage, model: settings.model || 'FastGPT' },
      }
    } catch (error) {
      logger.error('FastGPT', 'Request failed', { data: { error: error instanceof Error ? error.message : error } })
      return { success: false, error: 'Request failed' }
    }
  }

  async chatStream(request: ChatRequest, settings: AISettings): Promise<ChatStreamResponse> {
    if (!settings.fastgptUrl || !settings.fastgptApiKey) {
      return { success: false, error: 'FastGPT is not configured' }
    }
    const messages = this.buildMessages(request)
    const fastgptUrl = this.buildChatUrl(settings)

    try {
      const response = await fetch(fastgptUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.fastgptApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: request.conversationId,
          stream: true,
          detail: true,
          messages,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error('FastGPT', 'Stream API error', { data: { status: response.status, error: errorText.slice(0, 200) } })
        return { success: false, error: 'Failed to get AI response' }
      }

      if (!response.body) {
        return { success: false, error: 'No response body' }
      }

      return {
        success: true,
        data: {
          stream: response.body as ReadableStream<Uint8Array>,
          model: settings.model || 'FastGPT',
        },
      }
    } catch (error) {
      logger.error('FastGPT', 'Stream request failed', { data: { error: error instanceof Error ? error.message : error } })
      return { success: false, error: 'Request failed' }
    }
  }

  async testConnection(settings: AISettings): Promise<TestConnectionResult> {
    const startTime = Date.now()

    if (!settings.fastgptUrl || !settings.fastgptApiKey) {
      return {
        success: false,
        connectivity: false,
        functional: false,
        error: 'FastGPT is not configured',
      }
    }

    const fastgptUrl = settings.fastgptUrl.endsWith('/')
      ? `${settings.fastgptUrl}api/v1/chat/completions`
      : `${settings.fastgptUrl}/api/v1/chat/completions`

    // Step 1: Test connectivity
    try {
      const response = await fetch(fastgptUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.fastgptApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: 'connection-test',
          stream: false,
          detail: false,
          messages: [{ role: 'user', content: '你好，这是连接测试' }],
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
