import { AISettings } from '@/lib/utils/ai-config'
import { ChatRequest, ChatResponse, AIProvider } from './index'
import { logger } from '@/lib/utils/logger'

export class FastGPTProvider implements AIProvider {
  async chat(request: ChatRequest, settings: AISettings): Promise<ChatResponse> {
    const { message, history = [] } = request

    if (!settings.fastgptUrl || !settings.fastgptApiKey) {
      return { success: false, error: 'FastGPT is not configured' }
    }

    const messages = [
      ...history.map((msg) => ({ role: msg.role, content: msg.content })),
      { role: 'user' as const, content: message },
    ]

    const fastgptUrl = settings.fastgptUrl.endsWith('/')
      ? `${settings.fastgptUrl}api/v1/chat/completions`
      : `${settings.fastgptUrl}/api/v1/chat/completions`

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

  async testConnection(settings: AISettings): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.chat(
        { conversationId: 'test', message: 'ping', history: [] },
        settings
      )
      return { success: result.success, error: result.error }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}
