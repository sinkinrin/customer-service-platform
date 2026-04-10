/**
 * Customer-Staff Binding Service
 *
 * CRUD operations for the persistent customer→staff assignment relationship.
 * Uses first-write-wins semantics to handle concurrent ticket creation.
 */

import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

/**
 * Find the active binding for a customer.
 * Returns null if the customer has no active binding.
 */
export async function findActiveBinding(customerZammadId: number) {
  return prisma.customerStaffBinding.findFirst({
    where: { customerZammadId, isActive: true },
  })
}

/**
 * Create a binding using first-write-wins semantics.
 *
 * - If no row exists: creates a new binding.
 * - If an active row exists (P2002): returns the existing binding (first writer wins).
 * - If a deactivated row exists (P2002): re-activates it with the new staff.
 *
 * This prevents race conditions where two concurrent first-tickets overwrite each other.
 */
export async function findOrCreateBinding(
  customerZammadId: number,
  staffZammadId: number,
  region: string,
  source: 'auto' | 'manual'
) {
  try {
    return await prisma.customerStaffBinding.create({
      data: {
        customerZammadId,
        staffZammadId,
        region,
        source,
        isActive: true,
      },
    })
  } catch (error: any) {
    // P2002 = Unique constraint violation on customerZammadId
    if (error?.code === 'P2002') {
      const existing = await prisma.customerStaffBinding.findUnique({
        where: { customerZammadId },
      })
      if (!existing) throw error // Should not happen, but be safe

      if (existing.isActive) {
        // Active binding already exists — first writer wins, return as-is
        return existing
      }

      // Deactivated binding exists — re-activate with new staff
      return prisma.customerStaffBinding.update({
        where: { id: existing.id },
        data: {
          staffZammadId,
          region,
          source,
          isActive: true,
          deactivatedAt: null,
        },
      })
    }
    throw error
  }
}

/**
 * Admin: explicitly set or update a binding (manual source).
 * Uses upsert because admin intends to override any existing binding.
 */
export async function setBinding(
  customerZammadId: number,
  staffZammadId: number,
  region: string
) {
  return prisma.customerStaffBinding.upsert({
    where: { customerZammadId },
    create: {
      customerZammadId,
      staffZammadId,
      region,
      source: 'manual',
      isActive: true,
    },
    update: {
      staffZammadId,
      region,
      source: 'manual',
      isActive: true,
      deactivatedAt: null,
    },
  })
}

/**
 * Deactivate a single binding by ID.
 */
export async function deactivateBinding(id: number) {
  return prisma.customerStaffBinding.update({
    where: { id },
    data: { isActive: false, deactivatedAt: new Date() },
  })
}

/**
 * Deactivate all bindings for a staff member (e.g., staff leaves / disabled).
 */
export async function deactivateBindingsByStaff(staffZammadId: number): Promise<number> {
  const result = await prisma.customerStaffBinding.updateMany({
    where: { staffZammadId, isActive: true },
    data: { isActive: false, deactivatedAt: new Date() },
  })
  return result.count
}

/**
 * Deactivate a binding by customer Zammad ID (e.g., stale binding detected).
 */
export async function deactivateBindingByCustomer(customerZammadId: number): Promise<number> {
  const result = await prisma.customerStaffBinding.updateMany({
    where: { customerZammadId, isActive: true },
    data: { isActive: false, deactivatedAt: new Date() },
  })
  return result.count
}

/**
 * Batch-transfer all active bindings from one staff to another.
 */
export async function transferBindings(
  fromStaffZammadId: number,
  toStaffZammadId: number
): Promise<number> {
  const result = await prisma.customerStaffBinding.updateMany({
    where: { staffZammadId: fromStaffZammadId, isActive: true },
    data: { staffZammadId: toStaffZammadId, source: 'manual' },
  })
  return result.count
}

/**
 * List all active bindings, optionally filtered.
 */
export async function listBindings(filters?: {
  staffZammadId?: number
  customerZammadId?: number
  region?: string
  page?: number
  pageSize?: number
}) {
  const where: Prisma.CustomerStaffBindingWhereInput = { isActive: true }
  if (filters?.staffZammadId) where.staffZammadId = filters.staffZammadId
  if (filters?.customerZammadId) where.customerZammadId = filters.customerZammadId
  if (filters?.region) where.region = filters.region

  const page = filters?.page ?? 1
  const pageSize = filters?.pageSize ?? 50

  const [bindings, total] = await Promise.all([
    prisma.customerStaffBinding.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.customerStaffBinding.count({ where }),
  ])

  return { bindings, total, page, pageSize }
}
