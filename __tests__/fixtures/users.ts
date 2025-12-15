/**
 * 测试用户数据 Fixtures
 */

export const testUsers = {
  customer: {
    id: 'test-customer-id',
    email: 'customer@test.com',
    name: 'Test Customer',
    role: 'customer' as const,
    phone: '+1234567890',
    region: 'asia-pacific' as const,
    zammad_user_id: 1,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
  },
  
  staff: {
    id: 'test-staff-id',
    email: 'staff@test.com',
    name: 'Test Staff',
    role: 'staff' as const,
    phone: '+1234567891',
    region: 'asia-pacific' as const,
    zammad_user_id: 2,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
  },
  
  admin: {
    id: 'test-admin-id',
    email: 'admin@test.com',
    name: 'Test Admin',
    role: 'admin' as const,
    phone: '+1234567892',
    region: 'asia-pacific' as const,
    zammad_user_id: 3,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
  },
}

export const testSessions = {
  customer: {
    user: testUsers.customer,
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  },
  
  staff: {
    user: testUsers.staff,
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  },
  
  admin: {
    user: testUsers.admin,
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  },
}

export type TestUser = typeof testUsers.customer
export type TestSession = typeof testSessions.customer
