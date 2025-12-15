/**
 * ProtectedRoute 组件测试
 *
 * 测试认证和授权逻辑：
 * - 未认证用户重定向到登录页
 * - 认证用户可以访问受保护内容
 * - 角色权限检查
 * - 加载状态显示
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ProtectedRoute } from '@/components/auth/protected-route'

// Mock useAuth hook
const mockPush = vi.fn()
const mockUseAuth = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}))

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      userRole: null,
      user: null,
      getUserRole: vi.fn().mockResolvedValue('customer'),
    })
  })

  describe('未认证用户', () => {
    it('应该重定向到登录页', async () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: false,
        userRole: null,
        user: null,
        getUserRole: vi.fn(),
      })

      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/auth/login')
      })
    })

    it('应该重定向到自定义 redirectTo 路径', async () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: false,
        userRole: null,
        user: null,
        getUserRole: vi.fn(),
      })

      render(
        <ProtectedRoute redirectTo="/custom-login">
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/custom-login')
      })
    })

    it('未认证时不应该渲染子内容', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: false,
        userRole: null,
        user: null,
        getUserRole: vi.fn(),
      })

      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })
  })

  describe('认证用户', () => {
    it('应该渲染子内容', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        userRole: 'customer',
        user: { id: '1', email: 'test@test.com' },
        getUserRole: vi.fn(),
      })

      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      expect(screen.getByText('Protected Content')).toBeInTheDocument()
    })

    it('不应该重定向', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        userRole: 'customer',
        user: { id: '1', email: 'test@test.com' },
        getUserRole: vi.fn(),
      })

      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      expect(mockPush).not.toHaveBeenCalled()
    })
  })

  describe('角色权限检查', () => {
    it('用户角色匹配 requiredRole 时应该渲染内容', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        userRole: 'admin',
        user: { id: '1', email: 'admin@test.com' },
        getUserRole: vi.fn(),
      })

      render(
        <ProtectedRoute requiredRole="admin">
          <div>Admin Content</div>
        </ProtectedRoute>
      )

      expect(screen.getByText('Admin Content')).toBeInTheDocument()
    })

    it('用户角色不匹配 requiredRole 时应该显示拒绝访问', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        userRole: 'customer',
        user: { id: '1', email: 'customer@test.com' },
        getUserRole: vi.fn(),
      })

      render(
        <ProtectedRoute requiredRole="admin">
          <div>Admin Content</div>
        </ProtectedRoute>
      )

      // 应该显示拒绝访问消息（翻译 key）
      expect(screen.getByText('title')).toBeInTheDocument()
      expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
    })
  })
})

