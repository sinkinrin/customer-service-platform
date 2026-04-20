import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createServiceGroup,
  getServiceGroup,
  listServiceGroups,
  mapServiceBaseRegionToRegionValue,
  mapRegionValueToServiceBaseRegion,
  updateServiceGroup,
} from '@/lib/service-groups/service-group-service'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    serviceGroup: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

describe('service-group-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists only active service groups by default', async () => {
    vi.mocked(prisma.serviceGroup.findMany).mockResolvedValue([{ id: 1, name: '亚太 1' }] as any)

    const result = await listServiceGroups()

    expect(result).toEqual([{ id: 1, name: '亚太 1' }])
    expect(prisma.serviceGroup.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: [{ baseRegion: 'asc' }, { name: 'asc' }],
    })
  })

  it('loads only active service groups by id by default', async () => {
    vi.mocked(prisma.serviceGroup.findFirst).mockResolvedValue({ id: 7, name: '中东 1', isActive: true } as any)

    const result = await getServiceGroup(7)

    expect(result).toEqual({ id: 7, name: '中东 1', isActive: true })
    expect(prisma.serviceGroup.findFirst).toHaveBeenCalledWith({
      where: { id: 7, isActive: true },
    })
  })

  it('can include inactive service groups when explicitly requested', async () => {
    vi.mocked(prisma.serviceGroup.findUnique).mockResolvedValue({ id: 7, name: '中东 1', isActive: false } as any)

    const result = await getServiceGroup(7, { includeInactive: true })

    expect(result).toEqual({ id: 7, name: '中东 1', isActive: false })
    expect(prisma.serviceGroup.findUnique).toHaveBeenCalledWith({ where: { id: 7 } })
  })

  it('creates a service group', async () => {
    vi.mocked(prisma.serviceGroup.create).mockResolvedValue({ id: 3, name: '欧二 1' } as any)

    const result = await createServiceGroup({
      name: '欧二 1',
      baseRegion: 'EUROPE_ZONE_2' as any,
      staffZammadId: 801,
    })

    expect(result).toEqual({ id: 3, name: '欧二 1' })
    expect(prisma.serviceGroup.create).toHaveBeenCalledWith({
      data: {
        name: '欧二 1',
        baseRegion: 'EUROPE_ZONE_2',
        staffZammadId: 801,
      },
    })
  })

  it('updates a service group', async () => {
    vi.mocked(prisma.serviceGroup.update).mockResolvedValue({ id: 3, isActive: false } as any)

    const result = await updateServiceGroup(3, {
      staffZammadId: 901,
      isActive: false,
    })

    expect(result).toEqual({ id: 3, isActive: false })
    expect(prisma.serviceGroup.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: {
        staffZammadId: 901,
        isActive: false,
      },
    })
  })

  it('maps service base region enum to runtime region value', () => {
    expect(mapServiceBaseRegionToRegionValue('ASIA_PACIFIC' as any)).toBe('asia-pacific')
    expect(mapServiceBaseRegionToRegionValue('EUROPE_ZONE_1' as any)).toBe('europe-zone-1')
  })

  it('maps runtime region value back to service base region enum', () => {
    expect(mapRegionValueToServiceBaseRegion('middle-east')).toBe('MIDDLE_EAST')
    expect(mapRegionValueToServiceBaseRegion('latin-america')).toBe('LATIN_AMERICA')
  })
})
