import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockUser {
  id: string
  email: string
  full_name: string
  phone: string
  language: string
  role: 'customer' | 'staff' | 'admin'
  zammad_id?: number
}

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

const mocks = vi.hoisted<{
  user: MockUser
  refreshSession: ReturnType<typeof vi.fn>
  success: ReturnType<typeof vi.fn>
  warning: ReturnType<typeof vi.fn>
  error: ReturnType<typeof vi.fn>
}>(() => ({
  user: {
    id: 'cust_001',
    email: 'customer@test.com',
    full_name: 'Submitted Name',
    phone: '+1234567890',
    language: 'fr',
    role: 'customer',
  },
  refreshSession: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => ({
    user: mocks.user,
    refreshSession: mocks.refreshSession,
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: mocks.success,
    warning: mocks.warning,
    error: mocks.error,
  },
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({
    children,
    value,
    disabled,
  }: {
    children: ReactNode
    value?: string
    disabled?: boolean
  }) => (
    <div
      data-testid="language-select"
      data-value={value}
      aria-disabled={disabled}
    >
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    disabled,
    id,
    onCheckedChange,
  }: {
    checked?: boolean
    disabled?: boolean
    id?: string
    onCheckedChange?: (checked: boolean) => void
  }) => (
    <input
      id={id}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
    />
  ),
}))

const defaultPreferences = {
  emailNotifications: true,
  desktopNotifications: false,
  ticketUpdates: true,
  conversationReplies: true,
  promotions: false,
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

function profileResponse(
  fullName: string,
  phone = '+1234567890',
  language = 'fr',
  email = 'customer@test.com'
): Response {
  return jsonResponse({
    success: true,
    data: {
      profile: {
        id: mocks.user.id,
        email,
        full_name: fullName,
        phone,
        language,
      },
    },
  })
}

function preferencesResponse(
  preferences: typeof defaultPreferences = defaultPreferences
): Response {
  return jsonResponse({
    success: true,
    data: { preferences },
  })
}

function installDefaultFetch(profilePutResponse?: Response) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)

    if (url === '/api/user/profile' && init?.method === 'PUT') {
      return profilePutResponse ?? jsonResponse({
        success: true,
        data: {
          outcome: 'partial',
          profile: {
            id: 'cust_001',
            email: 'customer@test.com',
            full_name: 'Committed Name',
            phone: '+44123456789',
            language: 'en',
          },
          locale: {
            status: 'not_applied',
            requested: 'fr',
            actual: 'en',
          },
        },
      }, 207)
    }

    if (url === '/api/user/profile') {
      return profileResponse('Submitted Name')
    }

    if (url === '/api/user/preferences') {
      return preferencesResponse()
    }

    throw new Error(`Unexpected fetch: ${url}`)
  }) as typeof fetch)
}

import CustomerSettingsPage from '@/app/customer/settings/page'

describe('customer settings page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = {
      id: 'cust_001',
      email: 'customer@test.com',
      full_name: 'Submitted Name',
      phone: '+1234567890',
      language: 'fr',
      role: 'customer',
    }
    mocks.refreshSession.mockResolvedValue(undefined)
    installDefaultFetch()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('warns and restores the actual locale after a partial profile update', async () => {
    render(<CustomerSettingsPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('fullNameLabel')).toHaveValue('Submitted Name')
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'saveChanges' })[0])
    expect(screen.getByLabelText('fullNameLabel')).toBeDisabled()

    await waitFor(() => {
      expect(mocks.warning).toHaveBeenCalledWith('personalInfoPartiallyUpdated')
    })

    expect(mocks.refreshSession).toHaveBeenCalledTimes(1)
    expect(mocks.success).not.toHaveBeenCalledWith('personalInfoUpdated')
    expect(screen.getByLabelText('fullNameLabel')).toHaveValue('Committed Name')
    expect(screen.getByLabelText('phoneLabel')).toHaveValue('+44123456789')
    expect(screen.getByTestId('language-select')).toHaveAttribute('data-value', 'en')

    for (const [, init] of vi.mocked(fetch).mock.calls) {
      expect(new Headers(init?.headers).get('X-CSP-Expected-User-Id')).toBe('cust_001')
    }
  })

  it('submits only dirty profile fields when the confirmed baseline is stale', async () => {
    let submittedBody: unknown
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/user/profile' && init?.method === 'PUT') {
        submittedBody = JSON.parse(String(init.body))
        return jsonResponse({
          success: true,
          data: {
            outcome: 'complete',
            profile: {
              full_name: 'Concurrent Server Name',
              email: 'customer@test.com',
              phone: '+1999999999',
              language: 'en',
            },
          },
        })
      }
      if (url === '/api/user/profile') return profileResponse('Submitted Name')
      if (url === '/api/user/preferences') return preferencesResponse()
      throw new Error(`Unexpected fetch: ${url}`)
    }) as typeof fetch)
    render(<CustomerSettingsPage />)

    const phone = await screen.findByLabelText('phoneLabel')
    await waitFor(() => expect(phone).not.toBeDisabled())
    fireEvent.change(phone, { target: { value: '+1999999999' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'saveChanges' })[0])

    await waitFor(() => {
      expect(mocks.success).toHaveBeenCalledWith('personalInfoUpdated')
    })
    expect(submittedBody).toEqual({ phone: '+1999999999' })
    expect(screen.getByLabelText('fullNameLabel')).toHaveValue('Concurrent Server Name')
    expect(screen.getByTestId('language-select')).toHaveAttribute('data-value', 'en')
  })

  it('submits only dirty notification fields and applies the complete server response', async () => {
    let submittedBody: unknown
    const savedPreferences = {
      emailNotifications: false,
      desktopNotifications: true,
      ticketUpdates: false,
      conversationReplies: false,
      promotions: true,
    }
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/user/preferences' && init?.method === 'PUT') {
        submittedBody = JSON.parse(String(init.body))
        return preferencesResponse(savedPreferences)
      }
      if (url === '/api/user/profile') return profileResponse('Submitted Name')
      if (url === '/api/user/preferences') return preferencesResponse()
      throw new Error(`Unexpected fetch: ${url}`)
    }) as typeof fetch)
    render(<CustomerSettingsPage />)

    const emailNotifications = await screen.findByLabelText('email.label')
    await waitFor(() => expect(emailNotifications).not.toBeDisabled())
    fireEvent.click(emailNotifications)
    fireEvent.click(screen.getAllByRole('button', { name: 'saveChanges' })[1])

    await waitFor(() => {
      expect(mocks.success).toHaveBeenCalledWith('notificationsUpdated')
    })
    expect(submittedBody).toEqual({ emailNotifications: false })
    expect(emailNotifications).not.toBeChecked()
    expect(screen.getByLabelText('desktop.label')).toBeChecked()
    expect(screen.getByLabelText('ticketUpdates.label')).not.toBeChecked()
    expect(screen.getByLabelText('conversationReplies.label')).not.toBeChecked()
    expect(screen.getByLabelText('promotions.label')).toBeChecked()
  })

  it('warns and refreshes without changing the form when the API detects an identity change', async () => {
    installDefaultFetch(jsonResponse({
      success: false,
      error: { code: 'IDENTITY_CHANGED', message: 'Identity changed' },
    }, 409))
    render(<CustomerSettingsPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('fullNameLabel')).toHaveValue('Submitted Name')
    })
    fireEvent.change(screen.getByLabelText('fullNameLabel'), {
      target: { value: 'Unsaved Local Edit' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'saveChanges' })[0])

    await waitFor(() => {
      expect(mocks.warning).toHaveBeenCalledWith('identityChanged')
      expect(mocks.refreshSession).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByLabelText('fullNameLabel')).toHaveValue('Unsaved Local Edit')
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it('keeps initial settings disabled after either GET reports an identity change', async () => {
    let identityChanged = true
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (identityChanged) {
        return jsonResponse({
          success: false,
          error: { code: 'IDENTITY_CHANGED', message: 'Identity changed' },
        }, 409)
      }
      if (url === '/api/user/profile') {
        return profileResponse('Replacement Identity')
      }
      if (url === '/api/user/preferences') {
        return preferencesResponse()
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock as typeof fetch)
    const view = render(<CustomerSettingsPage />)

    await waitFor(() => {
      expect(mocks.warning).toHaveBeenCalledWith('identityChanged')
      expect(mocks.refreshSession).toHaveBeenCalledTimes(1)
    })
    expect(mocks.warning).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(screen.getByLabelText('fullNameLabel')).toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'saveChanges' })[0]).toBeDisabled()
    expect(mocks.error).not.toHaveBeenCalled()

    view.rerender(<CustomerSettingsPage />)
    await act(async () => Promise.resolve())
    expect(mocks.warning).toHaveBeenCalledTimes(1)
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    identityChanged = false
    mocks.user = {
      id: 'cust_002',
      email: 'replacement@test.com',
      full_name: 'Replacement Session',
      phone: '+1666666666',
      language: 'en',
      role: 'customer',
      zammad_id: 404,
    }
    view.rerender(<CustomerSettingsPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('fullNameLabel')).toHaveValue('Replacement Identity')
      expect(screen.getByLabelText('fullNameLabel')).not.toBeDisabled()
    })
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('keeps initial settings disabled when either GET has an ordinary failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/user/profile') {
        return jsonResponse({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Profile unavailable' },
        }, 500)
      }
      if (url === '/api/user/preferences') return preferencesResponse()
      throw new Error(`Unexpected fetch: ${url}`)
    }) as typeof fetch)
    render(<CustomerSettingsPage />)

    await waitFor(() => {
      expect(mocks.error).toHaveBeenCalledWith('updateFailed')
    })
    expect(mocks.error).toHaveBeenCalledTimes(1)
    expect(mocks.warning).not.toHaveBeenCalled()
    expect(mocks.refreshSession).not.toHaveBeenCalled()
    expect(screen.getByLabelText('fullNameLabel')).toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'saveChanges' })[1]).toBeDisabled()
  })

  it('does not accept a non-2xx success payload as a successful mutation', async () => {
    installDefaultFetch(jsonResponse({
      success: true,
      data: {
        outcome: 'complete',
        profile: {
          full_name: 'Should Not Apply',
          email: 'customer@test.com',
          phone: '+1777777777',
          language: 'en',
        },
      },
    }, 400))
    render(<CustomerSettingsPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('fullNameLabel')).not.toBeDisabled()
    })
    fireEvent.change(screen.getByLabelText('fullNameLabel'), {
      target: { value: 'Local Edit' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'saveChanges' })[0])

    await waitFor(() => {
      expect(mocks.error).toHaveBeenCalledWith('updateFailed')
    })
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.warning).not.toHaveBeenCalled()
    expect(mocks.refreshSession).not.toHaveBeenCalled()
    expect(screen.getByLabelText('fullNameLabel')).toHaveValue('Local Edit')
  })

  it('treats a structured 5xx profile response as an unconfirmed outcome', async () => {
    let profileGetCount = 0
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/user/profile' && init?.method === 'PUT') {
        return jsonResponse({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Commit response lost' },
        }, 500)
      }
      if (url === '/api/user/profile') {
        profileGetCount += 1
        return profileGetCount === 1
          ? profileResponse('Submitted Name')
          : profileResponse('Reconciled Name', '+1888888888', 'en')
      }
      if (url === '/api/user/preferences') return preferencesResponse()
      throw new Error(`Unexpected fetch: ${url}`)
    }) as typeof fetch)
    render(<CustomerSettingsPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('fullNameLabel')).not.toBeDisabled()
    })
    fireEvent.change(screen.getByLabelText('fullNameLabel'), {
      target: { value: 'Possibly Committed' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'saveChanges' })[0])

    await waitFor(() => {
      expect(mocks.warning).toHaveBeenCalledWith('outcomeUnconfirmed')
      expect(screen.getByLabelText('fullNameLabel')).toHaveValue('Reconciled Name')
    })
    expect(mocks.error).not.toHaveBeenCalled()
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it('keeps a partial update successful when refreshing the session fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.refreshSession.mockRejectedValueOnce(new Error('session unavailable'))
    render(<CustomerSettingsPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('fullNameLabel')).toHaveValue('Submitted Name')
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'saveChanges' })[0])

    await waitFor(() => {
      expect(mocks.warning).toHaveBeenCalledWith('personalInfoPartiallyUpdated')
      expect(mocks.refreshSession).toHaveBeenCalledTimes(1)
    })

    expect(mocks.error).not.toHaveBeenCalled()
    expect(screen.getByLabelText('fullNameLabel')).toHaveValue('Committed Name')
    expect(screen.getByTestId('language-select')).toHaveAttribute('data-value', 'en')
  })

  it('keeps a complete update successful when refreshing the session fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.refreshSession.mockRejectedValueOnce(new Error('session unavailable'))
    installDefaultFetch(jsonResponse({
      success: true,
      data: {
        outcome: 'complete',
        profile: {
          full_name: 'Complete Name',
          email: 'customer@test.com',
          phone: '+15550001111',
          language: 'fr',
        },
      },
    }))
    render(<CustomerSettingsPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('fullNameLabel')).toHaveValue('Submitted Name')
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'saveChanges' })[0])

    await waitFor(() => {
      expect(mocks.success).toHaveBeenCalledWith('personalInfoUpdated')
      expect(mocks.refreshSession).toHaveBeenCalledTimes(1)
    })

    expect(mocks.error).not.toHaveBeenCalled()
    expect(screen.getByLabelText('fullNameLabel')).toHaveValue('Complete Name')
  })

  it('never shows the previous identity while late initial loads are pending', async () => {
    const aProfile = deferred<Response>()
    const aPreferences = deferred<Response>()
    const bProfile = deferred<Response>()
    const bPreferences = deferred<Response>()
    const fetchMock = vi.fn()
      .mockReturnValueOnce(aProfile.promise)
      .mockReturnValueOnce(aPreferences.promise)
      .mockReturnValueOnce(bProfile.promise)
      .mockReturnValueOnce(bPreferences.promise)
    vi.stubGlobal('fetch', fetchMock)

    const view = render(<CustomerSettingsPage />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(screen.getByLabelText('fullNameLabel')).toBeDisabled()

    mocks.user = {
      id: 'cust_001',
      email: 'new-customer@test.com',
      full_name: 'New Session Name',
      phone: '+2222222222',
      language: 'en',
      role: 'customer',
      zammad_id: 202,
    }
    view.rerender(<CustomerSettingsPage />)

    expect(screen.getByLabelText('fullNameLabel')).toHaveValue('New Session Name')
    expect(screen.getByLabelText('fullNameLabel')).not.toHaveValue('Submitted Name')
    expect(screen.getByLabelText('fullNameLabel')).toBeDisabled()
    expect(screen.getByLabelText('currentPasswordLabel')).toHaveValue('')
    expect(screen.getAllByRole('button', { name: 'saveChanges' })[0]).toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'saveChanges' })[1]).toBeDisabled()
    expect(screen.getByRole('button', { name: 'updatePassword' })).toBeDisabled()

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4))
    const aProfileSignal = fetchMock.mock.calls[0][1]?.signal as AbortSignal
    const aPreferencesSignal = fetchMock.mock.calls[1][1]?.signal as AbortSignal
    expect(aProfileSignal.aborted).toBe(true)
    expect(aPreferencesSignal.aborted).toBe(true)

    await act(async () => {
      bProfile.resolve(profileResponse('New API Name', '+3333333333', 'en', 'new-customer@test.com'))
      bPreferences.resolve(preferencesResponse({
        ...defaultPreferences,
        desktopNotifications: true,
      }))
      await Promise.all([bProfile.promise, bPreferences.promise])
    })

    await waitFor(() => {
      expect(screen.getByLabelText('fullNameLabel')).toHaveValue('New API Name')
      expect(screen.getByLabelText('fullNameLabel')).not.toBeDisabled()
    })

    await act(async () => {
      aProfile.resolve(profileResponse('Late Old API Name'))
      aPreferences.resolve(preferencesResponse({
        ...defaultPreferences,
        emailNotifications: false,
      }))
      await Promise.all([aProfile.promise, aPreferences.promise])
      await Promise.resolve()
    })

    expect(screen.getByLabelText('fullNameLabel')).toHaveValue('New API Name')
    expect(screen.getByLabelText('fullNameLabel')).not.toHaveValue('Late Old API Name')
  })

  it('ignores a completed save after the settings identity changes', async () => {
    const saveResponse = deferred<Response>()
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/user/profile' && init?.method === 'PUT') {
        return saveResponse.promise
      }
      if (url === '/api/user/profile') {
        return profileResponse(
          mocks.user.email === 'customer@test.com' ? 'Submitted Name' : 'New Identity Name',
          mocks.user.phone,
          mocks.user.language,
          mocks.user.email
        )
      }
      if (url === '/api/user/preferences') {
        return preferencesResponse()
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock as typeof fetch)
    const view = render(<CustomerSettingsPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('fullNameLabel')).toHaveValue('Submitted Name')
    })
    fireEvent.change(screen.getByLabelText('fullNameLabel'), {
      target: { value: 'Unconfirmed Old Save' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'saveChanges' })[0])
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true)
    })

    mocks.user = {
      id: 'cust_002',
      email: 'second@test.com',
      full_name: 'Second Session Name',
      phone: '+4444444444',
      language: 'en',
      role: 'customer',
      zammad_id: 303,
    }
    view.rerender(<CustomerSettingsPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('fullNameLabel')).toHaveValue('New Identity Name')
    })

    await act(async () => {
      saveResponse.resolve(jsonResponse({
        success: true,
        data: {
          outcome: 'complete',
          profile: {
            full_name: 'Late Old Save',
            email: 'customer@test.com',
            phone: '+1555555555',
            language: 'fr',
          },
        },
      }))
      await saveResponse.promise
      await Promise.resolve()
    })

    expect(screen.getByLabelText('fullNameLabel')).toHaveValue('New Identity Name')
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.warning).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it('reconciles the actual profile after a rejected PUT transport', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let profileGetCount = 0
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/user/profile' && init?.method === 'PUT') {
        throw new Error('connection reset')
      }
      if (url === '/api/user/profile') {
        profileGetCount += 1
        return profileGetCount === 1
          ? profileResponse('Submitted Name')
          : profileResponse('Actual Saved Name', '+1999999999', 'en')
      }
      if (url === '/api/user/preferences') return preferencesResponse()
      throw new Error(`Unexpected fetch: ${url}`)
    }) as typeof fetch)
    render(<CustomerSettingsPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('fullNameLabel')).toHaveValue('Submitted Name')
    })
    fireEvent.change(screen.getByLabelText('fullNameLabel'), {
      target: { value: 'Possibly Saved Name' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'saveChanges' })[0])

    await waitFor(() => {
      expect(mocks.warning).toHaveBeenCalledWith('outcomeUnconfirmed')
      expect(screen.getByLabelText('fullNameLabel')).toHaveValue('Actual Saved Name')
    })
    expect(mocks.error).not.toHaveBeenCalled()
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1)
  })

  it('reconciles preferences when the PUT response body cannot be parsed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let preferencesGetCount = 0
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/user/preferences' && init?.method === 'PUT') {
        return {
          ok: false,
          status: 502,
          json: async () => {
            throw new SyntaxError('Unexpected end of JSON input')
          },
        } as Response
      }
      if (url === '/api/user/profile') return profileResponse('Submitted Name')
      if (url === '/api/user/preferences') {
        preferencesGetCount += 1
        return preferencesResponse(preferencesGetCount === 1
          ? defaultPreferences
          : { ...defaultPreferences, emailNotifications: true })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }) as typeof fetch)
    render(<CustomerSettingsPage />)

    const emailNotifications = await screen.findByLabelText('email.label')
    await waitFor(() => expect(emailNotifications).not.toBeDisabled())
    fireEvent.click(emailNotifications)
    expect(emailNotifications).not.toBeChecked()
    fireEvent.click(screen.getAllByRole('button', { name: 'saveChanges' })[1])
    expect(emailNotifications).toBeDisabled()

    await waitFor(() => {
      expect(mocks.warning).toHaveBeenCalledWith('outcomeUnconfirmed')
      expect(emailNotifications).toBeChecked()
    })
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it('treats a wrapped preference rejection as definite and does not reconcile', async () => {
    let preferencesGetCount = 0
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/user/preferences' && init?.method === 'PUT') {
        return jsonResponse({
          success: false,
          error: {
            code: 'PREFERENCES_REJECTED',
            message: 'Zammad rejected the preference update',
          },
        }, 502)
      }
      if (url === '/api/user/profile') return profileResponse('Submitted Name')
      if (url === '/api/user/preferences') {
        preferencesGetCount += 1
        return preferencesResponse()
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }) as typeof fetch)
    render(<CustomerSettingsPage />)

    const emailNotifications = await screen.findByLabelText('email.label')
    await waitFor(() => expect(emailNotifications).not.toBeDisabled())
    fireEvent.click(emailNotifications)
    fireEvent.click(screen.getAllByRole('button', { name: 'saveChanges' })[1])

    await waitFor(() => {
      expect(mocks.error).toHaveBeenCalledWith('Zammad rejected the preference update')
    })
    expect(mocks.warning).not.toHaveBeenCalled()
    expect(mocks.success).not.toHaveBeenCalled()
    expect(emailNotifications).not.toBeChecked()
    expect(preferencesGetCount).toBe(1)
  })

  it('warns and clears password fields when the PUT response is unparseable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/user/password' && init?.method === 'PUT') {
        return {
          ok: false,
          status: 502,
          json: async () => {
            throw new SyntaxError('Unexpected end of JSON input')
          },
        } as Response
      }
      if (url === '/api/user/profile') return profileResponse('Submitted Name')
      if (url === '/api/user/preferences') return preferencesResponse()
      throw new Error(`Unexpected fetch: ${url}`)
    }) as typeof fetch)
    render(<CustomerSettingsPage />)

    const currentPassword = await screen.findByLabelText('currentPasswordLabel')
    const newPassword = screen.getByLabelText('newPasswordLabel')
    const confirmPassword = screen.getByLabelText('confirmPasswordLabel')
    await waitFor(() => expect(currentPassword).not.toBeDisabled())
    fireEvent.change(currentPassword, { target: { value: 'old-password' } })
    fireEvent.change(newPassword, { target: { value: 'new-password' } })
    fireEvent.change(confirmPassword, { target: { value: 'new-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'updatePassword' }))
    expect(currentPassword).toBeDisabled()

    await waitFor(() => {
      expect(mocks.warning).toHaveBeenCalledWith('passwordOutcomeUnconfirmed')
    })
    expect(mocks.error).not.toHaveBeenCalled()
    expect(currentPassword).toHaveValue('')
    expect(newPassword).toHaveValue('')
    expect(confirmPassword).toHaveValue('')
  })

  it.each([
    [
      'PASSWORD_REJECTED',
      'Zammad rejected the password update',
      422,
    ],
    [
      'CURRENT_PASSWORD_VERIFICATION_UNAVAILABLE',
      'The current password could not be verified because Zammad is unavailable',
      503,
    ],
    [
      'PASSWORD_UPDATE_AUTHORIZATION_FAILED',
      'Zammad did not authorize the password update',
      502,
    ],
    [
      'PASSWORD_UPDATE_REJECTED',
      'Zammad rejected the password update request',
      502,
    ],
  ])('preserves password fields for a parsed definite %s response', async (code, message, status) => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/user/password' && init?.method === 'PUT') {
        return jsonResponse({
          success: false,
          error: {
            code,
            message,
          },
        }, status)
      }
      if (url === '/api/user/profile') return profileResponse('Submitted Name')
      if (url === '/api/user/preferences') return preferencesResponse()
      throw new Error(`Unexpected fetch: ${url}`)
    }) as typeof fetch)
    render(<CustomerSettingsPage />)

    const currentPassword = await screen.findByLabelText('currentPasswordLabel')
    const newPassword = screen.getByLabelText('newPasswordLabel')
    const confirmPassword = screen.getByLabelText('confirmPasswordLabel')
    await waitFor(() => expect(currentPassword).not.toBeDisabled())
    fireEvent.change(currentPassword, { target: { value: 'old-password' } })
    fireEvent.change(newPassword, { target: { value: 'new-password' } })
    fireEvent.change(confirmPassword, { target: { value: 'new-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'updatePassword' }))

    await waitFor(() => {
      expect(mocks.error).toHaveBeenCalledWith(message)
    })
    expect(mocks.warning).not.toHaveBeenCalled()
    expect(currentPassword).toHaveValue('old-password')
    expect(newPassword).toHaveValue('new-password')
    expect(confirmPassword).toHaveValue('new-password')
  })

  it('uses the password-specific warning for parsed 503 OUTCOME_UNCONFIRMED', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/user/password' && init?.method === 'PUT') {
        return jsonResponse({
          success: false,
          error: {
            code: 'OUTCOME_UNCONFIRMED',
            message: 'Password outcome unconfirmed',
          },
        }, 503)
      }
      if (url === '/api/user/profile') return profileResponse('Submitted Name')
      if (url === '/api/user/preferences') return preferencesResponse()
      throw new Error(`Unexpected fetch: ${url}`)
    }) as typeof fetch)
    render(<CustomerSettingsPage />)

    const currentPassword = await screen.findByLabelText('currentPasswordLabel')
    const newPassword = screen.getByLabelText('newPasswordLabel')
    const confirmPassword = screen.getByLabelText('confirmPasswordLabel')
    await waitFor(() => expect(currentPassword).not.toBeDisabled())
    fireEvent.change(currentPassword, { target: { value: 'old-password' } })
    fireEvent.change(newPassword, { target: { value: 'new-password' } })
    fireEvent.change(confirmPassword, { target: { value: 'new-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'updatePassword' }))

    await waitFor(() => {
      expect(mocks.warning).toHaveBeenCalledWith('passwordOutcomeUnconfirmed')
    })
    expect(mocks.error).not.toHaveBeenCalled()
    expect(currentPassword).toHaveValue('')
    expect(newPassword).toHaveValue('')
    expect(confirmPassword).toHaveValue('')
  })
})
