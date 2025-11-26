#!/usr/bin/env node

/**
 * Find keys with English values in non-English translation files
 * This script compares non-English translation files with en.json
 * and reports keys that have identical values (likely untranslated).
 */

const fs = require('fs')
const path = require('path')

const LOCALES = ['en', 'zh-CN', 'fr', 'es', 'ru', 'pt']
const MESSAGES_DIR = path.join(__dirname, '..', 'messages')

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

/**
 * Load a translation file
 */
function loadTranslation(locale) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`)
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    log(`Error loading ${locale}.json: ${error.message}`, 'red')
    return null
  }
}

/**
 * Get all keys with their paths and values from a nested object
 */
function getAllKeysWithValues(obj, prefix = '') {
  const result = []

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result.push(...getAllKeysWithValues(value, fullKey))
    } else {
      result.push({ key: fullKey, value })
    }
  }

  return result
}

/**
 * Check if a string contains only English characters (no special language chars)
 */
function isLikelyEnglish(str) {
  if (typeof str !== 'string') return false

  // Check for common non-English characters
  const hasNonEnglish = /[\u00C0-\u024F\u0400-\u04FF\u4E00-\u9FFF]/.test(str)

  return !hasNonEnglish && /[a-zA-Z]/.test(str)
}

/**
 * Main function
 */
function main() {
  log('\n🔍 Finding Untranslated Keys', 'blue')
  log('='.repeat(50), 'blue')

  // Load all translations
  const translations = {}
  for (const locale of LOCALES) {
    translations[locale] = loadTranslation(locale)
  }

  const enKeysWithValues = getAllKeysWithValues(translations['en'])

  // Check each non-English locale
  for (const locale of LOCALES) {
    if (locale === 'en') continue

    log(`\n📝 Checking ${locale}.json...`, 'cyan')

    const localeKeysWithValues = getAllKeysWithValues(translations[locale])
    const untranslated = []

    for (const enItem of enKeysWithValues) {
      const localeItem = localeKeysWithValues.find((item) => item.key === enItem.key)

      if (localeItem) {
        // Check if values are identical (exact match)
        if (localeItem.value === enItem.value && isLikelyEnglish(enItem.value)) {
          untranslated.push({
            key: enItem.key,
            value: enItem.value,
          })
        }
      }
    }

    if (untranslated.length === 0) {
      log(`✅ All keys are translated!`, 'green')
    } else {
      log(`❌ Found ${untranslated.length} untranslated keys:`, 'red')

      // Group by top-level namespace
      const grouped = {}
      for (const item of untranslated) {
        const namespace = item.key.split('.')[0]
        if (!grouped[namespace]) {
          grouped[namespace] = []
        }
        grouped[namespace].push(item)
      }

      // Display grouped results
      for (const [namespace, items] of Object.entries(grouped)) {
        log(`\n  [${namespace}] (${items.length} keys):`, 'yellow')
        items.slice(0, 10).forEach((item) => {
          log(`    - ${item.key}: "${item.value}"`, 'reset')
        })
        if (items.length > 10) {
          log(`    ... and ${items.length - 10} more`, 'yellow')
        }
      }
    }
  }

  log('\n' + '='.repeat(50), 'blue')
  log('✅ Scan complete', 'green')
}

main()
