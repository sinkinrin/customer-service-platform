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
