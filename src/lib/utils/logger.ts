/**
 * Structured Logger Utility
 * 
 * Provides structured logging with different log levels and environment-based filtering
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  module: string
  message: string
  data?: unknown
}

class Logger {
  private isDevelopment: boolean
  private minLevel: LogLevel

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development'
    const envLevelRaw = (process.env.NEXT_PUBLIC_LOG_LEVEL || process.env.LOG_LEVEL || '').toUpperCase()
    const valid = ['DEBUG','INFO','WARNING','ERROR']
    this.minLevel = (valid as string[]).includes(envLevelRaw) ? (envLevelRaw as LogLevel) : (this.isDevelopment ? LogLevel.INFO : LogLevel.WARNING)
  }

  private formatTimestamp(): string {
    const now = new Date()
    return now.toISOString().replace('T', ' ').substring(0, 19)
  }

  private levelWeight(level: LogLevel): number {
    switch (level) {
      case LogLevel.DEBUG: return 10
      case LogLevel.INFO: return 20
      case LogLevel.WARNING: return 30
      case LogLevel.ERROR: return 40
      default: return 50
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelWeight(level) >= this.levelWeight(this.minLevel)
  }

  private formatLog(entry: LogEntry): string {
    const { timestamp, level, module, message } = entry
    return `[${timestamp}] [${level}] [${module}] ${message}`
  }

  private log(level: LogLevel, module: string, message: string, data?: unknown) {
    if (!this.shouldLog(level)) {
      return
    }

    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      module,
      message,
      data,
    }

    const formattedLog = this.formatLog(entry)

    switch (level) {
      case LogLevel.DEBUG:
        console.log(formattedLog, data || '')
        break
      case LogLevel.INFO:
        console.info(formattedLog, data || '')
        break
      case LogLevel.WARNING:
        console.warn(formattedLog, data || '')
        break
      case LogLevel.ERROR:
        console.error(formattedLog, data || '')
        break
    }
  }

  debug(module: string, message: string, data?: unknown) {
    this.log(LogLevel.DEBUG, module, message, data)
  }

  info(module: string, message: string, data?: unknown) {
    this.log(LogLevel.INFO, module, message, data)
  }

  warning(module: string, message: string, data?: unknown) {
    this.log(LogLevel.WARNING, module, message, data)
  }

  error(module: string, message: string, data?: unknown) {
    this.log(LogLevel.ERROR, module, message, data)
  }
}

// Export singleton instance
export const logger = new Logger()

// Export convenience functions
export const logDebug = (module: string, message: string, data?: unknown) => {
  logger.debug(module, message, data)
}

export const logInfo = (module: string, message: string, data?: unknown) => {
  logger.info(module, message, data)
}

export const logWarning = (module: string, message: string, data?: unknown) => {
  logger.warning(module, message, data)
}

export const logError = (module: string, message: string, data?: unknown) => {
  logger.error(module, message, data)
}

