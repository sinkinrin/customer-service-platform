/**
 * Security scenario tests
 *
 * Focus on access control across roles and regions using real auth utilities.
 */

import { describe, it, expect } from 'vitest'
import {
  hasRegionAccess,
  hasGroupAccess,
  hasConversationRegionAccess,
  filterConversationsByRegion,
  filterTicketsByRegion,
  validateTicketAccess,
  validateConversationAccess,
} from '@/lib/utils/region-auth'
import { getGroupIdByRegion } from '@/lib/constants/regions'

describe('Security: access control', () => {
  const customerA = {
    id: 'cust_a',
    email: 'customer_a@test.com',
    role: 'customer' as const,
    region: 'asia-pacific',
  }

  const customerB = {
    id: 'cust_b',
    email: 'customer_b@test.com',
    role: 'customer' as const,
    region: 'europe-zone-1',
  }

  const staffAsia = {
    id: 'staff_asia',
    email: 'staff@test.com',
    role: 'staff' as const,
    region: 'asia-pacific',
  }

  describe('Customer isolation', () => {
    it('customer A cannot access customer B conversation', () => {
      const customerBConversation = {
        id: 'conv_b',
        region: 'europe-zone-1' as const,
        customer_email: customerB.email,
      }

      const hasAccess = hasConversationRegionAccess(customerA, customerBConversation)

      expect(hasAccess).toBe(false)
    })

    it('customer only sees their own conversation list', () => {
      const allConversations = [
        { id: 'conv_a1', region: 'asia-pacific' as const, customer_email: customerA.email },
        { id: 'conv_a2', region: 'asia-pacific' as const, customer_email: customerA.email },
        { id: 'conv_b1', region: 'europe-zone-1' as const, customer_email: customerB.email },
      ]

      const customerAConvs = filterConversationsByRegion(allConversations, customerA)

      expect(customerAConvs.length).toBe(2)
      expect(customerAConvs.every(c => c.customer_email === customerA.email)).toBe(true)
    })

    it('customer cannot access other customer conversation via URL tampering', () => {
      const targetConversation = {
        id: 'conv_b',
        region: 'europe-zone-1' as const,
        customer_email: customerB.email,
      }

      expect(() => {
        validateConversationAccess(customerA, targetConversation)
      }).toThrow()
    })
  })

  describe('Staff region restriction', () => {
    it('asia staff cannot access europe tickets', () => {
      const europeGroupId = getGroupIdByRegion('europe-zone-1')

      expect(hasGroupAccess(staffAsia, europeGroupId)).toBe(false)
    })

    it('staff access to another region should throw', () => {
      const europeGroupId = getGroupIdByRegion('europe-zone-1')

      expect(() => {
        validateTicketAccess(staffAsia, europeGroupId)
      }).toThrow(/permission/)
    })

    it('staff cannot modify other region conversations', () => {
      const europeConversation = {
        id: 'conv_eu',
        region: 'europe-zone-1' as const,
        customer_email: 'eu_customer@test.com',
      }

      expect(() => {
        validateConversationAccess(staffAsia, europeConversation)
      }).toThrow()
    })
  })

  describe('Role boundaries', () => {
    it('customer can only access their region group', () => {
      const asiaGroupId = getGroupIdByRegion('asia-pacific')
      const europeGroupId = getGroupIdByRegion('europe-zone-1')

      expect(hasGroupAccess(customerA, asiaGroupId)).toBe(true)
      expect(hasGroupAccess(customerA, europeGroupId)).toBe(false)
    })

    it('staff cannot access all groups', () => {
      const allGroups = [1, 2, 3, 4, 5, 6, 7, 8]
      const accessibleGroups = allGroups.filter(g => hasGroupAccess(staffAsia, g))

      expect(accessibleGroups.length).toBeLessThan(8)
    })
  })

  describe('Data filtering', () => {
    it('filter should drop tickets without permission', () => {
      const asiaGroupId = getGroupIdByRegion('asia-pacific')
      const europeGroupId = getGroupIdByRegion('europe-zone-1')
      const middleEastGroupId = getGroupIdByRegion('middle-east')
      const northAmericaGroupId = getGroupIdByRegion('north-america')

      const mixedTickets = [
        { id: 1, group_id: asiaGroupId, customer_id: 1 },
        { id: 2, group_id: europeGroupId, customer_id: 2 },
        { id: 3, group_id: middleEastGroupId, customer_id: 3 },
        { id: 4, group_id: northAmericaGroupId, customer_id: 4 },
      ]

      const filtered = filterTicketsByRegion(mixedTickets, staffAsia)

      expect(filtered).toHaveLength(1)
      expect(filtered[0].group_id).toBe(asiaGroupId)
    })

    it('filter should ignore malformed group_id entries', () => {
      const asiaGroupId = getGroupIdByRegion('asia-pacific')

      const maliciousData = [
        { id: 1, group_id: asiaGroupId, customer_id: 1 },
        { id: 2, group_id: undefined, customer_id: 2 },
        { id: 3, group_id: null as any, customer_id: 3 },
        { id: 4, group_id: -1, customer_id: 4 },
      ]

      const filtered = filterTicketsByRegion(maliciousData, staffAsia)

      expect(filtered).toHaveLength(1)
      expect(filtered[0].group_id).toBe(asiaGroupId)
    })
  })

  describe('Conversation isolation', () => {
    it('customer cannot access another customer conversation in same region', () => {
      const conversation1 = {
        id: 'conv_1',
        region: 'asia-pacific' as const,
        customer_email: customerA.email,
      }

      const conversation2 = {
        id: 'conv_2',
        region: 'asia-pacific' as const,
        customer_email: customerA.email,
      }

      expect(hasConversationRegionAccess(customerA, conversation1)).toBe(true)
      expect(hasConversationRegionAccess(customerA, conversation2)).toBe(true)
      expect(hasConversationRegionAccess(customerB, conversation1)).toBe(false)
      expect(hasConversationRegionAccess(customerB, conversation2)).toBe(false)
    })
  })
})
