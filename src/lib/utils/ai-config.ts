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
export type AIChatMode = 'flash' | 'pro'

export interface AISettings {
  enabled: boolean
  provider: AIProvider

  // FastGPT (existing)
  fastgptUrl: string
  fastgptAppId: string
  fastgptApiKey: string
  fastgptProAppId: string
  fastgptProApiKey: string

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

  // QA Review - Retest
  qaRetestAppId: string  // 重测用的 FastGPT App ID

  // QA Review - Reserved for future FastGPT sync
  qaApps: Array<{
    id: string       // 内部标识，也用于 env var 名构建: AI_QA_APP_{ID}_KEY
    name: string     // 显示名称
    appId: string    // FastGPT App ID
  }>
}

const CONFIG_PATH = path.join(process.cwd(), 'config', 'ai-settings.json')

const DEFAULT_SETTINGS: AISettings = {
  enabled: false,
  provider: 'fastgpt',

  // FastGPT
  fastgptUrl: '',
  fastgptAppId: '',
  fastgptApiKey: '',
  fastgptProAppId: '',
  fastgptProApiKey: '',

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

  // QA Review
  qaRetestAppId: '',
  qaApps: [],
}

/**
 * Read AI settings from config file + environment variables.
 * Environment variables still take precedence when present.
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
      // Environment variables take priority, then fall back to persisted settings.
      fastgptApiKey: process.env.FASTGPT_API_KEY || process.env.AI_FASTGPT_API_KEY || fileSettings.fastgptApiKey || '',
      fastgptProAppId: process.env.FASTGPT_PRO_APP_ID || process.env.AI_FASTGPT_PRO_APP_ID || fileSettings.fastgptProAppId || '',
      fastgptProApiKey: process.env.FASTGPT_PRO_API_KEY || process.env.AI_FASTGPT_PRO_API_KEY || fileSettings.fastgptProApiKey || '',
      openaiApiKey: process.env.AI_OPENAI_API_KEY || fileSettings.openaiApiKey || '',
      yuxiUsername: process.env.AI_YUXI_USERNAME || fileSettings.yuxiUsername || '',
      yuxiPassword: process.env.AI_YUXI_PASSWORD || fileSettings.yuxiPassword || '',
    }
  } catch (error) {
    logger.error('AIConfig', 'Error reading settings', {
      data: { error: error instanceof Error ? error.message : error },
    })
    return DEFAULT_SETTINGS
  }
}

export function resolveAIChatSettings(settings: AISettings, mode: AIChatMode): AISettings {
  if (settings.provider !== 'fastgpt' || mode === 'flash') {
    return settings
  }

  return {
    ...settings,
    // FastGPT chat completions select the app through the app-specific API key.
    // Keep appId aligned for related non-chat endpoints that require it.
    fastgptAppId: settings.fastgptProAppId || settings.fastgptAppId,
    fastgptApiKey: settings.fastgptProApiKey,
  }
}

type PersistedAISettings = Omit<
  Partial<AISettings>,
  'fastgptApiKey' | 'fastgptProApiKey' | 'openaiApiKey' | 'yuxiUsername' | 'yuxiPassword'
>

export function sanitizeAISettingsForFile(settings: Partial<AISettings>): PersistedAISettings {
  const {
    fastgptApiKey: _fastgptApiKey,
    fastgptProApiKey: _fastgptProApiKey,
    openaiApiKey: _openaiApiKey,
    yuxiUsername: _yuxiUsername,
    yuxiPassword: _yuxiPassword,
    ...persistable
  } = settings

  return persistable
}

/**
 * Write AI settings to config file.
 * Admin-managed credentials are persisted here so settings survive restarts
 * even when the deployment platform does not support runtime env mutation.
 */
export function writeAISettings(settings: Partial<AISettings>): void {
  try {
    const configDir = path.dirname(CONFIG_PATH)
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }

    const currentSettings = readAISettings()
    const newSettings = { ...currentSettings, ...settings }
    const fileSettings = sanitizeAISettingsForFile(newSettings)

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(fileSettings, null, 2), 'utf-8')
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
  updateEnvFileValues({ FASTGPT_API_KEY: apiKey })
}

export function updateEnvFileValues(values: Record<string, string>): void {
  const envPath = path.join(process.cwd(), '.env.local')
  try {
    let envContent = ''
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8')
    }

    for (const [key, value] of Object.entries(values)) {
      const keyPattern = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=.*$`, 'm')
      if (keyPattern.test(envContent)) {
        envContent = envContent.replace(keyPattern, `${key}=${value}`)
      } else {
        envContent += `${envContent.endsWith('\n') || envContent.length === 0 ? '' : '\n'}${key}=${value}\n`
      }
    }

    fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf-8')
  } catch (error) {
    logger.error('AIConfig', 'Error updating .env.local', {
      data: { error: error instanceof Error ? error.message : error },
    })
  }
}
