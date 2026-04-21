import { prisma } from '@/lib/prisma'
import { type RegionValue } from '@/lib/constants/regions'
import { ServiceBaseRegion } from '@prisma/client'

const SERVICE_BASE_REGION_TO_REGION_VALUE: Record<ServiceBaseRegion, RegionValue> = {
  [ServiceBaseRegion.AFRICA]: 'africa',
  [ServiceBaseRegion.MIDDLE_EAST]: 'middle-east',
  [ServiceBaseRegion.ASIA_PACIFIC]: 'asia-pacific',
  [ServiceBaseRegion.NORTH_AMERICA]: 'north-america',
  [ServiceBaseRegion.LATIN_AMERICA]: 'latin-america',
  [ServiceBaseRegion.EUROPE_ZONE_1]: 'europe-zone-1',
  [ServiceBaseRegion.EUROPE_ZONE_2]: 'europe-zone-2',
  [ServiceBaseRegion.CIS]: 'cis',
}

const REGION_VALUE_TO_SERVICE_BASE_REGION: Record<RegionValue, ServiceBaseRegion> = {
  'africa': ServiceBaseRegion.AFRICA,
  'middle-east': ServiceBaseRegion.MIDDLE_EAST,
  'asia-pacific': ServiceBaseRegion.ASIA_PACIFIC,
  'north-america': ServiceBaseRegion.NORTH_AMERICA,
  'latin-america': ServiceBaseRegion.LATIN_AMERICA,
  'europe-zone-1': ServiceBaseRegion.EUROPE_ZONE_1,
  'europe-zone-2': ServiceBaseRegion.EUROPE_ZONE_2,
  'cis': ServiceBaseRegion.CIS,
}

export function mapServiceBaseRegionToRegionValue(baseRegion: ServiceBaseRegion): RegionValue {
  return SERVICE_BASE_REGION_TO_REGION_VALUE[baseRegion]
}

export function mapRegionValueToServiceBaseRegion(region: RegionValue): ServiceBaseRegion {
  return REGION_VALUE_TO_SERVICE_BASE_REGION[region]
}

export async function listServiceGroups(options?: { includeInactive?: boolean }) {
  return prisma.serviceGroup.findMany({
    where: options?.includeInactive ? undefined : { isActive: true },
    orderBy: [{ baseRegion: 'asc' }, { name: 'asc' }],
  })
}

export async function getServiceGroup(id: number, options?: { includeInactive?: boolean }) {
  if (options?.includeInactive) {
    return prisma.serviceGroup.findUnique({
      where: { id },
    })
  }

  return prisma.serviceGroup.findFirst({
    where: { id, isActive: true },
  })
}

export async function getServiceGroupByName(name: string, options?: { includeInactive?: boolean }) {
  if (options?.includeInactive) {
    return prisma.serviceGroup.findUnique({
      where: { name },
    })
  }

  return prisma.serviceGroup.findFirst({
    where: { name, isActive: true },
  })
}

export async function createServiceGroup(input: {
  name: string
  baseRegion: ServiceBaseRegion
  staffZammadId: number
}) {
  return prisma.serviceGroup.create({
    data: {
      name: input.name,
      baseRegion: input.baseRegion,
      staffZammadId: input.staffZammadId,
    },
  })
}

export async function updateServiceGroup(
  id: number,
  input: {
    name?: string
    baseRegion?: ServiceBaseRegion
    staffZammadId?: number
    isActive?: boolean
  }
) {
  return prisma.serviceGroup.update({
    where: { id },
    data: input,
  })
}
