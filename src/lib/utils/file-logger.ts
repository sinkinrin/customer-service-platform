/**
 * File Logger Utility
 *
 * Provides file-based logging with:
 * - Daily log file rotation
 * - Size-based rotation (optional)
 * - Configurable retention period
 * - Async non-blocking writes
 *
 * NOTE: This module intentionally uses raw console.error/console.warn/console.info for its own
 * error reporting to avoid circular dependencies with the main logger module.
 * console.error/console.warn/console.info calls will persist even if Next.js removeConsole is enabled.
 *
 * @example
 * // In logger.ts
 * import { fileLogger } from './file-logger'
 * fileLogger.write(logEntry)
 */

import fs from 'fs/promises'
import { createWriteStream, WriteStream } from 'fs'
import path from 'path'

/**
 * Configuration for file logging
 */
export interface FileLoggerConfig {
  /** Directory to store log files */
  logDir: string
  /** Log file prefix (default: 'app') */
  filePrefix: string
  /** Maximum file size in bytes before rotation (default: 10MB) */
  maxFileSize: number
  /** Number of days to retain logs (default: 30) */
  retentionDays: number
  /** Whether file logging is enabled */
  enabled: boolean
}

function parseEnvInt(
  value: string | undefined,
  fallback: number,
  options?: { min?: number }
): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed)) return fallback
  if (options?.min !== undefined && parsed < options.min) return fallback
  return parsed
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: FileLoggerConfig = {
  logDir: process.env.LOG_DIR || './logs',
  filePrefix: process.env.LOG_FILE_PREFIX || 'app',
  maxFileSize: parseEnvInt(process.env.LOG_MAX_FILE_SIZE, 10485760, { min: 1 }), // 10MB
  retentionDays: parseEnvInt(process.env.LOG_RETENTION_DAYS, 30, { min: 0 }),
  enabled: process.env.LOG_TO_FILE === 'true',
}

class FileLogger {
  private config: FileLoggerConfig
  private currentLogFile: string = ''
  private writeStream: WriteStream | null = null
  private initialized = false
  private initPromise: Promise<void> | null = null
  private lastRotationCheck: number = 0
  private readonly ROTATION_CHECK_INTERVAL = 5000 // Check rotation every 5 seconds max
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(config: Partial<FileLoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Initialize the file logger
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return
    if (this.initPromise) return this.initPromise

    this.initPromise = this._doInitialize()
    await this.initPromise
  }

  private async _doInitialize(): Promise<void> {
    if (!this.config.enabled) {
      this.initialized = true
      return
    }

    try {
      // Create logs directory if it doesn't exist
      const absoluteLogDir = path.resolve(this.config.logDir)
      await fs.mkdir(absoluteLogDir, { recursive: true })

      // Clean up old log files
      await this.cleanupOldLogs()

      this.initialized = true
    } catch (error) {
      // Using raw console to avoid circular dependency with logger
      console.error('[FileLogger] Failed to initialize:', error)
      this.config.enabled = false
      this.initialized = true
    }
  }

  /**
   * Close the current write stream (if any) and wait for the file descriptor to be released.
   */
  private async closeWriteStream(): Promise<void> {
    const stream = this.writeStream
    if (!stream) return

    this.writeStream = null

    await new Promise<void>((resolve) => {
      stream.once('close', resolve)
      stream.once('error', () => resolve())
      stream.end()
    })
  }

  private getTodayString(): string {
    return new Date().toISOString().split('T')[0] // YYYY-MM-DD
  }

  private async ensureCurrentLogFile(): Promise<void> {
    const today = this.getTodayString()
    const desiredLogFile = path.resolve(
      this.config.logDir,
      `${this.config.filePrefix}-${today}.log`
    )

    if (desiredLogFile !== this.currentLogFile) {
      await this.closeWriteStream()
      this.currentLogFile = desiredLogFile
    }
  }

  /**
   * Get or create write stream
   */
  private getWriteStream(): WriteStream {
    const logFile = this.currentLogFile

    if (!this.writeStream) {
      this.writeStream = createWriteStream(logFile, { flags: 'a' })
      this.writeStream.on('error', (err) => {
        // Using raw console to avoid circular dependency with logger
        console.error('[FileLogger] Write stream error:', err)
      })
    }

    return this.writeStream
  }

  /**
   * Check if file needs rotation based on size
   * Uses throttling to avoid checking on every write
   */
  private async checkRotation(): Promise<void> {
    const now = Date.now()
    if (now - this.lastRotationCheck < this.ROTATION_CHECK_INTERVAL) {
      return
    }
    this.lastRotationCheck = now

    const logFile = this.currentLogFile

    try {
      const stats = await fs.stat(logFile).catch(() => null)
      if (stats && stats.size >= this.config.maxFileSize) {
        // Rotate: rename current file with timestamp
        const rotatedFile = logFile.replace(/\.log$/, `-${Date.now()}.log`)

        // Close current stream and wait to avoid Windows file locking issues
        await this.closeWriteStream()
        await fs.rename(logFile, rotatedFile)
      }
    } catch (error) {
      // Using raw console to avoid circular dependency with logger
      console.error('[FileLogger] Rotation check failed:', error)
    }
  }

  /**
   * Clean up log files older than retention period
   */
  private async cleanupOldLogs(): Promise<void> {
    try {
      const absoluteLogDir = path.resolve(this.config.logDir)

      let files: string[]
      try {
        files = await fs.readdir(absoluteLogDir)
      } catch {
        return // Directory doesn't exist yet
      }

      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays)

      for (const file of files) {
        if (!file.startsWith(this.config.filePrefix) || !file.endsWith('.log')) {
          continue
        }

        const filePath = path.join(absoluteLogDir, file)
        const stats = await fs.stat(filePath)

        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath)
          // Using raw console to avoid circular dependency with logger
          console.info(`[FileLogger] Deleted old log file: ${file}`)
        }
      }
    } catch (error) {
      // Using raw console to avoid circular dependency with logger
      console.error('[FileLogger] Cleanup failed:', error)
    }
  }

  /**
   * Write a log entry to file
   */
  async write(entry: string): Promise<void> {
    await this.initialize()

    if (!this.config.enabled) return

    this.writeQueue = this.writeQueue.then(async () => {
      try {
        await this.ensureCurrentLogFile()
        await this.checkRotation()

        const stream = this.getWriteStream()
        await new Promise<void>((resolve, reject) => {
          stream.write(entry + '\n', (err) => {
            if (err) reject(err)
            else resolve()
          })
        })
      } catch (error) {
        // Using raw console to avoid circular dependency with logger
        console.error('[FileLogger] Failed to write:', error)
      }
    })

    return this.writeQueue
  }

  /**
   * Write JSON log entry
   */
  async writeJson(entry: object): Promise<void> {
    await this.write(JSON.stringify(entry))
  }

  /**
   * Flush and close the write stream
   */
  async close(): Promise<void> {
    await this.writeQueue
    await this.closeWriteStream()
  }

  /**
   * Check if file logging is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * Get current configuration
   */
  getConfig(): FileLoggerConfig {
    return { ...this.config }
  }
}

// Export singleton instance
export const fileLogger = new FileLogger()

// Export class for custom instances (useful for testing)
export { FileLogger }
