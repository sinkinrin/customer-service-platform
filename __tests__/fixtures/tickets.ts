/**
 * 测试工单数据 Fixtures
 */

import { testUsers } from './users'

export const testTickets = {
  openTicket: {
    id: 1,
    number: '10001',
    title: 'Cannot login to my account',
    state: 'open' as const,
    priority: 'normal' as const,
    customer_id: testUsers.customer.id,
    customer: {
      id: testUsers.customer.id,
      email: testUsers.customer.email,
      name: testUsers.customer.name,
    },
    group_id: 1,
    owner_id: null,
    created_at: '2025-01-01T10:00:00.000Z',
    updated_at: '2025-01-01T10:00:00.000Z',
  },
  
  pendingTicket: {
    id: 2,
    number: '10002',
    title: 'Feature request: Dark mode',
    state: 'pending' as const,
    priority: 'low' as const,
    customer_id: testUsers.customer.id,
    customer: {
      id: testUsers.customer.id,
      email: testUsers.customer.email,
      name: testUsers.customer.name,
    },
    group_id: 1,
    owner_id: testUsers.staff.zammad_user_id,
    created_at: '2025-01-01T09:00:00.000Z',
    updated_at: '2025-01-01T11:00:00.000Z',
  },
  
  closedTicket: {
    id: 3,
    number: '10003',
    title: 'Password reset completed',
    state: 'closed' as const,
    priority: 'normal' as const,
    customer_id: testUsers.customer.id,
    customer: {
      id: testUsers.customer.id,
      email: testUsers.customer.email,
      name: testUsers.customer.name,
    },
    group_id: 1,
    owner_id: testUsers.staff.zammad_user_id,
    created_at: '2025-01-01T08:00:00.000Z',
    updated_at: '2025-01-01T08:30:00.000Z',
  },
  
  urgentTicket: {
    id: 4,
    number: '10004',
    title: 'System down - Critical issue',
    state: 'open' as const,
    priority: 'high' as const,
    customer_id: testUsers.customer.id,
    customer: {
      id: testUsers.customer.id,
      email: testUsers.customer.email,
      name: testUsers.customer.name,
    },
    group_id: 1,
    owner_id: null,
    created_at: '2025-01-01T12:00:00.000Z',
    updated_at: '2025-01-01T12:00:00.000Z',
  },
}

export const testArticles = {
  customerArticle: {
    id: 1,
    ticket_id: testTickets.openTicket.id,
    from: testUsers.customer.email,
    to: 'support@example.com',
    subject: testTickets.openTicket.title,
    body: 'I cannot login to my account. It says invalid credentials.',
    content_type: 'text/plain',
    internal: false,
    created_at: '2025-01-01T10:00:00.000Z',
  },
  
  staffArticle: {
    id: 2,
    ticket_id: testTickets.openTicket.id,
    from: 'support@example.com',
    to: testUsers.customer.email,
    subject: `Re: ${testTickets.openTicket.title}`,
    body: 'Thank you for contacting us. Please try resetting your password.',
    content_type: 'text/plain',
    internal: false,
    created_at: '2025-01-01T10:15:00.000Z',
  },
  
  internalNote: {
    id: 3,
    ticket_id: testTickets.openTicket.id,
    from: testUsers.staff.email,
    to: '',
    subject: 'Internal Note',
    body: 'Customer has been having login issues for the past week.',
    content_type: 'text/plain',
    internal: true,
    created_at: '2025-01-01T10:10:00.000Z',
  },
}

export type TestTicket = typeof testTickets.openTicket
export type TestArticle = typeof testArticles.customerArticle
