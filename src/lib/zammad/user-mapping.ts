/**
 * Zammad User Mapping Storage
 * 
 * TODO: Replace with database storage (e.g., PostgreSQL table, Redis)
 * This is a temporary in-memory storage for mapping Supabase user IDs to Zammad user IDs
 * 
 * Previously stored in `user_zammad_mapping` table in Supabase
 */

interface UserZammadMapping {
  userId: string
  zammadUserId: number
  zammadUserEmail: string
  createdAt: string
  updatedAt: string
}

// In-memory storage (will be lost on server restart)
const userZammadMapping = new Map<string, UserZammadMapping>()

/**
 * Set Zammad user ID for a user
 */
export function setUserZammadMapping(
  userId: string,
  zammadUserId: number,
  zammadUserEmail: string
): void {
  const now = new Date().toISOString()
  
  userZammadMapping.set(userId, {
    userId,
    zammadUserId,
    zammadUserEmail,
    createdAt: userZammadMapping.get(userId)?.createdAt || now,
    updatedAt: now,
  })
}

/**
 * Get Zammad user ID for a user
 */
export function getUserZammadId(userId: string): number | undefined {
  return userZammadMapping.get(userId)?.zammadUserId
}

/**
 * Get Zammad user email for a user
 */
export function getUserZammadEmail(userId: string): string | undefined {
  return userZammadMapping.get(userId)?.zammadUserEmail
}

/**
 * Get full mapping for a user
 */
export function getUserZammadMapping(userId: string): UserZammadMapping | undefined {
  return userZammadMapping.get(userId)
}

/**
 * Check if user has Zammad mapping
 */
export function hasUserZammadMapping(userId: string): boolean {
  return userZammadMapping.has(userId)
}

/**
 * Delete Zammad mapping for a user
 */
export function deleteUserZammadMapping(userId: string): boolean {
  return userZammadMapping.delete(userId)
}

/**
 * Get all mappings (for debugging/admin purposes)
 */
export function getAllUserZammadMappings(): UserZammadMapping[] {
  return Array.from(userZammadMapping.values())
}

/**
 * Clear all mappings (for testing purposes)
 */
export function clearAllUserZammadMappings(): void {
  userZammadMapping.clear()
}

/**
 * Initialize with default mappings for test users
 */
export function initializeDefaultMappings(): void {
  // TODO: Remove this when using real database
  // These are example mappings for test users
  setUserZammadMapping('mock-customer-id', 1, 'customer@test.com')
  setUserZammadMapping('mock-staff-id', 2, 'staff@test.com')
  setUserZammadMapping('mock-admin-id', 3, 'admin@test.com')
}

// Initialize default mappings on module load
initializeDefaultMappings()

