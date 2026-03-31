/**
 * In-memory Rate Limiter
 *
 * Simple sliding-window rate limiter for API routes.
 * For horizontal scaling, replace with Redis-based implementation.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimiterOptions {
  /** Maximum requests allowed within the window */
  maxRequests: number
  /** Window duration in milliseconds */
  windowMs: number
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>()
  private readonly maxRequests: number
  private readonly windowMs: number
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor(options: RateLimiterOptions) {
    this.maxRequests = options.maxRequests
    this.windowMs = options.windowMs

    // Periodic cleanup every 60s to prevent memory leak
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000)
    // Allow Node to exit even if interval is running
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref()
    }
  }

  /**
   * Check if a request is allowed.
   * @returns { allowed, remaining, resetAt }
   */
  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now()
    const entry = this.store.get(key)

    if (!entry || now >= entry.resetAt) {
      // New window
      this.store.set(key, { count: 1, resetAt: now + this.windowMs })
      return { allowed: true, remaining: this.maxRequests - 1, resetAt: now + this.windowMs }
    }

    entry.count++
    if (entry.count > this.maxRequests) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt }
    }

    return { allowed: true, remaining: this.maxRequests - entry.count, resetAt: entry.resetAt }
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (now >= entry.resetAt) {
        this.store.delete(key)
      }
    }
  }
}

// Shared rate limiter instances for different endpoints
// Login: 10 attempts per 15 minutes per IP
export const loginLimiter = new RateLimiter({ maxRequests: 10, windowMs: 15 * 60 * 1000 })

// AI chat: 30 requests per minute per user
export const aiChatLimiter = new RateLimiter({ maxRequests: 30, windowMs: 60 * 1000 })

// General API: 120 requests per minute per IP
export const apiLimiter = new RateLimiter({ maxRequests: 120, windowMs: 60 * 1000 })

// Webhook: 60 requests per minute per IP
export const webhookLimiter = new RateLimiter({ maxRequests: 60, windowMs: 60 * 1000 })
