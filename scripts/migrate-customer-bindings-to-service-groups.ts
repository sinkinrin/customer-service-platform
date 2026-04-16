import { prisma } from '@/lib/prisma'
import { mapRegionValueToServiceBaseRegion } from '@/lib/service-groups/service-group-service'
import { isValidRegion, type RegionValue } from '@/lib/constants/regions'
import { ServiceBaseRegion } from '@prisma/client'

type SeededServiceGroup = {
  id: number
  name: string
  staffZammadId: number
  baseRegion: ServiceBaseRegion
}

type LegacyBindingRecord = {
  customerZammadId: number
  staffZammadId: number
  region: string
  isActive: boolean
}

type MigrationInputRecord = {
  customerZammadId: number
  binding?: LegacyBindingRecord | null
  noteRegion?: string | null
}

type GroupResolutionResult =
  | { status: 'mapped'; serviceGroupId: number }
  | { status: 'unassigned'; reason: string }
  | { status: 'skipped'; reason: string }

type MigrationRecordResult =
  | { status: 'mapped'; customerZammadId: number; serviceGroupId: number }
  | { status: 'unassigned'; customerZammadId: number; reason: string }
  | { status: 'skipped'; customerZammadId: number; reason: string }

function normalizeBindingRegion(region: string): RegionValue | undefined {
  return isValidRegion(region) ? region : undefined
}

export function resolveServiceGroupForBinding(
  binding: LegacyBindingRecord | null | undefined,
  serviceGroups: SeededServiceGroup[]
): GroupResolutionResult {
  if (!binding || !binding.isActive) {
    return { status: 'unassigned', reason: 'no active binding' }
  }

  const staffMatches = serviceGroups.filter((group) => group.staffZammadId === binding.staffZammadId)

  if (staffMatches.length === 0) {
    return { status: 'unassigned', reason: 'no seeded service group for binding staff' }
  }

  if (staffMatches.length === 1) {
    return { status: 'mapped', serviceGroupId: staffMatches[0].id }
  }

  const bindingRegion = normalizeBindingRegion(binding.region)
  if (!bindingRegion) {
    return { status: 'skipped', reason: 'ambiguous service group match without valid binding region' }
  }

  const targetBaseRegion = mapRegionValueToServiceBaseRegion(bindingRegion)
  const narrowed = staffMatches.filter((group) => group.baseRegion === targetBaseRegion)

  if (narrowed.length === 1) {
    return { status: 'mapped', serviceGroupId: narrowed[0].id }
  }

  if (narrowed.length === 0) {
    return { status: 'skipped', reason: 'ambiguous staff mapping and binding region does not narrow to a seeded group' }
  }

  return { status: 'skipped', reason: 'ambiguous service group mapping for binding staff' }
}

export async function migrateCustomerBindingRecord(
  record: MigrationInputRecord,
  serviceGroups: SeededServiceGroup[]
): Promise<MigrationRecordResult> {
  const resolution = resolveServiceGroupForBinding(record.binding ?? null, serviceGroups)

  if (resolution.status === 'mapped') {
    return {
      status: 'mapped',
      customerZammadId: record.customerZammadId,
      serviceGroupId: resolution.serviceGroupId,
    }
  }

  if (!record.binding && record.noteRegion) {
    return {
      status: 'unassigned',
      customerZammadId: record.customerZammadId,
      reason: 'note region alone does not create assignment',
    }
  }

  return {
    status: resolution.status,
    customerZammadId: record.customerZammadId,
    reason: resolution.reason,
  }
}

export async function migrateCustomerBindingsToServiceGroups(options?: { dryRun?: boolean }) {
  const dryRun = options?.dryRun ?? true
  const serviceGroups = await prisma.serviceGroup.findMany({
    where: { isActive: true },
    select: { id: true, name: true, staffZammadId: true, baseRegion: true },
  })

  const bindings = await prisma.customerStaffBinding.findMany({
    where: { isActive: true },
    select: {
      customerZammadId: true,
      staffZammadId: true,
      region: true,
      isActive: true,
    },
  })

  const results: MigrationRecordResult[] = []

  for (const binding of bindings) {
    const result = await migrateCustomerBindingRecord(
      {
        customerZammadId: binding.customerZammadId,
        binding,
      },
      serviceGroups
    )
    results.push(result)

    if (!dryRun && result.status === 'mapped') {
      await prisma.customerGroupAssignment.upsert({
        where: { customerZammadId: result.customerZammadId },
        create: {
          customerZammadId: result.customerZammadId,
          serviceGroupId: result.serviceGroupId,
          assignedBy: 'binding-migration',
        },
        update: {
          serviceGroupId: result.serviceGroupId,
          assignedBy: 'binding-migration',
        },
      })
    }
  }

  return results
}
