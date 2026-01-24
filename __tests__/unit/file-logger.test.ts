/**
 * FileLogger 集成测试
 *
 * 使用真实文件系统测试核心功能：
 * - 实际写入文件
 * - 日期轮转
 * - 大小轮转
 * - 过期日志清理
 * - 错误处理
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { FileLogger } from '@/lib/utils/file-logger'

describe('FileLogger 集成测试', () => {
  let tempDir: string
  let fileLogger: FileLogger

  beforeEach(async () => {
    // 创建唯一的临时目录
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'filelogger-test-'))
  })

  afterEach(async () => {
    // 关闭 logger
    if (fileLogger) {
      await fileLogger.close()
    }
    // 清理临时目录
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // 忽略清理错误
    }
  })

  describe('文件写入', () => {
    it('应该创建日志目录和文件', async () => {
      const logDir = path.join(tempDir, 'logs')
      fileLogger = new FileLogger({
        enabled: true,
        logDir,
        filePrefix: 'test',
      })

      await fileLogger.write('hello world')
      await fileLogger.close() // 确保写入完成

      // 验证目录被创建
      const dirStat = await fs.stat(logDir)
      expect(dirStat.isDirectory()).toBe(true)

      // 验证日志文件存在
      const files = await fs.readdir(logDir)
      expect(files.length).toBe(1)
      expect(files[0]).toMatch(/^test-\d{4}-\d{2}-\d{2}\.log$/)
    })

    it('应该将内容写入日志文件', async () => {
      fileLogger = new FileLogger({
        enabled: true,
        logDir: tempDir,
        filePrefix: 'app',
      })

      await fileLogger.write('first line')
      await fileLogger.write('second line')
      await fileLogger.close()

      const files = await fs.readdir(tempDir)
      const logFile = files.find(f => f.startsWith('app-'))
      expect(logFile).toBeDefined()

      const content = await fs.readFile(path.join(tempDir, logFile!), 'utf-8')
      expect(content).toContain('first line')
      expect(content).toContain('second line')
    })

    it('应该每行以换行符结尾', async () => {
      fileLogger = new FileLogger({
        enabled: true,
        logDir: tempDir,
        filePrefix: 'app',
      })

      await fileLogger.write('line1')
      await fileLogger.write('line2')
      await fileLogger.close()

      const files = await fs.readdir(tempDir)
      const logFile = files.find(f => f.startsWith('app-'))
      const content = await fs.readFile(path.join(tempDir, logFile!), 'utf-8')

      const lines = content.split('\n').filter(l => l.length > 0)
      expect(lines).toEqual(['line1', 'line2'])
    })

    it('writeJson 应该写入 JSON 字符串', async () => {
      fileLogger = new FileLogger({
        enabled: true,
        logDir: tempDir,
        filePrefix: 'json',
      })

      await fileLogger.writeJson({ level: 'INFO', message: 'test' })
      await fileLogger.close()

      const files = await fs.readdir(tempDir)
      const logFile = files.find(f => f.startsWith('json-'))
      const content = await fs.readFile(path.join(tempDir, logFile!), 'utf-8')

      const parsed = JSON.parse(content.trim())
      expect(parsed).toEqual({ level: 'INFO', message: 'test' })
    })
  })

  describe('大小轮转', () => {
    it('超过 maxFileSize 时应该轮转文件', async () => {
      fileLogger = new FileLogger({
        enabled: true,
        logDir: tempDir,
        filePrefix: 'rotate',
        maxFileSize: 100, // 100 bytes，很小以便测试
      })

      // 写入超过 100 bytes 的内容
      const longLine = 'A'.repeat(60)
      await fileLogger.write(longLine)
      await fileLogger.write(longLine) // 触发轮转检查

      // 等待节流间隔过去（5秒）
      await new Promise(resolve => setTimeout(resolve, 5500))

      // 再写一行触发轮转
      await fileLogger.write(longLine)
      await fileLogger.close()

      const files = await fs.readdir(tempDir)
      const logFiles = files.filter(f => f.startsWith('rotate-'))

      // 应该有至少 2 个文件（原始 + 轮转后的）
      expect(logFiles.length).toBeGreaterThanOrEqual(2)
    }, 10000)
  })

  describe('日志清理', () => {
    it('应该删除超过保留期的日志文件', async () => {
      // 手动创建一个"旧"日志文件
      const oldLogFile = path.join(tempDir, 'cleanup-2020-01-01.log')
      await fs.writeFile(oldLogFile, 'old content')

      // 修改文件的 mtime 为 40 天前
      const oldTime = new Date()
      oldTime.setDate(oldTime.getDate() - 40)
      await fs.utimes(oldLogFile, oldTime, oldTime)

      // 创建 logger 并写入（会触发清理）
      fileLogger = new FileLogger({
        enabled: true,
        logDir: tempDir,
        filePrefix: 'cleanup',
        retentionDays: 30,
      })

      await fileLogger.write('new content')
      await fileLogger.close()

      // 旧文件应该被删除
      const files = await fs.readdir(tempDir)
      const oldFileExists = files.includes('cleanup-2020-01-01.log')
      expect(oldFileExists).toBe(false)

      // 新文件应该存在
      const newFiles = files.filter(f => f.startsWith('cleanup-') && f !== 'cleanup-2020-01-01.log')
      expect(newFiles.length).toBe(1)
    })

    it('不应该删除保留期内的日志文件', async () => {
      // 创建一个"最近"的日志文件
      const recentLogFile = path.join(tempDir, 'keep-2026-01-20.log')
      await fs.writeFile(recentLogFile, 'recent content')

      // 修改文件的 mtime 为 5 天前
      const recentTime = new Date()
      recentTime.setDate(recentTime.getDate() - 5)
      await fs.utimes(recentLogFile, recentTime, recentTime)

      fileLogger = new FileLogger({
        enabled: true,
        logDir: tempDir,
        filePrefix: 'keep',
        retentionDays: 30,
      })

      await fileLogger.write('new content')
      await fileLogger.close()

      // 最近的文件应该保留
      const files = await fs.readdir(tempDir)
      expect(files).toContain('keep-2026-01-20.log')
    })

    it('只应该处理匹配前缀的日志文件', async () => {
      // 创建不同前缀的旧日志文件
      const matchingFile = path.join(tempDir, 'prefix-2020-01-01.log')
      const otherFile = path.join(tempDir, 'other-2020-01-01.log')
      const wrongExt = path.join(tempDir, 'prefix-2020-01-01.txt')

      await fs.writeFile(matchingFile, 'matching')
      await fs.writeFile(otherFile, 'other')
      await fs.writeFile(wrongExt, 'wrong ext')

      // 设置为旧文件
      const oldTime = new Date()
      oldTime.setDate(oldTime.getDate() - 40)
      await fs.utimes(matchingFile, oldTime, oldTime)
      await fs.utimes(otherFile, oldTime, oldTime)
      await fs.utimes(wrongExt, oldTime, oldTime)

      fileLogger = new FileLogger({
        enabled: true,
        logDir: tempDir,
        filePrefix: 'prefix',
        retentionDays: 30,
      })

      await fileLogger.write('test')
      await fileLogger.close()

      const files = await fs.readdir(tempDir)

      // 匹配前缀的旧文件应该被删除
      expect(files).not.toContain('prefix-2020-01-01.log')

      // 其他文件应该保留
      expect(files).toContain('other-2020-01-01.log')
      expect(files).toContain('prefix-2020-01-01.txt')
    })
  })

  describe('禁用状态', () => {
    it('禁用时不应该创建目录或文件', async () => {
      const logDir = path.join(tempDir, 'should-not-exist')

      fileLogger = new FileLogger({
        enabled: false,
        logDir,
      })

      await fileLogger.write('should not write')
      await fileLogger.close()

      // 目录不应该被创建
      await expect(fs.stat(logDir)).rejects.toThrow()
    })
  })

  describe('错误处理', () => {
    it('无法创建目录时应该禁用日志而不崩溃', async () => {
      // 创建一个文件来阻止创建同名目录
      const blockingFile = path.join(tempDir, 'blocked')
      await fs.writeFile(blockingFile, 'blocker')

      fileLogger = new FileLogger({
        enabled: true,
        logDir: path.join(blockingFile, 'logs'), // 无法在文件下创建目录
      })

      // 不应该抛出异常
      await expect(fileLogger.write('test')).resolves.toBeUndefined()

      // 应该被禁用
      expect(fileLogger.isEnabled()).toBe(false)
    })
  })

  describe('配置', () => {
    it('应该使用默认配置', () => {
      fileLogger = new FileLogger()
      const config = fileLogger.getConfig()

      expect(config.logDir).toBe('./logs')
      expect(config.filePrefix).toBe('app')
      expect(config.maxFileSize).toBe(10485760)
      expect(config.retentionDays).toBe(30)
      expect(config.enabled).toBe(false)
    })

    it('getConfig 应该返回副本', () => {
      fileLogger = new FileLogger({ logDir: tempDir })
      const config1 = fileLogger.getConfig()
      const config2 = fileLogger.getConfig()

      expect(config1).not.toBe(config2)
      expect(config1).toEqual(config2)

      // 修改副本不应影响原配置
      config1.logDir = '/modified'
      expect(fileLogger.getConfig().logDir).toBe(tempDir)
    })
  })

  describe('close', () => {
    it('多次调用 close 应该安全', async () => {
      fileLogger = new FileLogger({
        enabled: true,
        logDir: tempDir,
      })

      await fileLogger.write('test')
      await fileLogger.close()
      await fileLogger.close()
      await fileLogger.close()
      // 不应抛出异常
    })
  })
})
