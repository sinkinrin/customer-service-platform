import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const { pushMock, toastSuccess, toastError } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const translations: Record<string, string> = {
      'admin.users.createPage.title': 'Create New User',
      'admin.users.createPage.description': 'Add a new user to the system with explicit routing assignment',
      'admin.users.createPage.backToUsers': 'Back to Users',
      'admin.users.createPage.createButton': 'Create User',
      'admin.users.createPage.cancel': 'Cancel',
      'admin.users.createPage.cardTitle': 'User Information',
      'admin.users.createPage.cardDescription': 'Fill in the user details. All fields are required.',
      'admin.users.form.emailRequired': 'Email *',
      'admin.users.form.emailPlaceholder': 'email@example.com',
      'admin.users.form.passwordLabel': 'Password *',
      'admin.users.form.passwordPlaceholder': 'Password',
      'admin.users.form.passwordHint': 'At least 8 characters',
      'admin.users.form.fullNameLabel': 'Full Name *',
      'admin.users.form.fullNamePlaceholder': 'Jane Doe',
      'admin.users.form.roleLabel': 'Role',
      'admin.users.form.regionLabel': 'Region',
      'admin.users.form.phoneLabel': 'Phone',
      'admin.users.form.phonePlaceholder': 'Phone',
      'admin.users.form.languageLabel': 'Language',
      'admin.users.roles.customerDesc': 'Customer',
      'admin.users.roles.staffDesc': 'Staff',
      'admin.users.roles.adminDesc': 'Admin',
      'admin.users.roles.customerPermission': 'Customer permissions',
      'admin.users.roles.staffPermission': 'Staff permissions',
      'admin.users.roles.adminPermission': 'Admin permissions',
      'admin.users.roles.staffRegionHint': 'Staff can only access tickets from their assigned region',
      'admin.users.serviceGroup.title': 'Service Group',
      'admin.users.serviceGroup.placeholder': 'Select a service group',
      'admin.users.serviceGroup.regionHint': 'Customer region is controlled by the assigned service group.',
      'toast.admin.users.createSuccess': 'Create success',
      'toast.admin.users.createError': 'Create error',
      'toast.admin.users.loadError': 'Load error',
      'toast.admin.users.validationError': 'Validation error',
      'common.localeNames.zh-CN': 'Chinese',
      'common.localeNames.en': 'English',
      'common.localeNames.fr': 'French',
      'common.localeNames.es': 'Spanish',
      'common.localeNames.ru': 'Russian',
      'common.localeNames.pt': 'Portuguese',
      'common.regions.asia-pacific': 'Asia-Pacific',
    }

    return (key: string) => translations[namespace ? `${namespace}.${key}` : key] ?? key
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('@/components/ui/select', async () => {
  const ReactModule = await import('react')
  const SelectTrigger = ({ children }: { children: React.ReactNode }) => <>{children}</>
  const SelectContent = ({ children }: { children: React.ReactNode }) => <>{children}</>
  const SelectValue = ({ placeholder }: { placeholder?: string }) => <>{placeholder ?? null}</>
  const SelectItem = ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  )

  function flatten(children: React.ReactNode): Array<React.ReactElement<{ value?: string; children?: React.ReactNode }>> {
    const result: Array<React.ReactElement<{ value?: string; children?: React.ReactNode }>> = []
    ReactModule.Children.forEach(children, (child) => {
      if (!ReactModule.isValidElement(child)) return
      if (child.type === SelectItem) {
        result.push(child as React.ReactElement<{ value?: string; children?: React.ReactNode }>)
        return
      }
      result.push(...flatten(child.props.children))
    })
    return result
  }

  function findTriggerId(children: React.ReactNode): string | undefined {
    let id: string | undefined
    ReactModule.Children.forEach(children, (child) => {
      if (!ReactModule.isValidElement(child) || id) return
      if (child.type === SelectTrigger && typeof child.props.id === 'string') {
        id = child.props.id
        return
      }
      id = findTriggerId(child.props.children)
    })
    return id
  }

  return {
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value?: string
      onValueChange?: (value: string) => void
      children: React.ReactNode
    }) => (
      <select id={findTriggerId(children)} value={value} onChange={(event) => onValueChange?.(event.target.value)}>
        {flatten(children).map((item) => (
          <option key={item.props.value} value={item.props.value}>
            {item.props.children}
          </option>
        ))}
      </select>
    ),
    SelectTrigger,
    SelectContent,
    SelectValue,
    SelectItem,
  }
})

import CreateUserPage from '@/app/admin/users/create/page'

describe('admin user create page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('submits customer creation with serviceGroupId instead of region', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            serviceGroups: [
              { id: 7, name: 'APAC Premium', baseRegion: 'ASIA_PACIFIC', isActive: true },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      })

    vi.stubGlobal('fetch', fetchMock as any)

    render(<CreateUserPage />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/service-groups')
    })

    fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'new@test.com' } })
    fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Full Name *'), { target: { value: 'New User' } })
    fireEvent.change(screen.getByLabelText('Service Group'), { target: { value: '7' } })

    fireEvent.submit(screen.getByRole('button', { name: 'Create User' }).closest('form')!)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    const [, postOptions] = fetchMock.mock.calls[1]
    expect(postOptions.method).toBe('POST')
    expect(JSON.parse(postOptions.body)).toEqual(
      expect.objectContaining({
        email: 'new@test.com',
        password: 'password123',
        full_name: 'New User',
        role: 'customer',
        serviceGroupId: 7,
      })
    )
    expect(JSON.parse(postOptions.body)).not.toHaveProperty('region')
    expect(pushMock).toHaveBeenCalledWith('/admin/users')
  })
})
