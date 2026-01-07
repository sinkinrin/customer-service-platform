#!/usr/bin/env node

/**
 * Hardcoded String Detection Script
 *
 * This script detects hardcoded strings in the codebase that should be internationalized.
 * It scans:
 * 1. JSX/TSX content (e.g., <Label>Email</Label>)
 * 2. Toast messages (e.g., toast.success('Success!'))
 * 3. String literals in components
 *
 * Usage:
 *   node scripts/detect-hardcoded-strings.js
 *   node scripts/detect-hardcoded-strings.js --verbose
 *   node scripts/detect-hardcoded-strings.js --fix
 *
 * Options:
 *   --verbose    Show more details
 *   --json       Output in JSON format
 *   --fix        Suggest fixes (not implemented yet)
 */

const fs = require('fs')
const path = require('path')

// Directories to scan
const SCAN_DIRS = ['src/app', 'src/components', 'src/lib']

// File extensions to scan
const FILE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js']

// Whitelist: Technical terms and acceptable strings
const WHITELIST = [
  'OK',
  'ID',
  'API',
  'URL',
  'HTTP',
  'HTTPS',
  'JSON',
  'XML',
  'CSV',
  'PDF',
  'UI',
  'UX',
  'SEO',
  'SQL',
  'FAQ',
  'Promise',
]

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
}

// Command line args
const args = process.argv.slice(2)
const verbose = args.includes('--verbose')
const jsonOutput = args.includes('--json')

/**
 * Log with color
 */
function log(message, color = 'reset') {
  if (!jsonOutput) {
    console.log(`${colors[color]}${message}${colors.reset}`)
  }
}

/**
 * Get all files recursively
 */
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath)

  files.forEach((file) => {
    const filePath = path.join(dirPath, file)

    if (fs.statSync(filePath).isDirectory()) {
      // Skip node_modules, .next, .git
      if (!['node_modules', '.next', '.git', 'dist', 'build'].includes(file)) {
        arrayOfFiles = getAllFiles(filePath, arrayOfFiles)
      }
    } else {
      const ext = path.extname(file)
      if (FILE_EXTENSIONS.includes(ext)) {
        arrayOfFiles.push(filePath)
      }
    }
  })

  return arrayOfFiles
}

/**
 * Check if a string is in the whitelist
 */
function isWhitelisted(str) {
  return WHITELIST.some((term) => str.trim() === term)
}

/**
 * Check if a string is a Chinese string
 */
function isChinese(str) {
  return /[\u4e00-\u9fa5]/.test(str)
}

/**
 * Check if a string looks like English text
 */
function isEnglishText(str) {
  const text = str.trim()
  if (!text || text.length <= 1) return false
  if (!/[A-Za-z]/.test(text)) return false
  return /^[A-Za-z0-9\s,.:;!?'"()\-+&/%$#@*]+$/.test(text)
}

/**
 * Detect hardcoded strings in JSX content
 * Pattern: >text<
 */
function detectJSXStrings(content, filePath) {
  const issues = []

  // Match content between JSX tags
  const jsxPattern = />([^<>{}]+)</g
  let match

  while ((match = jsxPattern.exec(content)) !== null) {
    const text = match[1].trim()

    // Skip empty strings, whitespace, numbers, single characters
    if (!text || /^\s*$/.test(text) || /^\d+$/.test(text) || text.length === 1) {
      continue
    }

    // Skip whitelisted terms
    if (isWhitelisted(text)) {
      continue
    }

    // Check if it's Chinese or English text that should be translated
    if (isChinese(text) || isEnglishText(text)) {
      const lineNumber = content.substring(0, match.index).split('\n').length

      issues.push({
        type: 'JSX Content',
        file: filePath,
        line: lineNumber,
        content: text,
        suggestion: `Use t('namespace.key') instead of hardcoded "${text}"`,
      })
    }
  }

  return issues
}

/**
 * Detect hardcoded strings in Toast messages
 * Pattern: toast.success('message')
 */
function detectToastStrings(content, filePath) {
  const issues = []

  // Match toast.success/error/warning/info('...')
  const toastPattern = /toast\.(success|error|warning|info)\s*\(\s*['"`]([^'"`]+)['"`]/g
  let match

  while ((match = toastPattern.exec(content)) !== null) {
    const type = match[1]
    const message = match[2]

    // Skip if it's already using translation (contains 't(')
    if (message.includes('t(') || message.includes('tToast(')) {
      continue
    }

    const lineNumber = content.substring(0, match.index).split('\n').length

    issues.push({
      type: `Toast (${type})`,
      file: filePath,
      line: lineNumber,
      content: message,
      suggestion: `Use toast.${type}(t('toast.namespace.${type}Message'))`,
    })
  }

  return issues
}

/**
 * Detect hardcoded strings in JSX attributes
 */
function detectJsxAttributeStrings(content, filePath) {
  const issues = []
  const targets = [
    { name: 'placeholder', type: 'Placeholder', suggestion: "Use placeholder={t('namespace.fieldPlaceholder')}" },
    { name: 'aria-label', type: 'ARIA Label', suggestion: "Use aria-label={t('namespace.ariaLabel')}" },
    { name: 'aria-description', type: 'ARIA Description', suggestion: "Use aria-description={t('namespace.ariaDescription')}" },
    { name: 'aria-roledescription', type: 'ARIA Role Description', suggestion: "Use aria-roledescription={t('namespace.ariaRoleDescription')}" },
    { name: 'aria-placeholder', type: 'ARIA Placeholder', suggestion: "Use aria-placeholder={t('namespace.ariaPlaceholder')}" },
    { name: 'aria-valuetext', type: 'ARIA Value Text', suggestion: "Use aria-valuetext={t('namespace.ariaValueText')}" },
    { name: 'title', type: 'Title', suggestion: "Use title={t('namespace.title')}" },
    { name: 'alt', type: 'Alt Text', suggestion: "Use alt={t('namespace.imageAlt')}" },
  ]

  targets.forEach((target) => {
    const literalPattern = new RegExp(`${target.name}\\s*=\\s*['\"\\x60]([^'\"\\x60]+)['\"\\x60]`, 'g')
    const jsxLiteralPattern = new RegExp(`${target.name}\\s*=\\s*{\\s*['\"\\x60]([^'\"\\x60]+)['\"\\x60]\\s*}`, 'g')
    const patterns = [literalPattern, jsxLiteralPattern]

    patterns.forEach((pattern) => {
      let match
      while ((match = pattern.exec(content)) !== null) {
        const text = match[1]

        // Skip if it's already using translation
        if (text.includes('t(') || text.includes('{')) {
          continue
        }

        // Skip whitelisted
        if (isWhitelisted(text)) {
          continue
        }

        if (isChinese(text) || isEnglishText(text)) {
          const lineNumber = content.substring(0, match.index).split('\n').length
          issues.push({
            type: target.type,
            file: filePath,
            line: lineNumber,
            content: text,
            suggestion: target.suggestion,
          })
        }
      }
    })
  })

  return issues
}

/**
 * Detect hardcoded strings in object literals (label/title/description)
 */
function detectObjectLiteralStrings(content, filePath) {
  const issues = []
  const keys = ['label', 'title', 'description', 'placeholder', 'helperText', 'tooltip', 'text']
  const pattern = new RegExp(`\\b(${keys.join('|')})\\s*:\\s*['\"\\x60]([^'\"\\x60]+)['\"\\x60]`, 'g')
  let match

  while ((match = pattern.exec(content)) !== null) {
    const key = match[1]
    const text = match[2]

    if (text.includes('t(') || text.includes('{')) {
      continue
    }

    if (isWhitelisted(text)) {
      continue
    }

    if (isChinese(text) || isEnglishText(text)) {
      const lineNumber = content.substring(0, match.index).split('\n').length
      issues.push({
        type: `Object ${key}`,
        file: filePath,
        line: lineNumber,
        content: text,
        suggestion: `Use t('namespace.${key}') instead of hardcoded "${text}"`,
      })
    }
  }

  return issues
}

/**
 * Scan a single file
 */
function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')

  let issues = []

  issues = issues.concat(detectJSXStrings(content, filePath))
  issues = issues.concat(detectToastStrings(content, filePath))
  issues = issues.concat(detectJsxAttributeStrings(content, filePath))
  issues = issues.concat(detectObjectLiteralStrings(content, filePath))

  return issues
}

/**
 * Group issues by category
 */
function groupIssues(issues) {
  const grouped = {
    admin: [],
    customer: [],
    staff: [],
    api: [],
    lib: [],
    components: [],
  }

  issues.forEach((issue) => {
    if (issue.file.includes('app/api') || issue.file.includes('app\\api')) {
      grouped.api.push(issue)
    } else if (issue.file.includes(`${path.sep}lib${path.sep}`) || issue.file.includes('lib/')) {
      grouped.lib.push(issue)
    } else if (issue.file.includes('app/admin') || issue.file.includes('app\\admin')) {
      grouped.admin.push(issue)
    } else if (issue.file.includes('app/customer') || issue.file.includes('app\\customer')) {
      grouped.customer.push(issue)
    } else if (issue.file.includes('app/staff') || issue.file.includes('app\\staff')) {
      grouped.staff.push(issue)
    } else {
      grouped.components.push(issue)
    }
  })

  return grouped
}

/**
 * Print results
 */
function printResults(allIssues) {
  log('\n🔍 Hardcoded String Detection Report', 'blue')
  log('='.repeat(80), 'blue')

  if (allIssues.length === 0) {
    log('\n✅ No hardcoded strings found! Great job!', 'green')
    return
  }

  const grouped = groupIssues(allIssues)

  // Summary
  log(`\n📊 Total Issues Found: ${allIssues.length}`, 'yellow')
  log(`   - Admin pages: ${grouped.admin.length}`, 'cyan')
  log(`   - Customer pages: ${grouped.customer.length}`, 'cyan')
  log(`   - Staff pages: ${grouped.staff.length}`, 'cyan')
  log(`   - API routes: ${grouped.api.length}`, 'cyan')
  log(`   - Lib: ${grouped.lib.length}`, 'cyan')
  log(`   - Components: ${grouped.components.length}`, 'cyan')

  // Detailed report
  const categories = [
    { name: 'Admin Pages', issues: grouped.admin },
    { name: 'Customer Pages', issues: grouped.customer },
    { name: 'Staff Pages', issues: grouped.staff },
    { name: 'API Routes', issues: grouped.api },
    { name: 'Lib', issues: grouped.lib },
    { name: 'Shared Components', issues: grouped.components },
  ]

  categories.forEach(({ name, issues }) => {
    if (issues.length === 0) return

    log(`\n\n${name}`, 'cyan')
    log('-'.repeat(80), 'cyan')

    // Group by file
    const byFile = {}
    issues.forEach((issue) => {
      if (!byFile[issue.file]) {
        byFile[issue.file] = []
      }
      byFile[issue.file].push(issue)
    })

    Object.entries(byFile).forEach(([file, fileIssues]) => {
      const relPath = path.relative(process.cwd(), file)
      log(`\n📄 ${relPath} (${fileIssues.length} issues)`, 'magenta')

      fileIssues.forEach((issue) => {
        log(`   Line ${issue.line}: [${issue.type}]`, 'yellow')
        log(`   Content: "${issue.content}"`, 'red')
        if (verbose) {
          log(`   Suggestion: ${issue.suggestion}`, 'green')
        }
      })
    })
  })

  // Recommendations
  log('\n\n💡 Recommendations', 'blue')
  log('='.repeat(80), 'blue')
  log('\n1. Add missing translation keys to messages/*.json files')
  log('2. Update components to use useTranslations() hook')
  log('3. Follow the naming conventions in openspec/changes/complete-i18n-coverage/specs/')
  log('4. Run `npm run i18n:validate` after making changes')
  log('\n📚 See openspec/changes/complete-i18n-coverage/ for detailed guidelines')
}

/**
 * Main function
 */
function main() {
  log('\n🌍 Scanning for hardcoded strings...', 'cyan')

  let allFiles = []

  SCAN_DIRS.forEach((dir) => {
    const dirPath = path.join(process.cwd(), dir)
    if (fs.existsSync(dirPath)) {
      allFiles = allFiles.concat(getAllFiles(dirPath))
    } else {
      log(`⚠️  Directory not found: ${dir}`, 'yellow')
    }
  })

  log(`📁 Found ${allFiles.length} files to scan\n`, 'cyan')

  let allIssues = []

  allFiles.forEach((file) => {
    const issues = scanFile(file)
    allIssues = allIssues.concat(issues)

    if (verbose && issues.length > 0) {
      const relPath = path.relative(process.cwd(), file)
      log(`   ${relPath}: ${issues.length} issues`, 'yellow')
    }
  })

  if (jsonOutput) {
    console.log(JSON.stringify(allIssues, null, 2))
  } else {
    printResults(allIssues)
  }

  // Exit code
  process.exit(allIssues.length > 0 ? 1 : 0)
}

// Run the detection
main()
