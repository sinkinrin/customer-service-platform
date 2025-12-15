/**
 * NextAuth Mock 辅助函数
 */

import { vi } from 'vitest'
import { testSessions, testUsers } from '../fixtures/users'

type UserRole = 'customer' | 'staff' | 'admin'

/**
 * Mock 用户会话
 * @param role 用户角色
 */
export function mockSession(role: UserRole = 'customer') {
  const session = testSessions[role]
  
  vi.mock('next-auth/react', () => ({
    useSession: () => ({
      data: session,
      status: 'authenticated',
    }),
    signIn: vi.fn(),
    signOut: vi.fn(),
    SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  }))
  
  return session
}

/**
 * Mock 未认证状态
 */
export function mockUnauthenticated() {
  vi.mock('next-auth/react', () => ({
    useSession: () => ({
      data: null,
      status: 'unauthenticated',
    }),
    signIn: vi.fn(),
    signOut: vi.fn(),
    SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  }))
}

/**
 * Mock 加载中状态
 */
export function mockLoading() {
  vi.mock('next-auth/react', () => ({
    useSession: () => ({
      data: null,
      status: 'loading',
    }),
    signIn: vi.fn(),
    signOut: vi.fn(),
    SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  }))
}

/**
 * 获取测试用户
 */
export function getTestUser(role: UserRole = 'customer') {
  return testUsers[role]
}

/**
 * 获取测试会话
 */
export function getTestSession(role: UserRole = 'customer') {
  return testSessions[role]
}

/**
 * 创建自定义会话
 */
export function createCustomSession(overrides: Partial<typeof testUsers.customer>) {
  return {
    user: {
      ...testUsers.customer,
      ...overrides,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }
}
