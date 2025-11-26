#!/usr/bin/env node

/**
 * Translation File Validation Script
 *
 * This script validates that all translation files have:
 * 1. Identical key structures
 * 2. Consistent interpolation variables
 * 3. No empty values
 * 4. Proper JSON format
 *
 * Usage:
 *   node scripts/validate-i18n.js
 *
 * Exit Codes:
 *   0 - All validations passed
 *   1 - Validation errors found
 */

const fs = require('fs')
const path = require('path')

// Supported locales
const LOCALES = ['en', 'zh-CN', 'fr', 'es', 'ru', 'pt']
const MESSAGES_DIR = path.join(__dirname, '..', 'messages')

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

/**
 * Log with color
 */
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

/**
 * Load all translation files
 */
function loadTranslations() {
  const translations = {}

  for (const locale of LOCALES) {
    const filePath = path.join(MESSAGES_DIR, `${locale}.json`)

    if (!fs.existsSync(filePath)) {
      log(`⚠️  Translation file not found: ${locale}.json`, 'yellow')
      continue
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      translations[locale] = JSON.parse(content)
    } catch (error) {
      log(`❌ Failed to parse ${locale}.json: ${error.message}`, 'red')
      process.exit(1)
    }
  }

  return translations
}

/**
 * Get all keys from a nested object
 */
function getAllKeys(obj, prefix = '') {
  let keys = []

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys = keys.concat(getAllKeys(value, fullKey))
    } else {
      keys.push(fullKey)
    }
  }

  return keys.sort()
}

/**
 * Get value by path
 */
function getValueByPath(obj, path) {
  const parts = path.split('.')
  let current = obj

  for (const part of parts) {
    if (current === undefined || current === null) {
      return undefined
    }
    current = current[part]
  }

  return current
}

/**
 * Extract interpolation variables from a string
 * e.g., "Hello {name}, you have {count} items" -> ['name', 'count']
 */
function extractVariables(str) {
  if (typeof str !== 'string') return []

  const matches = str.match(/\{(\w+)\}/g)
  if (!matches) return []

  return matches.map((match) => match.slice(1, -1)).sort()
}

/**
 * Check if two arrays are equal (order-independent)
 */
function arraysEqual(a, b) {
  if (a.length !== b.length) return false

  const sortedA = [...a].sort()
  const sortedB = [...b].sort()

  return sortedA.every((value, index) => value === sortedB[index])
}

/**
 * Find empty values in nested object
 */
function findEmptyKeys(obj, prefix = '') {
  let emptyKeys = []

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      emptyKeys = emptyKeys.concat(findEmptyKeys(value, fullKey))
    } else if (value === '' || value === null || value === undefined) {
      emptyKeys.push(fullKey)
    }
  }

  return emptyKeys
}

/**
 * Validation 1: Check structural consistency
 */
function checkStructuralConsistency(translations) {
  log('\n📋 Checking structural consistency...', 'cyan')

  const enKeys = getAllKeys(translations['en'])
  let hasErrors = false

  for (const locale of LOCALES) {
    if (locale === 'en' || !translations[locale]) continue

    const localeKeys = getAllKeys(translations[locale])

    // Find missing keys
    const missingKeys = enKeys.filter((key) => !localeKeys.includes(key))

    // Find extra keys
    const extraKeys = localeKeys.filter((key) => !enKeys.includes(key))

    if (missingKeys.length > 0) {
      log(`\n❌ ${locale}.json is missing ${missingKeys.length} keys:`, 'red')
      missingKeys.slice(0, 10).forEach((key) => {
        log(`   - ${key}`, 'red')
      })
      if (missingKeys.length > 10) {
        log(`   ... and ${missingKeys.length - 10} more`, 'red')
      }
      hasErrors = true
    }

    if (extraKeys.length > 0) {
      log(`\n⚠️  ${locale}.json has ${extraKeys.length} extra keys:`, 'yellow')
      extraKeys.slice(0, 10).forEach((key) => {
        log(`   - ${key}`, 'yellow')
      })
      if (extraKeys.length > 10) {
        log(`   ... and ${extraKeys.length - 10} more`, 'yellow')
      }
      hasErrors = true
    }

    if (missingKeys.length === 0 && extraKeys.length === 0) {
      log(`✅ ${locale}.json has all required keys`, 'green')
    }
  }

  return !hasErrors
}

/**
 * Validation 2: Check interpolation variable consistency
 */
function checkInterpolationConsistency(translations) {
  log('\n🔤 Checking interpolation variable consistency...', 'cyan')

  const enKeys = getAllKeys(translations['en'])
  let hasErrors = false

  for (const key of enKeys) {
    const enValue = getValueByPath(translations['en'], key)
    const enVars = extractVariables(enValue)

    // Skip if no variables in English version
    if (enVars.length === 0) continue

    for (const locale of LOCALES) {
      if (locale === 'en' || !translations[locale]) continue

      const localeValue = getValueByPath(translations[locale], key)
      const localeVars = extractVariables(localeValue)

      if (!arraysEqual(enVars, localeVars)) {
        log(`\n❌ Variable mismatch in "${key}":`, 'red')
        log(`   en: {${enVars.join(', ')}}`, 'red')
        log(`   ${locale}: {${localeVars.join(', ')}}`, 'red')
        hasErrors = true
      }
    }
  }

  if (!hasErrors) {
    log('✅ All interpolation variables are consistent', 'green')
  }

  return !hasErrors
}

/**
 * Validation 3: Check for empty values
 */
function checkEmptyValues(translations) {
  log('\n🔍 Checking for empty values...', 'cyan')

  let hasErrors = false

  for (const locale of LOCALES) {
    if (!translations[locale]) continue

    const emptyKeys = findEmptyKeys(translations[locale])

    if (emptyKeys.length > 0) {
      log(`\n⚠️  ${locale}.json has ${emptyKeys.length} empty values:`, 'yellow')
      emptyKeys.slice(0, 10).forEach((key) => {
        log(`   - ${key}`, 'yellow')
      })
      if (emptyKeys.length > 10) {
        log(`   ... and ${emptyKeys.length - 10} more`, 'yellow')
      }
      hasErrors = true
    } else {
      log(`✅ ${locale}.json has no empty values`, 'green')
    }
  }

  return !hasErrors
}

/**
 * Validation 4: Check file existence
 */
function checkFileExistence() {
  log('\n📁 Checking translation file existence...', 'cyan')

  let allExist = true

  for (const locale of LOCALES) {
    const filePath = path.join(MESSAGES_DIR, `${locale}.json`)

    if (fs.existsSync(filePath)) {
      log(`✅ ${locale}.json exists`, 'green')
    } else {
      log(`❌ ${locale}.json is missing`, 'red')
      allExist = false
    }
  }

  return allExist
}

/**
 * Main validation function
 */
function main() {
  log('\n🌍 Translation File Validation', 'blue')
  log('='.repeat(50), 'blue')

  // Step 1: Check file existence
  const filesExist = checkFileExistence()
  if (!filesExist) {
    log('\n❌ Some translation files are missing. Please create them first.', 'red')
    process.exit(1)
  }

  // Step 2: Load translations
  log('\n📥 Loading translation files...', 'cyan')
  const translations = loadTranslations()

  const localesLoaded = Object.keys(translations).length
  log(`✅ Loaded ${localesLoaded} translation files`, 'green')

  if (localesLoaded < LOCALES.length) {
    log(
      `⚠️  Warning: Only ${localesLoaded} out of ${LOCALES.length} files were loaded`,
      'yellow'
    )
  }

  // Step 3: Run validations
  const results = {
    structural: checkStructuralConsistency(translations),
    interpolation: checkInterpolationConsistency(translations),
    emptyValues: checkEmptyValues(translations),
  }

  // Step 4: Summary
  log('\n' + '='.repeat(50), 'blue')
  log('📊 Validation Summary', 'blue')
  log('='.repeat(50), 'blue')

  const allPassed = Object.values(results).every((result) => result === true)

  if (allPassed) {
    log('\n✅ All validations passed!', 'green')
    log('\n🎉 Translation files are consistent and ready to use.', 'green')
    process.exit(0)
  } else {
    log('\n❌ Some validations failed:', 'red')

    if (!results.structural) {
      log('   - Structural consistency: FAILED', 'red')
    } else {
      log('   - Structural consistency: PASSED', 'green')
    }

    if (!results.interpolation) {
      log('   - Interpolation consistency: FAILED', 'red')
    } else {
      log('   - Interpolation consistency: PASSED', 'green')
    }

    if (!results.emptyValues) {
      log('   - Empty values: FAILED', 'red')
    } else {
      log('   - Empty values: PASSED', 'green')
    }

    log('\n⚠️  Please fix the errors above before committing.', 'yellow')
    process.exit(1)
  }
}

// Run the validation
main()
