/**
 * Client Logger Utility
 *
 * Client-safe logger implementation for browser components/hooks.
 * Uses NEXT_PUBLIC_LOG_LEVEL for filtering and never attempts file persistence.
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
}

export interface LogOptions {
  data?: unknown
}

function normalizeLevel(level: string | undefined): LogLevel {
  const normalized = (level || 'info').toLowerCase()
  switch (normalized) {
    case 'debug':
      return LogLevel.DEBUG
    case 'warn':
    case 'warning':
      return LogLevel.WARNING
    case 'error':
      return LogLevel.ERROR
    case 'info':
    default:
      return LogLevel.INFO
  }
}

function levelWeight(level: LogLevel): number {
  switch (level) {
    case LogLevel.DEBUG:
      return 0
    case LogLevel.INFO:
      return 1
    case LogLevel.WARNING:
      return 2
    case LogLevel.ERROR:
      return 3
  }
}

class ClientLogger {
  private readonly minLevel: LogLevel

  constructor() {
    const raw = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_LOG_LEVEL : undefined
    this.minLevel = normalizeLevel(raw)
  }

  private shouldLog(level: LogLevel): boolean {
    return levelWeight(level) >= levelWeight(this.minLevel)
  }

  private format(entry: { level: LogLevel; module: string; message: string }): string {
    const ts = new Date().toISOString()
    return `[${ts}] [${entry.level}] [${entry.module}] ${entry.message}`
  }

  private log(level: LogLevel, module: string, message: string, options?: LogOptions) {
    if (!this.shouldLog(level)) return

    const output = this.format({ level, module, message })
    const data = options?.data

    switch (level) {
      case LogLevel.DEBUG:
        data !== undefined ? console.log(output, data) : console.log(output)
        break
      case LogLevel.INFO:
        data !== undefined ? console.info(output, data) : console.info(output)
        break
      case LogLevel.WARNING:
        data !== undefined ? console.warn(output, data) : console.warn(output)
        break
      case LogLevel.ERROR:
        data !== undefined ? console.error(output, data) : console.error(output)
        break
    }
  }

  debug(module: string, message: string, options?: LogOptions) {
    this.log(LogLevel.DEBUG, module, message, options)
  }

  info(module: string, message: string, options?: LogOptions) {
    this.log(LogLevel.INFO, module, message, options)
  }

  warning(module: string, message: string, options?: LogOptions) {
    this.log(LogLevel.WARNING, module, message, options)
  }

  warn(module: string, message: string, options?: LogOptions) {
    this.log(LogLevel.WARNING, module, message, options)
  }

  error(module: string, message: string, options?: LogOptions) {
    this.log(LogLevel.ERROR, module, message, options)
  }
}

export const logger = new ClientLogger()

export const logDebug = (module: string, message: string, data?: unknown) => {
  logger.debug(module, message, { data })
}

export const logInfo = (module: string, message: string, data?: unknown) => {
  logger.info(module, message, { data })
}

export const logWarning = (module: string, message: string, data?: unknown) => {
  logger.warning(module, message, { data })
}

export const logError = (module: string, message: string, data?: unknown) => {
  logger.error(module, message, { data })
}

