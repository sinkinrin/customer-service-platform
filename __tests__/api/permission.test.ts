/**
 * Permission Utility Tests
 * 
 * Tests for ticket permission checking, including:
 * - owner_id=1 (Zammad system user) as unassigned ticket detection
 * - Staff visibility restrictions for unassigned tickets
 * - Region-based access control
 */

import { describe, it, expect } from 'vitest'
import { 
  checkTicketPermission, 
  filterTicketsByPermission,
  type AuthUser,
  type Ticket,
} from '../../src/lib/utils/permission'

describe('checkTicketPermission', () => {
  // Test users
  const adminUser: AuthUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    role: 'admin',
    zammad_id: 100,
    group_ids: [1, 2, 3, 4, 5, 6, 7, 8],
  }

  const staffUser: AuthUser = {
    id: 'staff-1',
    email: 'staff@example.com',
    role: 'staff',
    zammad_id: 200,
    group_ids: [2], // Asia region
    region: 'asia',
  }

  const customerUser: AuthUser = {
    id: 'customer-1',
    email: 'customer@example.com',
    role: 'customer',
    zammad_id: 300,
  }

  describe('Admin permissions', () => {
    it('should allow admin to view any ticket', () => {
      const ticket: Ticket = { id: 1, customer_id: 300, owner_id: null, group_id: null }
      const result = checkTicketPermission({ user: adminUser, ticket, action: 'view' })
      expect(result.allowed).toBe(true)
    })

    it('should allow admin to delete any ticket', () => {
      const ticket: Ticket = { id: 1, customer_id: 300, owner_id: 200, group_id: 2 }
      const result = checkTicketPermission({ user: adminUser, ticket, action: 'delete' })
      expect(result.allowed).toBe(true)
    })

    it('should allow admin to assign any ticket', () => {
      const ticket: Ticket = { id: 1, customer_id: 300, owner_id: null, group_id: null }
      const result = checkTicketPermission({ user: adminUser, ticket, action: 'assign' })
      expect(result.allowed).toBe(true)
    })
  })

  describe('Staff permissions - Unassigned ticket detection', () => {
    it('should NOT allow staff to view tickets with owner_id=null and group_id=null', () => {
      const ticket: Ticket = { id: 1, customer_id: 300, owner_id: null, group_id: null }
      const result = checkTicketPermission({ user: staffUser, ticket, action: 'view' })
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('unassigned')
    })

    it('should NOT allow staff to view tickets with owner_id=1 (Zammad system user) and group_id=null', () => {
      // This is the key test for the fix - owner_id=1 means unassigned in Zammad
      const ticket: Ticket = { id: 1, customer_id: 300, owner_id: 1, group_id: null }
      const result = checkTicketPermission({ user: staffUser, ticket, action: 'view' })
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('unassigned')
    })

    it('should NOT allow staff to view tickets with owner_id=1 even with valid group_id', () => {
      // Per spec: owner_id=1 means unassigned, staff cannot see regardless of group_id
      const ticket: Ticket = { id: 1, customer_id: 300, owner_id: 1, group_id: 2 }
      const result = checkTicketPermission({ user: staffUser, ticket, action: 'view' })
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('unassigned')
    })
  })

  describe('Staff permissions - Region-based access', () => {
    it('should allow staff to view tickets assigned to them', () => {
      const ticket: Ticket = { id: 1, customer_id: 300, owner_id: 200, group_id: 3 }
      const result = checkTicketPermission({ user: staffUser, ticket, action: 'view' })
      expect(result.allowed).toBe(true)
    })

    it('should allow staff to view tickets in their region', () => {
      const ticket: Ticket = { id: 1, customer_id: 300, owner_id: 201, group_id: 2 }
      const result = checkTicketPermission({ user: staffUser, ticket, action: 'view' })
      expect(result.allowed).toBe(true)
    })

    it('should NOT allow staff to view tickets in other regions', () => {
      const ticket: Ticket = { id: 1, customer_id: 300, owner_id: 201, group_id: 3 }
      const result = checkTicketPermission({ user: staffUser, ticket, action: 'view' })
      expect(result.allowed).toBe(false)
    })

    it('should NOT allow staff to delete tickets', () => {
      const ticket: Ticket = { id: 1, customer_id: 300, owner_id: 200, group_id: 2 }
      const result = checkTicketPermission({ user: staffUser, ticket, action: 'delete' })
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('admin')
    })
  })

  describe('Customer permissions', () => {
    it('should allow customer to view their own ticket', () => {
      const ticket: Ticket = { id: 1, customer_id: 300, owner_id: 200, group_id: 2 }
      const result = checkTicketPermission({ user: customerUser, ticket, action: 'view' })
      expect(result.allowed).toBe(true)
    })

    it('should NOT allow customer to view other customer tickets', () => {
      const ticket: Ticket = { id: 1, customer_id: 999, owner_id: 200, group_id: 2 }
      const result = checkTicketPermission({ user: customerUser, ticket, action: 'view' })
      expect(result.allowed).toBe(false)
    })

    it('should allow customer to close their own ticket', () => {
      const ticket: Ticket = { id: 1, customer_id: 300, owner_id: 200, group_id: 2 }
      const result = checkTicketPermission({ user: customerUser, ticket, action: 'close' })
      expect(result.allowed).toBe(true)
    })

    it('should NOT allow customer to delete tickets', () => {
      const ticket: Ticket = { id: 1, customer_id: 300, owner_id: 200, group_id: 2 }
      const result = checkTicketPermission({ user: customerUser, ticket, action: 'delete' })
      expect(result.allowed).toBe(false)
    })
  })
})

describe('filterTicketsByPermission', () => {
  const staffUser: AuthUser = {
    id: 'staff-1',
    email: 'staff@example.com',
    role: 'staff',
    zammad_id: 200,
    group_ids: [2], // Asia region
    region: 'asia',
  }

  it('should filter out unassigned tickets (owner_id=null, group_id=null) for staff', () => {
    const tickets: Ticket[] = [
      { id: 1, customer_id: 300, owner_id: null, group_id: null }, // Unassigned - should be filtered
      { id: 2, customer_id: 301, owner_id: 200, group_id: 2 },     // Assigned to staff - should be kept
      { id: 3, customer_id: 302, owner_id: 201, group_id: 2 },     // In staff's region - should be kept
    ]

    const result = filterTicketsByPermission(tickets, staffUser)
    expect(result.length).toBe(2)
    expect(result.map((t: Ticket) => t.id)).toEqual([2, 3])
  })

  it('should filter out all unassigned tickets (owner_id=1) for staff regardless of group_id', () => {
    const tickets: Ticket[] = [
      { id: 1, customer_id: 300, owner_id: 1, group_id: null },    // Zammad system user - should be filtered
      { id: 2, customer_id: 301, owner_id: 1, group_id: 2 },       // owner_id=1 with group - STILL filtered per spec
      { id: 3, customer_id: 302, owner_id: 200, group_id: 2 },     // Assigned to staff - should be kept
    ]

    const result = filterTicketsByPermission(tickets, staffUser)
    expect(result.length).toBe(1)
    expect(result.map((t: Ticket) => t.id)).toEqual([3])
  })

  it('should filter out tickets in other regions for staff', () => {
    const tickets: Ticket[] = [
      { id: 1, customer_id: 300, owner_id: 201, group_id: 2 },     // Asia region - should be kept
      { id: 2, customer_id: 301, owner_id: 202, group_id: 3 },     // Europe region - should be filtered
      { id: 3, customer_id: 302, owner_id: 200, group_id: 4 },     // Assigned but other region - should be kept (assigned to staff)
    ]

    const result = filterTicketsByPermission(tickets, staffUser)
    expect(result.length).toBe(2)
    expect(result.map((t: Ticket) => t.id)).toEqual([1, 3])
  })
})
