import { AISettings } from '@/lib/utils/ai-config'

export interface ChatRequest {
  conversationId: string
  message: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}

export interface ChatResponse {
  success: boolean
  data?: {
    message: string
    model?: string
  }
  error?: string
}

export interface AIProvider {
  chat(request: ChatRequest, settings: AISettings): Promise<ChatResponse>
  testConnection(settings: AISettings): Promise<{ success: boolean; error?: string }>
}

export { FastGPTProvider } from './fastgpt'
export { OpenAICompatProvider } from './openai-compat'
export { YuxiLegacyProvider } from './yuxi-legacy'
