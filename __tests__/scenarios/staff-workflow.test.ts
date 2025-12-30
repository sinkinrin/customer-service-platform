/**
 * Staff workflow scenarios
 *
 * Exercise region-based access helpers with real utility functions.
 */

import { describe, it, expect } from 'vitest'
import {
  hasRegionAccess,
  hasConversationRegionAccess,
  filterConversationsByRegion,
  filterTicketsByRegion,
} from '@/lib/utils/region-auth'
import { getGroupIdByRegion } from '@/lib/constants/regions'

describe('Staff workflow: daily operations', () => {
  const staffAsia = {
    id: 'staff_asia_001',
    email: 'li.kefu@company.com',
    role: 'staff' as const,
    region: 'asia-pacific',
  }

  const staffEurope = {
    id: 'staff_eu_001',
    email: 'john.support@company.com',
    role: 'staff' as const,
    region: 'europe-zone-1',
  }

  const admin = {
    id: 'admin_001',
    email: 'admin@company.com',
    role: 'admin' as const,
  }

  it('staff only sees conversations in their region', () => {
    const allConversations = [
      { id: 'conv_1', region: 'asia-pacific' as const, customer_email: 'a@test.com' },
      { id: 'conv_2', region: 'europe-zone-1' as const, customer_email: 'b@test.com' },
      { id: 'conv_3', region: 'asia-pacific' as const, customer_email: 'c@test.com' },
    ]

    const visibleConvs = filterConversationsByRegion(allConversations, staffAsia)

    expect(visibleConvs.length).toBe(2)
    expect(visibleConvs.every(c => c.region === 'asia-pacific')).toBe(true)
  })

  it('staff can access legacy conversations without region', () => {
    const conversations = [
      { id: 'conv_1', region: 'asia-pacific' as const, customer_email: 'a@test.com' },
      { id: 'conv_2', customer_email: 'b@test.com' }, // legacy
    ]

    const visibleConvs = filterConversationsByRegion(conversations, staffAsia)

    expect(visibleConvs.length).toBe(2)
  })

  it('admin sees all conversations', () => {
    const allConversations = [
      { id: 'conv_1', region: 'asia-pacific' as const, customer_email: 'a@test.com' },
      { id: 'conv_2', region: 'europe-zone-1' as const, customer_email: 'b@test.com' },
      { id: 'conv_3', region: 'north-america' as const, customer_email: 'c@test.com' },
    ]

    const visibleConvs = filterConversationsByRegion(allConversations, admin)

    expect(visibleConvs.length).toBe(3)
  })

  it('staff can only process tickets in their region group', () => {
    const asiaGroupId = getGroupIdByRegion('asia-pacific')
    const europeGroupId = getGroupIdByRegion('europe-zone-1')
    const northAmericaGroupId = getGroupIdByRegion('north-america')

    const allTickets = [
      { id: 1, group_id: asiaGroupId, customer_id: 1 },
      { id: 2, group_id: europeGroupId, customer_id: 2 },
      { id: 3, group_id: northAmericaGroupId, customer_id: 3 },
    ]

    const visibleTickets = filterTicketsByRegion(allTickets, staffAsia)

    expect(visibleTickets.length).toBe(1)
    expect(visibleTickets[0].group_id).toBe(asiaGroupId)
  })

  it('staff cannot access other regions', () => {
    const hasAccess = hasRegionAccess(staffAsia, 'europe-zone-1')

    expect(hasAccess).toBe(false)
  })

  it('region handoff updates access control', () => {
    const conversation = {
      id: 'conv_001',
      region: 'asia-pacific' as const,
      customer_email: 'customer@test.com',
      staff_id: staffAsia.id,
    }

    expect(hasConversationRegionAccess(staffAsia, conversation)).toBe(true)

    const transferred = {
      ...conversation,
      region: 'europe-zone-1' as const,
      staff_id: staffEurope.id,
    }

    expect(hasConversationRegionAccess(staffEurope, transferred)).toBe(true)
    expect(hasConversationRegionAccess(staffAsia, transferred)).toBe(false)
  })

  it('region stats are scoped for staff', () => {
    const allConversations = [
      { id: 'conv_1', region: 'asia-pacific' as const, customer_email: 'a@test.com', status: 'active' },
      { id: 'conv_2', region: 'asia-pacific' as const, customer_email: 'b@test.com', status: 'closed' },
      { id: 'conv_3', region: 'europe-zone-1' as const, customer_email: 'c@test.com', status: 'active' },
    ]

    const asiaConvs = filterConversationsByRegion(allConversations, staffAsia)
    const activeCount = asiaConvs.filter(c => c.status === 'active').length
    const closedCount = asiaConvs.filter(c => c.status === 'closed').length

    expect(activeCount).toBe(1)
    expect(closedCount).toBe(1)
  })
})
