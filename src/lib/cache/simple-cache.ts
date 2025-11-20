/**
 * Simple In-Memory LRU Cache
 *
 * Lightweight cache for low-concurrency scenarios (< 100 users)
 * No Redis required
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
  lastAccessed: number
}

export class SimpleCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>()
  private maxSize: number
  private defaultTTL: number // in seconds

  constructor(maxSize = 100, defaultTTL = 300) {
    this.maxSize = maxSize
    this.defaultTTL = defaultTTL
  }

  /**
   * Set a value in cache
   */
  set(key: string, value: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL) * 1000

    // Remove oldest entry if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest()
    }

    this.cache.set(key, {
      value,
      expiresAt,
      lastAccessed: Date.now(),
    })
  }

  /**
   * Get a value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    // Update last accessed time (LRU)
    entry.lastAccessed = Date.now()
    return entry.value
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null
  }

  /**
   * Delete a key
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys()),
    }
  }

  /**
   * Evict the least recently used entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }
}

// Singleton instances for different data types
export const faqCache = new SimpleCache<any>(50, 600) // 10 minutes
export const categoriesCache = new SimpleCache<any>(10, 1800) // 30 minutes
export const ticketCache = new SimpleCache<any>(100, 300) // 5 minutes
export const conversationCache = new SimpleCache<any>(100, 300) // 5 minutes

// FIX: Auto cleanup every 5 minutes with proper serverless handling
// Use globalThis guard to prevent multiple timers on hot reload
// Use unref() to allow process to exit when this is the only active timer
if (typeof window === 'undefined') {
  // @ts-expect-error - globalThis augmentation for cleanup tracking
  if (!globalThis.__cacheCleanupStarted) {
    // @ts-expect-error - globalThis augmentation for cleanup tracking
    globalThis.__cacheCleanupStarted = true

    const timer = setInterval(() => {
      faqCache.cleanup()
      categoriesCache.cleanup()
      ticketCache.cleanup()
      conversationCache.cleanup()
    }, 5 * 60 * 1000)

    // Use unref() to allow the process to exit if this is the only active timer
    // This prevents the timer from keeping serverless workers alive
    if (timer.unref) {
      timer.unref()
    }
  }
}
