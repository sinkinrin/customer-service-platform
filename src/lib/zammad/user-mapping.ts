/**
 * Zammad User Mapping Storage
 *
 * Database-backed storage for mapping local user IDs to Zammad user IDs
 * Uses Prisma to persist mappings in the database
 */

import { prisma } from '@/lib/prisma'

interface UserZammadMapping {
  userId: string
  zammadUserId: number
  zammadUserEmail: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Set Zammad user ID for a user
 * Creates or updates the mapping in the database
 */
export async function setUserZammadMapping(
  userId: string,
  zammadUserId: number,
  zammadUserEmail: string
): Promise<void> {
  await prisma.userZammadMapping.upsert({
    where: { userId },
    create: {
      userId,
      zammadUserId,
      zammadUserEmail,
    },
    update: {
      zammadUserId,
      zammadUserEmail,
      updatedAt: new Date(),
    },
  })
}

/**
 * Get Zammad user ID for a user
 */
export async function getUserZammadId(userId: string): Promise<number | undefined> {
  const mapping = await prisma.userZammadMapping.findUnique({
    where: { userId },
    select: { zammadUserId: true },
  })
  return mapping?.zammadUserId
}

/**
 * Get Zammad user email for a user
 */
export async function getUserZammadEmail(userId: string): Promise<string | undefined> {
  const mapping = await prisma.userZammadMapping.findUnique({
    where: { userId },
    select: { zammadUserEmail: true },
  })
  return mapping?.zammadUserEmail
}

/**
 * Get full mapping for a user
 */
export async function getUserZammadMapping(userId: string): Promise<UserZammadMapping | null> {
  const mapping = await prisma.userZammadMapping.findUnique({
    where: { userId },
  })

  if (!mapping) return null

  return {
    userId: mapping.userId,
    zammadUserId: mapping.zammadUserId,
    zammadUserEmail: mapping.zammadUserEmail,
    createdAt: mapping.createdAt,
    updatedAt: mapping.updatedAt,
  }
}

/**
 * Check if user has Zammad mapping
 */
export async function hasUserZammadMapping(userId: string): Promise<boolean> {
  const count = await prisma.userZammadMapping.count({
    where: { userId },
  })
  return count > 0
}

/**
 * Delete Zammad mapping for a user
 */
export async function deleteUserZammadMapping(userId: string): Promise<boolean> {
  try {
    await prisma.userZammadMapping.delete({
      where: { userId },
    })
    return true
  } catch {
    return false
  }
}

/**
 * Get all mappings (for debugging/admin purposes)
 */
export async function getAllUserZammadMappings(): Promise<UserZammadMapping[]> {
  const mappings = await prisma.userZammadMapping.findMany()

  return mappings.map((mapping: { userId: string; zammadUserId: number; zammadUserEmail: string; createdAt: Date; updatedAt: Date }) => ({
    userId: mapping.userId,
    zammadUserId: mapping.zammadUserId,
    zammadUserEmail: mapping.zammadUserEmail,
    createdAt: mapping.createdAt,
    updatedAt: mapping.updatedAt,
  }))
}

/**
 * Clear all mappings (for testing purposes)
 */
export async function clearAllUserZammadMappings(): Promise<void> {
  await prisma.userZammadMapping.deleteMany()
}

/**
 * Initialize with default mappings for test users
 */
export async function initializeDefaultMappings(): Promise<void> {
  // Create default mappings for test users if they don't exist
  const testMappings = [
    { userId: 'mock-customer-id', zammadUserId: 1, zammadUserEmail: 'customer@test.com' },
    { userId: 'mock-staff-id', zammadUserId: 2, zammadUserEmail: 'staff@test.com' },
    { userId: 'mock-admin-id', zammadUserId: 3, zammadUserEmail: 'admin@test.com' },
  ]

  for (const mapping of testMappings) {
    await setUserZammadMapping(mapping.userId, mapping.zammadUserId, mapping.zammadUserEmail)
  }
}
