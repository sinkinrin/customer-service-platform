import { AISettings } from '@/lib/utils/ai-config'
import { FastGPTProvider } from './fastgpt'
import { OpenAICompatProvider } from './openai-compat'
import { YuxiLegacyProvider } from './yuxi-legacy'

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

export interface TestConnectionResult {
  success: boolean
  connectivity: boolean // Server reachable?
  functional: boolean // AI working?
  error?: string
  responseTime?: number
  testResponse?: string
}

export interface AIProvider {
  chat(request: ChatRequest, settings: AISettings): Promise<ChatResponse>
  testConnection(settings: AISettings): Promise<TestConnectionResult>
}

export { FastGPTProvider, OpenAICompatProvider, YuxiLegacyProvider }

/** Shared provider registry – import this instead of instantiating providers in each route */
export const aiProviders = {
  fastgpt: new FastGPTProvider(),
  openai: new OpenAICompatProvider(),
  'yuxi-legacy': new YuxiLegacyProvider(),
} as const
