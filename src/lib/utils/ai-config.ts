/**
 * AI Configuration Utility
 * 
 * Handles reading and writing AI auto-reply configuration
 * Uses hybrid approach:
 * - Sensitive data (API keys) stored in .env.local
 * - Other settings stored in config/ai-settings.json
 */

import fs from 'fs'
import path from 'path'
import { logger } from '@/lib/utils/logger'

export interface AISettings {
  enabled: boolean
  model: string
  temperature: number
  systemPrompt: string
  fastgptUrl: string
  fastgptAppId: string
  fastgptApiKey: string
}

const CONFIG_PATH = path.join(process.cwd(), 'config', 'ai-settings.json')

/**
 * Read AI settings from config file and environment variables
 */
export function readAISettings(): AISettings {
  try {
    // Read from config file
    let fileSettings = {
      enabled: false,
      model: 'GPT-4o-mini',
      temperature: 0.7,
      systemPrompt: 'You are a helpful customer service assistant.',
      fastgptUrl: '',
      fastgptAppId: '',
    }

    if (fs.existsSync(CONFIG_PATH)) {
      const fileContent = fs.readFileSync(CONFIG_PATH, 'utf-8')
      fileSettings = JSON.parse(fileContent)
    }

    // Merge with environment variables (API key from env)
    return {
      ...fileSettings,
      fastgptApiKey: process.env.FASTGPT_API_KEY || '',
    }
  } catch (error) {
    logger.error('AIConfig', 'Error reading settings', { data: { error: error instanceof Error ? error.message : error } })
    // Return default settings on error
    return {
      enabled: false,
      model: 'GPT-4o-mini',
      temperature: 0.7,
      systemPrompt: 'You are a helpful customer service assistant.',
      fastgptUrl: '',
      fastgptAppId: '',
      fastgptApiKey: process.env.FASTGPT_API_KEY || '',
    }
  }
}

/**
 * Write AI settings to config file
 * Note: API key is NOT written to file, only to .env.local manually
 */
export function writeAISettings(settings: Partial<AISettings>): void {
  try {
    // Ensure config directory exists
    const configDir = path.dirname(CONFIG_PATH)
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }

    // Read current settings
    const currentSettings = readAISettings()

    // Merge with new settings (exclude API key from file)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { fastgptApiKey, ...fileSettings } = {
      ...currentSettings,
      ...settings,
    }

    // Write to config file
    fs.writeFileSync(
      CONFIG_PATH,
      JSON.stringify(fileSettings, null, 2),
      'utf-8'
    )

    // Log warning if API key was provided but not saved to file
    if (settings.fastgptApiKey) {
      logger.warning('AIConfig', 'FastGPT API Key was provided but NOT saved to config file', {})
      logger.warning('AIConfig', 'To persist the API key, add it to .env.local: FASTGPT_API_KEY=your-key', {})
    }
  } catch (error) {
    logger.error('AIConfig', 'Error writing settings', { data: { error: error instanceof Error ? error.message : error } })
    throw new Error('Failed to save AI settings')
  }
}

/**
 * Update .env.local file with FastGPT API key
 * Note: This requires manual server restart to take effect
 */
export function updateEnvFile(apiKey: string): void {
  try {
    const envPath = path.join(process.cwd(), '.env.local')
    let envContent = ''

    // Read existing .env.local
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8')
    }

    // Check if FASTGPT_API_KEY already exists
    const apiKeyRegex = /^FASTGPT_API_KEY=.*$/m
    if (apiKeyRegex.test(envContent)) {
      // Update existing key
      envContent = envContent.replace(apiKeyRegex, `FASTGPT_API_KEY=${apiKey}`)
    } else {
      // Add new key
      if (!envContent.endsWith('\n')) {
        envContent += '\n'
      }
      envContent += `FASTGPT_API_KEY=${apiKey}\n`
    }

    // Write back to .env.local
    fs.writeFileSync(envPath, envContent, 'utf-8')

    logger.warning('AIConfig', 'Server restart required for changes to take effect', {})
  } catch (error) {
    logger.error('AIConfig', 'Error updating .env.local', { data: { error: error instanceof Error ? error.message : error } })
    throw new Error('Failed to update .env.local file')
  }
}

