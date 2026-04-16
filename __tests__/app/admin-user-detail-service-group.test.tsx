import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  useParams: () => ({ id: '101' }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, disabled, onCheckedChange }: { checked?: boolean; disabled?: boolean; onCheckedChange?: (checked: boolean) => void }) => (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
    />
  ),
}))

import UserDetailsPage from '@/app/admin/users/[id]/page'
import EditUserPage from '@/app/admin/users/[id]/edit/page'

describe('admin user service-group surfaces', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Radix components expect ResizeObserver to be constructible in JSDOM.
    // The global test setup uses a function mock, which is not sufficient here.
    // Override with a minimal class for this page-level test.
    ;(global as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  })

  it('shows service-group assignment on customer detail page', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            user: {
              id: 101,
              user_id: '101',
              email: 'customer@test.com',
              full_name: 'Customer User',
              firstname: 'Customer',
              lastname: 'User',
              role: 'customer',
              region: 'asia-pacific',
              active: true,
              verified: true,
              out_of_office: false,
              created_at: '2026-04-16T00:00:00Z',
              updated_at: '2026-04-16T00:00:00Z',
              tickets_open: 1,
              tickets_closed: 2,
              service_group: { id: 1, name: '亚太 1', owner_name: 'Agent One' },
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            serviceGroups: [{ id: 1, name: '亚太 1' }],
          },
        }),
      }) as any)

    render(<UserDetailsPage />)

    await waitFor(() => {
      expect(screen.getByText('serviceGroupTitle')).toBeInTheDocument()
    })
    expect(screen.getAllByText('亚太 1').length).toBeGreaterThan(0)
    expect(screen.getByText('Agent One')).toBeInTheDocument()
  })

  it('disables direct region editing for customer on edit page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            id: 101,
            email: 'customer@test.com',
            full_name: 'Customer User',
            firstname: 'Customer',
            lastname: 'User',
            role: 'customer',
            region: 'asia-pacific',
            active: true,
            service_group: { id: 1, name: '亚太 1' },
          },
        },
      }),
    }) as any)

    render(<EditUserPage />)

    await waitFor(() => {
      expect(screen.getByText('serviceGroupTitle')).toBeInTheDocument()
    })
    expect(screen.getByText('亚太 1')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeDisabled()
  })
})
