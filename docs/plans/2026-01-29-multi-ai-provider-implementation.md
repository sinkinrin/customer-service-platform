# 多 AI Provider 支持实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 客服平台支持三种 AI 后端：FastGPT、OpenAI 兼容、Yuxi-Know 原生

**Architecture:** 扩展现有 AI 配置，添加 Provider 路由层，每种 Provider 独立处理逻辑

**Tech Stack:** Next.js 16 + React 19 + TypeScript + shadcn/ui

**项目路径:** `C:\Users\cassi\Desktop\ho\customer-service-platform`

---

## Provider 对比

| Provider | 认证方式 | API 格式 | 特点 |
|----------|----------|----------|------|
| `fastgpt` | API Key | FastGPT 专用 | 现有实现，保持不变 |
| `openai` | API Key | OpenAI 标准 | 通用，支持任何兼容后端 |
| `yuxi-legacy` | JWT (用户名/密码) | Yuxi-Know 原生流式 | 需处理 Token 刷新和流解析 |

---

## Task 1: 扩展类型定义

**Files:**
- Modify: `src/lib/utils/ai-config.ts`

**Step 1: 更新类型定义**

```typescript
/**
 * AI Configuration Utility
 *
 * Supports multiple AI providers:
 * - fastgpt: FastGPT with custom API format
 * - openai: OpenAI-compatible API (works with OpenAI, Yuxi-Know OpenAI layer, etc.)
 * - yuxi-legacy: Yuxi-Know native API with JWT authentication
 */

import fs from 'fs'
import path from 'path'
import { logger } from '@/lib/utils/logger'

export type AIProvider = 'fastgpt' | 'openai' | 'yuxi-legacy'

export interface AISettings {
  enabled: boolean
  provider: AIProvider

  // FastGPT (existing)
  fastgptUrl: string
  fastgptAppId: string
  fastgptApiKey: string

  // OpenAI Compatible
  openaiUrl: string
  openaiApiKey: string
  openaiModel: string

  // Yuxi-Know Legacy (JWT auth)
  yuxiUrl: string
  yuxiUsername: string
  yuxiPassword: string
  yuxiAgentId: string

  // Common (legacy, kept for compatibility)
  model: string
  temperature: number
  systemPrompt: string
}

const CONFIG_PATH = path.join(process.cwd(), 'config', 'ai-settings.json')

const DEFAULT_SETTINGS: AISettings = {
  enabled: false,
  provider: 'fastgpt',

  // FastGPT
  fastgptUrl: '',
  fastgptAppId: '',
  fastgptApiKey: '',

  // OpenAI Compatible
  openaiUrl: '',
  openaiApiKey: '',
  openaiModel: '',

  // Yuxi-Know Legacy
  yuxiUrl: '',
  yuxiUsername: '',
  yuxiPassword: '',
  yuxiAgentId: '',

  // Common
  model: 'GPT-4o-mini',
  temperature: 0.7,
  systemPrompt: 'You are a helpful customer service assistant.',
}

/**
 * Read AI settings from config file
 */
export function readAISettings(): AISettings {
  try {
    let fileSettings: Partial<AISettings> = {}

    if (fs.existsSync(CONFIG_PATH)) {
      const fileContent = fs.readFileSync(CONFIG_PATH, 'utf-8')
      fileSettings = JSON.parse(fileContent)
    }

    return {
      ...DEFAULT_SETTINGS,
      ...fileSettings,
      // Fallback to env for backwards compatibility
      fastgptApiKey: fileSettings.fastgptApiKey || process.env.FASTGPT_API_KEY || '',
    }
  } catch (error) {
    logger.error('AIConfig', 'Error reading settings', {
      data: { error: error instanceof Error ? error.message : error },
    })
    return DEFAULT_SETTINGS
  }
}

/**
 * Write AI settings to config file
 */
export function writeAISettings(settings: Partial<AISettings>): void {
  try {
    const configDir = path.dirname(CONFIG_PATH)
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }

    const currentSettings = readAISettings()
    const newSettings = { ...currentSettings, ...settings }

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newSettings, null, 2), 'utf-8')
    logger.info('AIConfig', 'Settings saved', { data: { provider: newSettings.provider } })
  } catch (error) {
    logger.error('AIConfig', 'Error writing settings', {
      data: { error: error instanceof Error ? error.message : error },
    })
    throw error
  }
}

// Keep existing updateEnvFile for backwards compatibility
export function updateEnvFile(apiKey: string): void {
  const envPath = path.join(process.cwd(), '.env.local')
  try {
    let envContent = ''
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8')
    }

    const keyPattern = /^FASTGPT_API_KEY=.*$/m
    if (keyPattern.test(envContent)) {
      envContent = envContent.replace(keyPattern, `FASTGPT_API_KEY=${apiKey}`)
    } else {
      envContent += `\nFASTGPT_API_KEY=${apiKey}`
    }

    fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf-8')
  } catch (error) {
    logger.error('AIConfig', 'Error updating .env.local', {
      data: { error: error instanceof Error ? error.message : error },
    })
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/utils/ai-config.ts
git commit -m "feat: extend AISettings to support multiple providers"
```

---

## Task 2: 更新设置 API Schema

**Files:**
- Modify: `src/app/api/admin/settings/ai/route.ts`

**Step 1: 扩展 Zod Schema**

```typescript
import { NextRequest } from 'next/server'
import { requireAuth, requireRole } from '@/lib/utils/auth'
import {
  successResponse,
  serverErrorResponse,
  validationErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/utils/api-response'
import { logger } from '@/lib/utils/logger'
import { z } from 'zod'
import { readAISettings, writeAISettings, updateEnvFile } from '@/lib/utils/ai-config'

const AISettingsSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(['fastgpt', 'openai', 'yuxi-legacy']).optional(),

  // FastGPT
  fastgpt_url: z.string().optional(),
  fastgpt_appid: z.string().optional(),
  fastgpt_api_key: z.string().optional(),

  // OpenAI Compatible
  openai_url: z.string().optional(),
  openai_api_key: z.string().optional(),
  openai_model: z.string().optional(),

  // Yuxi-Know Legacy
  yuxi_url: z.string().optional(),
  yuxi_username: z.string().optional(),
  yuxi_password: z.string().optional(),
  yuxi_agent_id: z.string().optional(),

  // Common (legacy)
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  system_prompt: z.string().optional(),
})

export async function GET() {
  try {
    await requireAuth()
    await requireRole(['admin'])

    const settings = readAISettings()

    // Convert to API response format (snake_case)
    const response = {
      enabled: settings.enabled,
      provider: settings.provider,
      // FastGPT
      fastgpt_url: settings.fastgptUrl,
      fastgpt_appid: settings.fastgptAppId,
      fastgpt_api_key: settings.fastgptApiKey ? '********' : '', // Mask
      // OpenAI
      openai_url: settings.openaiUrl,
      openai_api_key: settings.openaiApiKey ? '********' : '',
      openai_model: settings.openaiModel,
      // Yuxi Legacy
      yuxi_url: settings.yuxiUrl,
      yuxi_username: settings.yuxiUsername,
      yuxi_password: settings.yuxiPassword ? '********' : '',
      yuxi_agent_id: settings.yuxiAgentId,
      // Common
      model: settings.model,
      temperature: settings.temperature,
      system_prompt: settings.systemPrompt,
    }

    return successResponse(response)
  } catch (error: unknown) {
    const err = error as Error
    if (err.message === 'Unauthorized') {
      return unauthorizedResponse('You must be logged in')
    }
    if (err.message === 'Forbidden') {
      return forbiddenResponse('Admin access required')
    }
    logger.error('AISettings', 'Error fetching settings', { data: { error: err.message } })
    return serverErrorResponse('Failed to fetch AI settings', err.message)
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAuth()
    await requireRole(['admin'])

    const body = await request.json()
    const validation = AISettingsSchema.safeParse(body)

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    const data = validation.data

    // Convert from snake_case to camelCase
    const settings: Record<string, unknown> = {}

    if (data.enabled !== undefined) settings.enabled = data.enabled
    if (data.provider !== undefined) settings.provider = data.provider

    // FastGPT
    if (data.fastgpt_url !== undefined) settings.fastgptUrl = data.fastgpt_url
    if (data.fastgpt_appid !== undefined) settings.fastgptAppId = data.fastgpt_appid
    if (data.fastgpt_api_key && data.fastgpt_api_key !== '********') {
      settings.fastgptApiKey = data.fastgpt_api_key
    }

    // OpenAI
    if (data.openai_url !== undefined) settings.openaiUrl = data.openai_url
    if (data.openai_api_key && data.openai_api_key !== '********') {
      settings.openaiApiKey = data.openai_api_key
    }
    if (data.openai_model !== undefined) settings.openaiModel = data.openai_model

    // Yuxi Legacy
    if (data.yuxi_url !== undefined) settings.yuxiUrl = data.yuxi_url
    if (data.yuxi_username !== undefined) settings.yuxiUsername = data.yuxi_username
    if (data.yuxi_password && data.yuxi_password !== '********') {
      settings.yuxiPassword = data.yuxi_password
    }
    if (data.yuxi_agent_id !== undefined) settings.yuxiAgentId = data.yuxi_agent_id

    // Common
    if (data.model !== undefined) settings.model = data.model
    if (data.temperature !== undefined) settings.temperature = data.temperature
    if (data.system_prompt !== undefined) settings.systemPrompt = data.system_prompt

    writeAISettings(settings)

    // Legacy: update .env.local for FastGPT API key
    if (data.fastgpt_api_key && data.fastgpt_api_key !== '********') {
      try {
        updateEnvFile(data.fastgpt_api_key)
      } catch {
        // Continue anyway
      }
    }

    return successResponse({ message: 'Settings saved successfully' })
  } catch (error: unknown) {
    const err = error as Error
    if (err.message === 'Unauthorized') {
      return unauthorizedResponse('You must be logged in')
    }
    if (err.message === 'Forbidden') {
      return forbiddenResponse('Admin access required')
    }
    logger.error('AISettings', 'Error saving settings', { data: { error: err.message } })
    return serverErrorResponse('Failed to save AI settings', err.message)
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/admin/settings/ai/route.ts
git commit -m "feat: extend AI settings API for multiple providers"
```

---

## Task 3: 创建 Provider 处理模块

**Files:**
- Create: `src/lib/ai/providers/index.ts`
- Create: `src/lib/ai/providers/fastgpt.ts`
- Create: `src/lib/ai/providers/openai-compat.ts`
- Create: `src/lib/ai/providers/yuxi-legacy.ts`

**Step 1: 创建目录结构**

```bash
mkdir -p src/lib/ai/providers
```

**Step 2: 创建 Provider 接口**

`src/lib/ai/providers/index.ts`:

```typescript
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
```

**Step 3: FastGPT Provider (提取现有逻辑)**

`src/lib/ai/providers/fastgpt.ts`:

```typescript
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
        logger.error('FastGPT', 'API error', { status: response.status, error: errorText.slice(0, 200) })
        return { success: false, error: 'Failed to get AI response' }
      }

      const data = await response.json()
      const aiMessage = data.choices?.[0]?.message?.content || data.data || 'Sorry, I could not generate a response.'

      return {
        success: true,
        data: { message: aiMessage, model: settings.model || 'FastGPT' },
      }
    } catch (error) {
      logger.error('FastGPT', 'Request failed', { error: error instanceof Error ? error.message : error })
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
```

**Step 4: OpenAI Compatible Provider**

`src/lib/ai/providers/openai-compat.ts`:

```typescript
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
        logger.error('OpenAI', 'API error', { status: response.status, error: errorText.slice(0, 200) })
        return { success: false, error: 'Failed to get AI response' }
      }

      const data = await response.json()
      const aiMessage = data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.'

      return {
        success: true,
        data: { message: aiMessage, model: settings.openaiModel },
      }
    } catch (error) {
      logger.error('OpenAI', 'Request failed', { error: error instanceof Error ? error.message : error })
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
```

**Step 5: Yuxi-Know Legacy Provider (JWT + 流式)**

`src/lib/ai/providers/yuxi-legacy.ts`:

```typescript
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
        logger.error('YuxiLegacy', 'API error', { status: response.status, error: errorText.slice(0, 200) })
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
      logger.error('YuxiLegacy', 'Request failed', { error: error instanceof Error ? error.message : error })
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
```

**Step 6: Commit**

```bash
git add src/lib/ai/providers/
git commit -m "feat: add AI provider modules for FastGPT, OpenAI, Yuxi-Legacy"
```

---

## Task 4: 重构 Chat API 使用 Provider

**Files:**
- Modify: `src/app/api/ai/chat/route.ts`

**Step 1: 重构为使用 Provider**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { readAISettings } from '@/lib/utils/ai-config'
import { getApiLogger } from '@/lib/utils/api-logger'
import { FastGPTProvider, OpenAICompatProvider, YuxiLegacyProvider } from '@/lib/ai/providers'

const ChatRequestSchema = z.object({
  conversationId: z.string(),
  message: z.string(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .optional(),
})

const providers = {
  fastgpt: new FastGPTProvider(),
  openai: new OpenAICompatProvider(),
  'yuxi-legacy': new YuxiLegacyProvider(),
}

export async function POST(request: NextRequest) {
  const log = getApiLogger('AIChatAPI', request)
  const startedAt = Date.now()

  try {
    const body = await request.json()
    const parsed = ChatRequestSchema.safeParse(body)

    if (!parsed.success) {
      log.warning('Invalid request body', { errors: parsed.error.errors })
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
    }

    const settings = readAISettings()

    if (!settings.enabled) {
      log.warning('AI chat is disabled')
      return NextResponse.json({ success: false, error: 'AI chat is disabled' }, { status: 403 })
    }

    const provider = providers[settings.provider]
    if (!provider) {
      log.error('Unknown provider', { provider: settings.provider })
      return NextResponse.json({ success: false, error: 'Unknown AI provider' }, { status: 500 })
    }

    log.info('Chat request', {
      provider: settings.provider,
      conversationId: parsed.data.conversationId,
      messageLength: parsed.data.message.length,
      historyLength: parsed.data.history?.length || 0,
    })

    const result = await provider.chat(parsed.data, settings)

    log.info('Chat response', {
      provider: settings.provider,
      success: result.success,
      latencyMs: Date.now() - startedAt,
      responseLength: result.data?.message?.length,
    })

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    })
  } catch (error) {
    log.error('AI chat error', {
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : error,
    })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/ai/chat/route.ts
git commit -m "refactor: use provider pattern for AI chat API"
```

---

## Task 5: 添加连接测试 API

**Files:**
- Modify: `src/app/api/admin/settings/ai/test/route.ts`

**Step 1: 重构测试端点**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireRole } from '@/lib/utils/auth'
import { readAISettings } from '@/lib/utils/ai-config'
import { FastGPTProvider, OpenAICompatProvider, YuxiLegacyProvider } from '@/lib/ai/providers'

const providers = {
  fastgpt: new FastGPTProvider(),
  openai: new OpenAICompatProvider(),
  'yuxi-legacy': new YuxiLegacyProvider(),
}

export async function POST(_request: NextRequest) {
  try {
    await requireAuth()
    await requireRole(['admin'])

    const settings = readAISettings()

    if (!settings.enabled) {
      return NextResponse.json({
        success: false,
        error: 'AI is not enabled',
      })
    }

    const provider = providers[settings.provider]
    if (!provider) {
      return NextResponse.json({
        success: false,
        error: `Unknown provider: ${settings.provider}`,
      })
    }

    const result = await provider.testConnection(settings)

    return NextResponse.json({
      success: result.success,
      provider: settings.provider,
      error: result.error,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/admin/settings/ai/test/route.ts
git commit -m "refactor: use provider pattern for AI connection test"
```

---

## Task 6: 更新前端设置页面

**Files:**
- Modify: `src/app/admin/settings/page.tsx`
- Modify: `messages/en.json`
- Modify: `messages/zh-CN.json`

**Step 1: 更新设置页面 UI**

更新 `src/app/admin/settings/page.tsx`，添加 Provider 选择和各配置区块：

关键改动：
1. 添加 `provider` 单选按钮组 (FastGPT / OpenAI 兼容 / Yuxi-Know)
2. 根据选择显示对应配置区块
3. Yuxi-Know 区块包含用户名/密码/智能体ID字段

```tsx
// 类型定义
interface AISettings {
  enabled: boolean
  provider: 'fastgpt' | 'openai' | 'yuxi-legacy'
  // FastGPT
  fastgpt_url: string
  fastgpt_appid: string
  fastgpt_api_key: string
  // OpenAI
  openai_url: string
  openai_api_key: string
  openai_model: string
  // Yuxi Legacy
  yuxi_url: string
  yuxi_username: string
  yuxi_password: string
  yuxi_agent_id: string
  // Common
  model: string
  temperature: number
  system_prompt: string
}

// Provider 选择 UI
<RadioGroup
  value={aiSettings.provider}
  onValueChange={(value) => setAISettings({ ...aiSettings, provider: value as AISettings['provider'] })}
>
  <div className="flex gap-4">
    <RadioGroupItem value="fastgpt" id="fastgpt" />
    <Label htmlFor="fastgpt">FastGPT</Label>

    <RadioGroupItem value="openai" id="openai" />
    <Label htmlFor="openai">{t('provider.openai')}</Label>

    <RadioGroupItem value="yuxi-legacy" id="yuxi-legacy" />
    <Label htmlFor="yuxi-legacy">Yuxi-Know</Label>
  </div>
</RadioGroup>

// 条件渲染配置区块
{aiSettings.provider === 'fastgpt' && (
  <FastGPTConfig settings={aiSettings} onChange={setAISettings} />
)}

{aiSettings.provider === 'openai' && (
  <OpenAIConfig settings={aiSettings} onChange={setAISettings} />
)}

{aiSettings.provider === 'yuxi-legacy' && (
  <YuxiLegacyConfig settings={aiSettings} onChange={setAISettings} />
)}
```

**Step 2: 添加国际化**

`messages/en.json` 在 `settings.ai` 下添加：

```json
{
  "provider": {
    "label": "AI Provider",
    "fastgpt": "FastGPT",
    "openai": "OpenAI Compatible",
    "yuxiLegacy": "Yuxi-Know (Native)"
  },
  "openai": {
    "title": "OpenAI Compatible Configuration",
    "url": "API Base URL",
    "urlHint": "e.g., https://api.openai.com or your compatible endpoint",
    "apiKey": "API Key",
    "apiKeyHint": "Your API key",
    "model": "Model",
    "modelHint": "e.g., gpt-4o-mini, chatbot"
  },
  "yuxiLegacy": {
    "title": "Yuxi-Know Configuration",
    "url": "Base URL",
    "urlHint": "e.g., https://yuxi.example.com",
    "username": "Username",
    "usernameHint": "Yuxi-Know login username",
    "password": "Password",
    "passwordHint": "Yuxi-Know login password",
    "agentId": "Agent ID",
    "agentIdHint": "e.g., chatbot"
  }
}
```

**Step 3: Commit**

```bash
git add src/app/admin/settings/page.tsx messages/*.json
git commit -m "feat: add multi-provider UI in admin settings"
```

---

## 验证清单

- [ ] 三种 Provider 配置可以正常保存和读取
- [ ] FastGPT 保持现有功能正常
- [ ] OpenAI 兼容模式可以连接并聊天
- [ ] Yuxi-Know 原生模式可以获取 JWT 并处理流式响应
- [ ] 连接测试按钮对三种 Provider 都有效
- [ ] 切换 Provider 后配置区块正确显示/隐藏

---

## 测试命令

```bash
# 启动开发服务器
npm run dev

# 访问设置页面
# http://localhost:3010/admin/settings

# 测试各 Provider:
# 1. 选择 FastGPT，填写配置，测试连接
# 2. 选择 OpenAI 兼容，填写配置，测试连接
# 3. 选择 Yuxi-Know，填写用户名密码，测试连接
# 4. 保存后发起 AI 对话验证
```
