/**
 * Region Authorization 单元测试
 * 
 * 测试区域权限控制逻辑
 */

import { describe, it, expect } from 'vitest'
import {
  hasRegionAccess,
  hasGroupAccess,
  getAccessibleGroupIds,
  getAccessibleRegions,
  filterTicketsByRegion,
  validateTicketCreation,
  validateTicketAccess,
  hasConversationRegionAccess,
  filterConversationsByRegion,
  validateConversationAccess,
} from '@/lib/utils/region-auth'

// 测试用户
const adminUser = { id: 'admin_1', email: 'admin@test.com', role: 'admin' as const }
const staffAsia = { id: 'staff_1', email: 'staff@test.com', role: 'staff' as const, region: 'asia-pacific' }
const staffEurope = { id: 'staff_2', email: 'staff2@test.com', role: 'staff' as const, region: 'europe-zone-1' }
const customer = { id: 'customer_1', email: 'customer@test.com', role: 'customer' as const, region: 'asia-pacific' }
const customerNoRegion = { id: 'customer_2', email: 'customer2@test.com', role: 'customer' as const }

describe('Region Authorization', () => {
  describe('hasRegionAccess', () => {
    it('should allow admin to access any region', () => {
      expect(hasRegionAccess(adminUser, 'asia-pacific')).toBe(true)
      expect(hasRegionAccess(adminUser, 'europe-zone-1')).toBe(true)
      expect(hasRegionAccess(adminUser, 'north-america')).toBe(true)
    })

    it('should allow staff to access only their region', () => {
      expect(hasRegionAccess(staffAsia, 'asia-pacific')).toBe(true)
      expect(hasRegionAccess(staffAsia, 'europe-zone-1')).toBe(false)
      expect(hasRegionAccess(staffEurope, 'europe-zone-1')).toBe(true)
      expect(hasRegionAccess(staffEurope, 'asia-pacific')).toBe(false)
    })

    it('should allow customer to access their region', () => {
      expect(hasRegionAccess(customer, 'asia-pacific')).toBe(true)
      expect(hasRegionAccess(customer, 'europe-zone-1')).toBe(false)
    })

    it('should allow customer without region to access any region', () => {
      expect(hasRegionAccess(customerNoRegion, 'asia-pacific')).toBe(true)
      expect(hasRegionAccess(customerNoRegion, 'europe-zone-1')).toBe(true)
    })
  })

  describe('hasGroupAccess', () => {
    it('should allow admin to access all groups', () => {
      expect(hasGroupAccess(adminUser, 1)).toBe(true)
      expect(hasGroupAccess(adminUser, 5)).toBe(true)
      expect(hasGroupAccess(adminUser, 7)).toBe(true)
    })

    it('should allow staff to access only their region group', () => {
      // Staff Asia should have access to group 4 (asia-pacific) only
      // After 2025-12-23 update, all regions have dedicated groups
      expect(hasGroupAccess(staffAsia, 4)).toBe(true)  // asia-pacific
      expect(hasGroupAccess(staffAsia, 1)).toBe(false) // africa
      expect(hasGroupAccess(staffAsia, 3)).toBe(false) // middle-east
    })

    it('should allow customer to access their region group', () => {
      // Customer with asia-pacific region can access group 4
      expect(hasGroupAccess(customer, 4)).toBe(true)   // asia-pacific
      expect(hasGroupAccess(customer, 1)).toBe(false)  // africa
    })
  })

  describe('getAccessibleGroupIds', () => {
    it('should return all groups for admin', () => {
      const groups = getAccessibleGroupIds(adminUser)
      expect(groups).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    })

    it('should return only region group for staff', () => {
      const groups = getAccessibleGroupIds(staffAsia)
      expect(groups).toEqual([4]) // asia-pacific only
      expect(groups).not.toContain(3) // middle-east
    })

    it('should return region group for customer', () => {
      const groups = getAccessibleGroupIds(customer)
      expect(groups).toEqual([4]) // asia-pacific
    })

    it('should return default group for customer without region', () => {
      const groups = getAccessibleGroupIds(customerNoRegion)
      expect(groups).toEqual([1]) // default to africa
    })

    it('should return empty array for staff without region', () => {
      const staffNoRegion = { id: 'staff_x', email: 'staff@test.com', role: 'staff' as const }
      const groups = getAccessibleGroupIds(staffNoRegion)
      expect(groups).toEqual([])
    })
  })

  describe('getAccessibleRegions', () => {
    it('should return all regions for admin', () => {
      const regions = getAccessibleRegions(adminUser)
      expect(regions).toHaveLength(8)
      expect(regions).toContain('asia-pacific')
      expect(regions).toContain('europe-zone-1')
    })

    it('should return only assigned region for staff', () => {
      const regions = getAccessibleRegions(staffAsia)
      expect(regions).toEqual(['asia-pacific'])
    })

    it('should return only assigned region for customer', () => {
      const regions = getAccessibleRegions(customer)
      expect(regions).toEqual(['asia-pacific'])
    })

    it('should return empty array for user without region', () => {
      const regions = getAccessibleRegions(customerNoRegion)
      expect(regions).toEqual([])
    })
  })

  describe('filterTicketsByRegion', () => {
    // Updated group_ids based on 2025-12-23 mapping:
    // 1=africa, 2=europe-zone-1, 3=middle-east, 4=asia-pacific, 5=cis, 6=north-america, 7=latin-america, 8=europe-zone-2
    const tickets = [
      { id: 1, group_id: 1, customer_id: 1 },  // africa
      { id: 2, group_id: 4, customer_id: 1 },  // asia-pacific
      { id: 3, group_id: 3, customer_id: 2 },  // middle-east
      { id: 4, group_id: 2, customer_id: 1 },  // europe-zone-1
    ]

    it('should return all tickets for admin', () => {
      const filtered = filterTicketsByRegion(tickets, adminUser)
      expect(filtered).toHaveLength(4)
    })

    it('should return all tickets for customer (R5 behavior)', () => {
      // R5: Customers see all their tickets regardless of group_id
      const filtered = filterTicketsByRegion(tickets, customer)
      expect(filtered).toHaveLength(4)
    })

    it('should filter tickets by region for staff', () => {
      const filtered = filterTicketsByRegion(tickets, staffAsia)
      expect(filtered).toHaveLength(1) // only group 4 (asia-pacific)
      expect(filtered.map(t => t.group_id)).toContain(4)
      expect(filtered.map(t => t.group_id)).not.toContain(1) // no africa access
    })

    it('should exclude tickets without group_id for staff', () => {
      const ticketsWithNull = [...tickets, { id: 5, customer_id: 1 }]
      const filtered = filterTicketsByRegion(ticketsWithNull, staffAsia)
      expect(filtered.find(t => t.id === 5)).toBeUndefined()
    })
  })

  describe('validateTicketCreation', () => {
    it('should not throw for admin creating ticket in any region', () => {
      expect(() => validateTicketCreation(adminUser, 'asia-pacific')).not.toThrow()
      expect(() => validateTicketCreation(adminUser, 'europe-zone-1')).not.toThrow()
    })

    it('should not throw for staff creating ticket in their region', () => {
      expect(() => validateTicketCreation(staffAsia, 'asia-pacific')).not.toThrow()
    })

    it('should throw for staff creating ticket in other region', () => {
      expect(() => validateTicketCreation(staffAsia, 'europe-zone-1')).toThrow()
    })
  })

  describe('validateTicketAccess', () => {
    it('should not throw for admin accessing any group', () => {
      expect(() => validateTicketAccess(adminUser, 1)).not.toThrow()
      expect(() => validateTicketAccess(adminUser, 7)).not.toThrow()
    })

    it('should not throw for staff accessing their region group', () => {
      // asia-pacific = group 4 (after 2025-12-23 update)
      expect(() => validateTicketAccess(staffAsia, 4)).not.toThrow() // asia-pacific
    })

    it('should throw for staff accessing other region group', () => {
      expect(() => validateTicketAccess(staffAsia, 3)).toThrow() // middle-east
      expect(() => validateTicketAccess(staffAsia, 1)).toThrow() // africa
    })
  })

  describe('hasConversationRegionAccess', () => {
    const asiaConversation = { id: 'conv_1', region: 'asia-pacific' as const, customer_email: 'customer@test.com' }
    const europeConversation = { id: 'conv_2', region: 'europe-zone-1' as const, customer_email: 'other@test.com' }
    const noRegionConversation = { id: 'conv_3', customer_email: 'customer@test.com' }

    it('should allow admin to access any conversation', () => {
      expect(hasConversationRegionAccess(adminUser, asiaConversation)).toBe(true)
      expect(hasConversationRegionAccess(adminUser, europeConversation)).toBe(true)
    })

    it('should allow customer to access only their own conversations', () => {
      expect(hasConversationRegionAccess(customer, asiaConversation)).toBe(true)
      expect(hasConversationRegionAccess(customer, europeConversation)).toBe(false)
    })

    it('should allow staff to access conversations in their region', () => {
      expect(hasConversationRegionAccess(staffAsia, asiaConversation)).toBe(true)
      expect(hasConversationRegionAccess(staffAsia, europeConversation)).toBe(false)
    })

    it('should allow staff to access conversations without region (legacy)', () => {
      expect(hasConversationRegionAccess(staffAsia, noRegionConversation)).toBe(true)
    })
  })

  describe('filterConversationsByRegion', () => {
    const conversations = [
      { id: 'conv_1', region: 'asia-pacific' as const, customer_email: 'customer@test.com' },
      { id: 'conv_2', region: 'europe-zone-1' as const, customer_email: 'customer@test.com' },
      { id: 'conv_3', region: 'asia-pacific' as const, customer_email: 'other@test.com' },
      { id: 'conv_4', customer_email: 'customer@test.com' }, // no region (legacy)
    ]

    it('should return all conversations for admin', () => {
      const filtered = filterConversationsByRegion(conversations, adminUser)
      expect(filtered).toHaveLength(4)
    })

    it('should return only customer own conversations for customer', () => {
      const filtered = filterConversationsByRegion(conversations, customer)
      expect(filtered).toHaveLength(3)
      expect(filtered.every(c => c.customer_email === 'customer@test.com')).toBe(true)
    })

    it('should filter by region for staff', () => {
      const filtered = filterConversationsByRegion(conversations, staffAsia)
      // Should include asia-pacific and no-region conversations
      expect(filtered).toHaveLength(3)
      expect(filtered.map(c => c.id)).toContain('conv_1')
      expect(filtered.map(c => c.id)).toContain('conv_3')
      expect(filtered.map(c => c.id)).toContain('conv_4')
    })
  })

  describe('validateConversationAccess', () => {
    const asiaConversation = { id: 'conv_1', region: 'asia-pacific' as const, customer_email: 'customer@test.com' }
    const europeConversation = { id: 'conv_2', region: 'europe-zone-1' as const, customer_email: 'other@test.com' }

    it('should not throw for admin accessing any conversation', () => {
      expect(() => validateConversationAccess(adminUser, asiaConversation)).not.toThrow()
      expect(() => validateConversationAccess(adminUser, europeConversation)).not.toThrow()
    })

    it('should not throw for customer accessing their own conversation', () => {
      expect(() => validateConversationAccess(customer, asiaConversation)).not.toThrow()
    })

    it('should throw for customer accessing other conversation', () => {
      expect(() => validateConversationAccess(customer, europeConversation)).toThrow()
    })

    it('should not throw for staff accessing their region conversation', () => {
      expect(() => validateConversationAccess(staffAsia, asiaConversation)).not.toThrow()
    })

    it('should throw for staff accessing other region conversation', () => {
      expect(() => validateConversationAccess(staffAsia, europeConversation)).toThrow()
    })
  })
})
