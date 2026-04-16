import { describe, expect, it } from 'vitest'

import {
  migrateCustomerBindingRecord,
  resolveServiceGroupForBinding,
} from '../../scripts/migrate-customer-bindings-to-service-groups'

describe('migrate customer bindings to service groups', () => {
  const serviceGroups = [
    { id: 1, name: '亚太 1', staffZammadId: 200, baseRegion: 'ASIA_PACIFIC' as const },
    { id: 2, name: '中东 1', staffZammadId: 300, baseRegion: 'MIDDLE_EAST' as const },
    { id: 3, name: '亚太 2', staffZammadId: 400, baseRegion: 'ASIA_PACIFIC' as const },
  ]

  it('maps an active binding to a uniquely matched seeded group by staff id', () => {
    const result = resolveServiceGroupForBinding(
      { customerZammadId: 100, staffZammadId: 300, region: 'middle-east', isActive: true },
      serviceGroups
    )

    expect(result.status).toBe('mapped')
    expect(result.serviceGroupId).toBe(2)
  })

  it('does not assign customers based only on note region', async () => {
    const result = await migrateCustomerBindingRecord(
      {
        customerZammadId: 100,
        binding: null,
        noteRegion: 'asia-pacific',
      },
      serviceGroups
    )

    expect(result.status).toBe('unassigned')
  })

  it('marks ambiguous staff matches as skipped', async () => {
    const result = await migrateCustomerBindingRecord(
      {
        customerZammadId: 100,
        binding: {
          customerZammadId: 100,
          staffZammadId: 200,
          region: 'north-america',
          isActive: true,
        },
      },
      [
        { id: 1, name: '亚太 1', staffZammadId: 200, baseRegion: 'ASIA_PACIFIC' as const },
        { id: 2, name: '拉美 1', staffZammadId: 200, baseRegion: 'LATIN_AMERICA' as const },
      ]
    )

    expect(result.status).toBe('skipped')
    expect(result.reason).toContain('ambiguous')
  })
})
