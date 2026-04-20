import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const translations: Record<string, string> = {
      'admin.users.table.email': 'Email',
      'admin.users.table.phone': 'Phone',
      'admin.users.table.region': 'Region',
      'admin.users.table.role': 'Role',
      'admin.users.roles.customer': 'Customer',
      'admin.users.statusOptions.active': 'Active',
      'admin.users.detail.basicInfoTitle': 'Basic Information',
      'admin.users.detail.accountStatusTitle': 'Account Status',
      'admin.users.detail.ticketStatsTitle': 'Ticket Statistics',
      'admin.users.detail.activityTitle': 'Activity',
      'admin.users.detail.viewTickets': 'View Tickets',
      'admin.users.detail.created': 'Created',
      'admin.users.detail.lastUpdated': 'Last Updated',
      'admin.users.detail.lastLogin': 'Last Login',
      'admin.users.detail.verified': 'Verified',
      'admin.users.detail.outOfOffice': 'Out of office',
      'admin.users.detail.outOfOfficeAvailable': 'Available',
      'admin.users.detail.notFoundTitle': 'User not found',
      'admin.users.detail.notFoundDescription': 'The requested user could not be found',
      'admin.users.createPage.backToUsers': 'Back to Users',
      'admin.users.editUser': 'Edit User',
      'admin.users.editDialog.firstName': 'First name',
      'admin.users.editDialog.firstNamePlaceholder': 'First name',
      'admin.users.editDialog.lastName': 'Last name',
      'admin.users.editDialog.lastNamePlaceholder': 'Last name',
      'admin.users.editDialog.email': 'Email',
      'admin.users.editDialog.emailHint': 'Email cannot be changed',
      'admin.users.editDialog.phone': 'Phone',
      'admin.users.editDialog.role': 'Role',
      'admin.users.editDialog.roleHint': 'Role is managed elsewhere',
      'admin.users.editDialog.regionPlaceholder': 'Select region',
      'admin.users.editDialog.accountStatus': 'Account status',
      'admin.users.editDialog.accountStatusHint': 'Enable or disable access',
      'admin.users.editDialog.saveChanges': 'Save Changes',
      'admin.users.editDialog.cancel': 'Cancel',
      'admin.users.roles.staffRegionHint': 'Staff can only access tickets from their assigned region',
      'admin.users.serviceGroup.title': 'Service Group',
      'admin.users.serviceGroup.current': 'Current Service Group',
      'admin.users.serviceGroup.owner': 'Service Group Owner',
      'admin.users.serviceGroup.placeholder': 'Select a service group',
      'admin.users.serviceGroup.assign': 'Assign Service Group',
      'admin.users.serviceGroup.assigning': 'Assigning...',
      'admin.dashboard.stats.openTickets': 'Open Tickets',
      'admin.dashboard.stats.closedTickets': 'Closed Tickets',
      'common.edit': 'Edit',
      'common.yes': 'Yes',
      'common.no': 'No',
      'common.regions.asia-pacific': 'Asia-Pacific',
    }

    return (key: string) => translations[namespace ? `${namespace}.${key}` : key] ?? key
  },
}))

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
      expect(screen.getByText('Service Group')).toBeInTheDocument()
    })
    expect(screen.getAllByText('亚太 1').length).toBeGreaterThan(0)
    expect(screen.getByText('Agent One')).toBeInTheDocument()
    expect(screen.getByText('Current Service Group')).toBeInTheDocument()
    expect(screen.getByText('Service Group Owner')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Assign Service Group' })).toBeInTheDocument()
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
      expect(screen.getByText('Service Group')).toBeInTheDocument()
    })
    expect(screen.getByText('亚太 1')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeDisabled()
  })
})
