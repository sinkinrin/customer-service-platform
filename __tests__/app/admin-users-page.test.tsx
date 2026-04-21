import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const translations: Record<string, string> = {
      'admin.users.pageTitle': 'User Management',
      'admin.users.pageDescription': 'Manage users',
      'admin.users.title': 'Users',
      'admin.users.searchDescription': 'Search users',
      'admin.users.searchPlaceholder': 'Search by name or email...',
      'admin.users.filters.allRoles': 'All Roles',
      'admin.users.filters.allRegions': 'All Regions',
      'admin.users.filters.allStatuses': 'All Statuses',
      'admin.users.table.name': 'Name',
      'admin.users.table.email': 'Email',
      'admin.users.table.role': 'Role',
      'admin.users.table.region': 'Region',
      'admin.users.table.status': 'Status',
      'admin.users.table.phone': 'Phone',
      'admin.users.table.createdAt': 'Created At',
      'admin.users.table.actions': 'Actions',
      'admin.users.roles.admin': 'Admin',
      'admin.users.statusOptions.active': 'Active',
      'admin.users.editUser': 'Edit User',
      'admin.users.editDialog.title': 'Edit User',
      'admin.users.editDialog.description': 'Update user information',
      'admin.users.editDialog.firstName': 'First Name',
      'admin.users.editDialog.lastName': 'Last Name',
      'admin.users.editDialog.email': 'Email',
      'admin.users.editDialog.role': 'Role',
      'admin.users.editDialog.regionPlaceholder': 'Select region',
      'admin.users.editDialog.phone': 'Phone',
      'admin.users.editDialog.cancel': 'Cancel',
      'admin.users.editDialog.save': 'Save',
      'admin.users.roles.customer': 'Customer',
      'admin.users.roles.staff': 'Staff',
      'admin.users.roles.staffRegionHint': 'Staff can only access tickets from their assigned region',
      'admin.users.serviceGroup.title': 'Service Group',
      'admin.users.serviceGroup.placeholder': 'Select a service group',
      'admin.users.serviceGroup.regionHint': 'Customer region is controlled by the assigned service group.',
      'admin.users.pagination.showing': 'Showing {start} to {end} of {total} users',
      'admin.users.pagination.previous': 'Previous',
      'admin.users.pagination.next': 'Next',
      'admin.users.actions.importUsers': 'Import Users',
      'toast.admin.users.loadError': 'Load error',
      'common.loading': 'Loading',
      'common.cancel': 'Cancel',
      'common.confirm': 'Confirm',
      'common.regions.africa': 'Africa',
    }

    return (key: string, values?: Record<string, string | number>) => {
      const template = translations[namespace ? `${namespace}.${key}` : key] ?? key
      if (!values) return template

      return Object.entries(values).reduce(
        (result, [name, value]) => result.replace(`{${name}}`, String(value)),
        template
      )
    }
  },
}))

vi.mock('@/components/admin/user-import-dialog', () => ({
  UserImportDialog: () => null,
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

import UsersPage from '@/app/admin/users/page'

describe('admin users page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(global as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    ;(global as any).IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  })

  it('opens the edit dialog when the user row is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          users: [
            {
              user_id: '1',
              zammad_id: 1,
              email: 'support@example.com',
              full_name: 'Howen Support',
              firstname: 'Howen',
              lastname: 'Support',
              role: 'admin',
              region: 'africa',
              active: true,
              created_at: '2026-04-21T00:00:00Z',
            },
          ],
          pagination: {
            limit: 20,
            offset: 0,
            total: 1,
          },
        },
      }),
    }) as any)

    render(<UsersPage />)

    await waitFor(() => {
      expect(screen.getByText('Howen Support')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Howen Support'))

    await waitFor(() => {
      expect(screen.getByText('Edit User')).toBeInTheDocument()
    })
    expect(screen.getByDisplayValue('support@example.com')).toBeInTheDocument()
  })

  it('loads service-group controls for customer edit dialog', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            users: [
              {
                user_id: '101',
                zammad_id: 101,
                email: 'customer@example.com',
                full_name: 'Customer User',
                firstname: 'Customer',
                lastname: 'User',
                role: 'customer',
                region: 'africa',
                active: true,
                created_at: '2026-04-21T00:00:00Z',
              },
            ],
            pagination: {
              limit: 20,
              offset: 0,
              total: 1,
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            user: {
              id: 101,
              user_id: '101',
              email: 'customer@example.com',
              full_name: 'Customer User',
              firstname: 'Customer',
              lastname: 'User',
              role: 'customer',
              region: 'africa',
              active: true,
              service_group: { id: 3, name: 'Africa Premium' },
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            serviceGroups: [{ id: 3, name: 'Africa Premium' }],
          },
        }),
      })

    vi.stubGlobal('fetch', fetchMock as any)

    render(<UsersPage />)

    await waitFor(() => {
      expect(screen.getByText('Customer User')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Customer User'))

    await waitFor(() => {
      expect(screen.getByText('Service Group')).toBeInTheDocument()
    })
    expect(screen.getAllByText('Africa Premium').length).toBeGreaterThan(0)
    expect(screen.getByText('Customer region is controlled by the assigned service group.')).toBeInTheDocument()
  })
})
