import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockUseAuth = vi.fn()
const capturedProtectedRouteProps: Array<Record<string, unknown>> = []

vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

vi.mock('@/components/auth/protected-route', () => ({
  ProtectedRoute: (props: any) => {
    capturedProtectedRouteProps.push(props)
    return <div data-testid="protected-route">{props.children}</div>
  },
}))

vi.mock('@/components/layouts/customer-layout', () => ({
  CustomerLayout: ({ children }: any) => <div data-testid="customer-layout">{children}</div>,
}))

import CustomerLayoutWrapper from '@/app/customer/layout'

describe('CustomerLayoutWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedProtectedRouteProps.length = 0
    mockUseAuth.mockReturnValue({
      user: {
        id: 'cust_1',
        email: 'customer@test.com',
        full_name: 'Customer User',
        avatar_url: undefined,
      },
      userRole: 'customer',
      signOut: vi.fn(),
    })
  })

  it('restricts customer routes to customer role only', () => {
    render(
      <CustomerLayoutWrapper>
        <div>Customer Content</div>
      </CustomerLayoutWrapper>
    )

    expect(screen.getByTestId('protected-route')).toBeInTheDocument()
    expect(capturedProtectedRouteProps[0]?.requiredRole).toBe('customer')
    expect(capturedProtectedRouteProps[0]?.requiredRoles).toBeUndefined()
  })
})
