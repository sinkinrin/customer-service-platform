import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const translations: Record<string, string> = {
      'admin.serviceGroups.pageTitle': 'Service Groups',
      'admin.serviceGroups.pageDescription': 'Manage refined partitions',
      'admin.serviceGroups.title': 'Service Group List',
      'admin.serviceGroups.description': 'Each service group belongs to one base region and one responsible staff member.',
      'admin.serviceGroups.createButton': 'New Service Group',
      'admin.serviceGroups.refreshButton': 'Refresh',
      'admin.serviceGroups.deactivateButton': 'Deactivate',
      'admin.serviceGroups.empty': 'No service groups yet',
      'admin.serviceGroups.table.name': 'Name',
      'admin.serviceGroups.table.baseRegion': 'Base Region',
      'admin.serviceGroups.table.owner': 'Owner',
      'admin.serviceGroups.table.status': 'Status',
      'admin.serviceGroups.table.updatedAt': 'Updated At',
      'admin.serviceGroups.table.actions': 'Actions',
      'admin.serviceGroups.status.active': 'Active',
      'admin.serviceGroups.status.inactive': 'Inactive',
      'admin.serviceGroups.form.name': 'Name',
      'admin.serviceGroups.form.namePlaceholder': 'APAC Premium',
      'admin.serviceGroups.form.baseRegion': 'Base Region',
      'admin.serviceGroups.form.staff': 'Assigned Staff',
      'admin.serviceGroups.form.staffPlaceholder': 'Select a staff member',
      'admin.serviceGroups.form.noStaff': 'No staff members are available right now',
      'admin.serviceGroups.form.transferTarget': 'Transfer customers to',
      'admin.serviceGroups.form.transferTargetPlaceholder': 'Select a target service group',
      'admin.serviceGroups.dialog.createTitle': 'Create Service Group',
      'admin.serviceGroups.dialog.createDescription': 'Create a new refined partition',
      'admin.serviceGroups.dialog.createConfirm': 'Create',
      'admin.serviceGroups.dialog.editTitle': 'Edit Service Group',
      'admin.serviceGroups.dialog.editDescription': 'Edit service group',
      'admin.serviceGroups.dialog.deactivateTitle': 'Deactivate Service Group',
      'admin.serviceGroups.dialog.deactivateDescription': 'Deactivate {name}',
      'admin.serviceGroups.dialog.noTransferTargets': 'No transfer targets',
      'toast.admin.serviceGroups.loadError': 'Load error',
      'toast.admin.serviceGroups.staffLoadError': 'Staff load error',
      'toast.admin.serviceGroups.validationError': 'Validation error',
      'toast.admin.serviceGroups.transferRequired': 'Transfer required',
      'toast.admin.serviceGroups.createSuccess': 'Service group created successfully',
      'toast.admin.serviceGroups.createError': 'Create error',
      'toast.admin.serviceGroups.updateSuccess': 'Update success',
      'toast.admin.serviceGroups.updateError': 'Update error',
      'toast.admin.serviceGroups.deactivateSuccess': 'Deactivate success',
      'toast.admin.serviceGroups.deactivateError': 'Deactivate error',
      'common.cancel': 'Cancel',
      'common.edit': 'Edit',
      'common.save': 'Save',
      'common.loading': 'Loading',
      'common.regions.asia-pacific': 'Asia-Pacific',
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

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

import AdminServiceGroupsPage from '@/app/admin/service-groups/page'

describe('admin service groups page', () => {
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

  it('creates a service group from the admin page', async () => {
    let serviceGroupsCalls = 0
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url === '/api/staff/available') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              staff: [
                {
                  id: 55,
                  name: 'Alice Agent',
                  email: 'alice@example.com',
                  is_available: true,
                  is_on_vacation: false,
                  ticket_count: 2,
                },
              ],
            },
          }),
        })
      }

      if (url === '/api/admin/service-groups' && !init) {
        serviceGroupsCalls += 1

        if (serviceGroupsCalls === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                serviceGroups: [
                  {
                    id: 1,
                    name: 'APAC Alpha',
                    baseRegion: 'ASIA_PACIFIC',
                    staffZammadId: 12,
                    isActive: true,
                    updatedAt: '2026-04-21T00:00:00Z',
                  },
                ],
              },
            }),
          })
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              serviceGroups: [
                {
                  id: 1,
                  name: 'APAC Alpha',
                  baseRegion: 'ASIA_PACIFIC',
                  staffZammadId: 12,
                  isActive: true,
                  updatedAt: '2026-04-21T00:00:00Z',
                },
                {
                  id: 2,
                  name: 'APAC Premium',
                  baseRegion: 'ASIA_PACIFIC',
                  staffZammadId: 55,
                  isActive: true,
                  updatedAt: '2026-04-21T01:00:00Z',
                },
              ],
            },
          }),
        })
      }

      if (url === '/api/admin/service-groups' && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              serviceGroup: {
                id: 2,
                name: 'APAC Premium',
                baseRegion: 'ASIA_PACIFIC',
                staffZammadId: 55,
                isActive: true,
              },
            },
          }),
        })
      }

      throw new Error(`Unhandled fetch: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock as any)

    render(<AdminServiceGroupsPage />)

    await waitFor(() => {
      expect(screen.getByText('APAC Alpha')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'New Service Group' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Name'), {
      target: { value: 'APAC Premium' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/service-groups',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'APAC Premium',
            baseRegion: 'ASIA_PACIFIC',
            staffZammadId: 55,
          }),
        })
      )
    })

    await waitFor(() => {
      expect(screen.getByText('APAC Premium')).toBeInTheDocument()
    })
    expect(screen.getByText('Alice Agent (alice@example.com)')).toBeInTheDocument()
    expect(toastSuccess).toHaveBeenCalledWith('Service group created successfully')
  })
})
