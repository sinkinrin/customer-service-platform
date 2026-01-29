import { AISettings } from '@/lib/utils/ai-config'
import { ChatRequest, ChatResponse, AIProvider } from './index'
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
