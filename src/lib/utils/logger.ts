/**
 * Structured Logger Utility
 *
 * Provides structured logging with:
 * - Different log levels (DEBUG, INFO, WARNING, ERROR)
 * - Environment-based filtering
 * - Request ID support for tracing
 * - JSON format output in production for log aggregation
 * - Sensitive data sanitization
 * - File-based persistence (optional, via LOG_TO_FILE=true)
 */

import 'server-only'

// Lazy-loaded file logger – the import is hidden behind Function() so that
// Turbopack / Webpack static analysis cannot trace into file-logger.ts.
// file-logger.ts uses Node.js-only modules (fs, path) which are unavailable
// in Edge Runtime (middleware). At runtime the guard in canWriteFileLogs()
// prevents this code path from ever executing in Edge environments.
let fileLoggerModulePromise: Promise<{ fileLogger: { write(entry: string): Promise<void> } }> | null = null

function canWriteFileLogs(): boolean {
  if (typeof process === 'undefined') return false
  if (process.env.NEXT_RUNTIME === 'edge') return false
  return process.env.LOG_TO_FILE === 'true'
}

async function writeLogToFile(entry: string): Promise<void> {
  if (!canWriteFileLogs()) return

  try {
    if (!fileLoggerModulePromise) {
      // Hidden from Turbopack static analysis via Function() constructor.
      // eslint-disable-next-line no-new-func
      fileLoggerModulePromise = new Function('return import("./file-logger")')() as Promise<{ fileLogger: { write(entry: string): Promise<void> } }>
    }
    const { fileLogger } = await fileLoggerModulePromise
    await fileLogger.write(entry)
  } catch {
    // Silently ignore file write errors to avoid log loops
  }
}

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
}

/**
 * Log entry structure
 */
interface LogEntry {
  timestamp: string
  level: LogLevel
  module: string
  message: string
  requestId?: string
  data?: unknown
}

/**
 * Options for logging with context
 */
export interface LogOptions {
  /** Request ID for tracing */
  requestId?: string
  /** Additional structured data */
  data?: unknown
}

/**
 * Sensitive keys that should be redacted in logs
 */
const SENSITIVE_KEYS = [
  'password',
  'token',
  'apikey',
  'api_key',
  'secret',
  'authorization',
  'cookie',
  'session',
  'credential',
]

/**
 * Sanitize data to remove sensitive information
 */
function sanitizeData(data: unknown, depth = 0): unknown {
  // Prevent infinite recursion
  if (depth > 10) return '[MAX_DEPTH]'

  if (data === null || data === undefined) {
    return data
  }

  if (typeof data === 'string') {
    // Mask email addresses: user@example.com → u***@example.com
    return data.replace(
      /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      (_, local: string, domain: string) => `${local[0]}***@${domain}`
    )
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item, depth + 1))
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase()
      if (SENSITIVE_KEYS.some((k) => lowerKey.includes(k))) {
        sanitized[key] = '[REDACTED]'
      } else {
        sanitized[key] = sanitizeData(value, depth + 1)
      }
    }
    return sanitized
  }

  return data
}

class Logger {
  private _minLevel: LogLevel | null = null
  private _initialized = false

  /**
   * Get environment mode - read fresh each time to handle runtime changes
   */
  private get isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development'
  }

  private get isProduction(): boolean {
    return process.env.NODE_ENV === 'production'
  }

  /**
   * Get minimum log level - lazy initialization to ensure env vars are loaded
   * Re-reads on first access after server starts
   */
  private get minLevel(): LogLevel {
    // Lazy initialization: read env vars on first actual use, not on module load
    if (this._minLevel === null) {
      const envLevelRaw = (
        process.env.NEXT_PUBLIC_LOG_LEVEL ||
        process.env.LOG_LEVEL ||
        ''
      )
        .trim()
        .toUpperCase()

      // Accept common aliases to reduce configuration foot-guns.
      // Supported inputs: DEBUG, INFO, WARN, WARNING, ERROR (case-insensitive)
      const normalized =
        envLevelRaw === 'WARN' ? LogLevel.WARNING : (envLevelRaw as LogLevel)

      const valid = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARNING, LogLevel.ERROR]

      // Default to INFO in both dev and prod. Production can be tightened via LOG_LEVEL/WARNING/ERROR.
      this._minLevel = valid.includes(normalized)
        ? normalized
        : LogLevel.INFO

      // Diagnostic output - use console.warn to survive removeConsole
      console.warn(
        `[Logger Init] NODE_ENV=${process.env.NODE_ENV}, ` +
        `LOG_LEVEL=${process.env.LOG_LEVEL}, ` +
        `NEXT_PUBLIC_LOG_LEVEL=${process.env.NEXT_PUBLIC_LOG_LEVEL}, ` +
        `minLevel=${this._minLevel}`
      )
      this._initialized = true
    }
    return this._minLevel
  }

  constructor() {
    // Empty constructor - initialization is lazy via minLevel getter
  }

  private levelWeight(level: LogLevel): number {
    switch (level) {
      case LogLevel.DEBUG:
        return 10
      case LogLevel.INFO:
        return 20
      case LogLevel.WARNING:
        return 30
      case LogLevel.ERROR:
        return 40
      default:
        return 50
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelWeight(level) >= this.levelWeight(this.minLevel)
  }

  /**
   * Format log for human-readable output (development)
   */
  private formatHumanReadable(entry: LogEntry): string {
    const { timestamp, level, module, message, requestId } = entry
    const reqIdPart = requestId ? ` [${requestId}]` : ''
    return `[${timestamp}] [${level}] [${module}]${reqIdPart} ${message}`
  }

  /**
   * Format log as JSON (production) for log aggregation
   */
  private formatJson(entry: LogEntry): string {
    const sanitizedData = entry.data ? sanitizeData(entry.data) : undefined
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level: entry.level,
      module: entry.module,
      message: entry.message,
      ...(entry.requestId && { requestId: entry.requestId }),
      ...(sanitizedData !== undefined && { data: sanitizedData }),
    })
  }

  private log(
    level: LogLevel,
    module: string,
    message: string,
    options?: LogOptions
  ) {
    if (!this.shouldLog(level)) {
      return
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      level,
      module,
      message,
      requestId: options?.requestId,
      data: options?.data,
    }

    // Choose format based on environment
    const output = this.isProduction
      ? this.formatJson(entry)
      : this.formatHumanReadable(entry)

    // In development, also log data separately for better readability
    const devData =
      !this.isProduction && options?.data
        ? sanitizeData(options.data)
        : undefined

    switch (level) {
      case LogLevel.DEBUG:
        devData !== undefined
          ? console.log(output, devData)
          : console.log(output)
        break
      case LogLevel.INFO:
        devData !== undefined
          ? console.info(output, devData)
          : console.info(output)
        break
      case LogLevel.WARNING:
        devData !== undefined
          ? console.warn(output, devData)
          : console.warn(output)
        break
      case LogLevel.ERROR:
        devData !== undefined
          ? console.error(output, devData)
          : console.error(output)
        break
    }

    // Write to file if enabled (always use JSON format for file logs)
    if (canWriteFileLogs()) {
      const fileEntry = this.formatJson(entry)
      void writeLogToFile(fileEntry)
    }
  }

  /**
   * Log debug message
   */
  debug(module: string, message: string, options?: LogOptions) {
    this.log(LogLevel.DEBUG, module, message, options)
  }

  /**
   * Log info message
   */
  info(module: string, message: string, options?: LogOptions) {
    this.log(LogLevel.INFO, module, message, options)
  }

  /**
   * Log warning message
   */
  warning(module: string, message: string, options?: LogOptions) {
    this.log(LogLevel.WARNING, module, message, options)
  }

  /**
   * Log warning message (alias for warning)
   */
  warn(module: string, message: string, options?: LogOptions) {
    this.log(LogLevel.WARNING, module, message, options)
  }

  /**
   * Log error message
   */
  error(module: string, message: string, options?: LogOptions) {
    this.log(LogLevel.ERROR, module, message, options)
  }
}

// Export singleton instance
export const logger = new Logger()

// ============================================================================
// Convenience functions (backward compatible)
// ============================================================================

/**
 * Log a debug message
 * @param module - Module/component name for categorization
 * @param message - Log message
 * @param data - Optional structured data to include
 */
export const logDebug = (module: string, message: string, data?: unknown) => {
  logger.debug(module, message, { data })
}

/**
 * Log an info message
 * @param module - Module/component name for categorization
 * @param message - Log message
 * @param data - Optional structured data to include
 */
export const logInfo = (module: string, message: string, data?: unknown) => {
  logger.info(module, message, { data })
}

/**
 * Log a warning message
 * @param module - Module/component name for categorization
 * @param message - Log message
 * @param data - Optional structured data to include
 */
export const logWarning = (module: string, message: string, data?: unknown) => {
  logger.warning(module, message, { data })
}

/**
 * Log an error message
 * @param module - Module/component name for categorization
 * @param message - Log message
 * @param data - Optional structured data to include (e.g., error details)
 */
export const logError = (module: string, message: string, data?: unknown) => {
  logger.error(module, message, { data })
}

// ============================================================================
// Request-scoped logger for API routes
// ============================================================================

/**
 * Create a request-scoped logger with pre-bound request ID
 *
 * @example
 * // In API route
 * const log = createRequestLogger('TicketAPI', requestId)
 * log.info('Fetching ticket', { ticketId: 123 })
 * log.error('Failed to fetch', { error: err.message })
 */
export function createRequestLogger(module: string, requestId?: string) {
  return {
    debug: (message: string, data?: unknown) => {
      logger.debug(module, message, { requestId, data })
    },
    info: (message: string, data?: unknown) => {
      logger.info(module, message, { requestId, data })
    },
    warning: (message: string, data?: unknown) => {
      logger.warning(module, message, { requestId, data })
    },
    error: (message: string, data?: unknown) => {
      logger.error(module, message, { requestId, data })
    },
  }
}
