/**
 * Zammad User Verification Cache
 * 
 * Caches verified Zammad users to avoid redundant API calls.
 * 
 * SECURITY CONSIDERATIONS:
 * 1. This cache only tracks that a user EXISTS in Zammad, not their permissions
 * 2. The cache key includes email + role to prevent role escalation attacks
 * 3. Cache entries expire after 10 minutes to handle user deletions/changes
 * 4. Cache is server-side only (in-memory), not exposed to clients
 * 5. If a user's role changes, they get a new cache key
 * 
 * ATTACK VECTORS MITIGATED:
 * - Role escalation: Cache key includes role, so customer→staff upgrade requires re-verification
 * - Stale permissions: 10-minute TTL ensures deleted users are re-checked
 * - Cache poisoning: Only server can write to cache, no client input
 */

interface CacheEntry {
  zammadUserId: number
  verifiedAt: number
  expiresAt: number
}

// In-memory cache - survives hot reloads in dev, resets on server restart
const verifiedUsersCache = new Map<string, CacheEntry>()

// Cache TTL: 10 minutes (balance between performance and security)
const CACHE_TTL_MS = 10 * 60 * 1000

// Maximum cache size to prevent memory exhaustion
const MAX_CACHE_SIZE = 1000

/**
 * Generate a secure cache key that includes identity-critical fields
 * Key format: email:role:region (all lowercase, trimmed)
 */
function generateCacheKey(email: string, role: string, region?: string): string {
  const normalizedEmail = email.toLowerCase().trim()
  const normalizedRole = role.toLowerCase().trim()
  const normalizedRegion = (region || 'none').toLowerCase().trim()
  return `${normalizedEmail}:${normalizedRole}:${normalizedRegion}`
}

/**
 * Check if a user has been verified in Zammad recently
 * Returns the Zammad user ID if cached and valid, null otherwise
 */
export function getVerifiedZammadUser(
  email: string,
  role: string,
  region?: string
): number | null {
  const key = generateCacheKey(email, role, region)
  const entry = verifiedUsersCache.get(key)
  
  if (!entry) {
    return null
  }
  
  // Check if entry has expired
  if (Date.now() > entry.expiresAt) {
    verifiedUsersCache.delete(key)
    return null
  }
  
  return entry.zammadUserId
}

/**
 * Mark a user as verified in Zammad
 * Only call this AFTER successfully verifying/creating the user in Zammad
 */
export function setVerifiedZammadUser(
  email: string,
  role: string,
  zammadUserId: number,
  region?: string
): void {
  // Prevent cache from growing unbounded
  if (verifiedUsersCache.size >= MAX_CACHE_SIZE) {
    // Evict oldest entries (simple LRU-like behavior)
    const now = Date.now()
    for (const [key, entry] of verifiedUsersCache) {
      if (entry.expiresAt < now) {
        verifiedUsersCache.delete(key)
      }
    }
    
    // If still too large, remove oldest 10%
    if (verifiedUsersCache.size >= MAX_CACHE_SIZE) {
      const entries = Array.from(verifiedUsersCache.entries())
        .sort((a, b) => a[1].verifiedAt - b[1].verifiedAt)
      
      const toRemove = Math.ceil(entries.length * 0.1)
      for (let i = 0; i < toRemove; i++) {
        verifiedUsersCache.delete(entries[i][0])
      }
    }
  }
  
  const key = generateCacheKey(email, role, region)
  const now = Date.now()
  
  verifiedUsersCache.set(key, {
    zammadUserId,
    verifiedAt: now,
    expiresAt: now + CACHE_TTL_MS,
  })
}

/**
 * Invalidate a user's cache entry (e.g., on role change or logout)
 */
export function invalidateZammadUserCache(
  email: string,
  role?: string,
  region?: string
): void {
  if (role) {
    // Invalidate specific role entry
    const key = generateCacheKey(email, role, region)
    verifiedUsersCache.delete(key)
  } else {
    // Invalidate all entries for this email (any role)
    const emailPrefix = email.toLowerCase().trim() + ':'
    for (const key of verifiedUsersCache.keys()) {
      if (key.startsWith(emailPrefix)) {
        verifiedUsersCache.delete(key)
      }
    }
  }
}

/**
 * Clear entire cache (for testing or emergency)
 */
export function clearZammadUserCache(): void {
  verifiedUsersCache.clear()
}

/**
 * Get cache statistics (for monitoring)
 */
export function getZammadUserCacheStats(): {
  size: number
  maxSize: number
  ttlMs: number
} {
  return {
    size: verifiedUsersCache.size,
    maxSize: MAX_CACHE_SIZE,
    ttlMs: CACHE_TTL_MS,
  }
}
