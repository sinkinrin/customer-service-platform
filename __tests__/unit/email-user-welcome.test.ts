import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateSecurePassword,
  hasPasswordBeenSet,
  hasWelcomeEmailSent,
  buildNoteWithPasswordMarker,
  buildNoteWithWelcomeMarker,
  handleEmailUserWelcomeFromWebhookPayload,
} from '@/lib/ticket/email-user-welcome'
import {
  getEmailUserWelcomeState,
  isFirstTimeEmailUserByState,
} from '@/lib/ticket/email-user-welcome-state'

const {
  mockGetUser,
  mockUpdateUser,
  mockCreateArticle,
  mockGetArticlesByTicket,
  mockSearchTicketsRawQuery,
  mockEnv,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockCreateArticle: vi.fn(),
  mockGetArticlesByTicket: vi.fn(),
  mockSearchTicketsRawQuery: vi.fn(),
  mockEnv: {
    EMAIL_USER_AUTO_PASSWORD_ENABLED: true,
    EMAIL_USER_WELCOME_EMAIL_ENABLED: true,
    WEB_PLATFORM_URL: 'https://support.example.com',
  },
}))

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    getUser: mockGetUser,
    updateUser: mockUpdateUser,
    createArticle: mockCreateArticle,
    getArticlesByTicket: mockGetArticlesByTicket,
    searchTicketsRawQuery: mockSearchTicketsRawQuery,
  },
}))

vi.mock('@/lib/env', () => ({
  env: mockEnv,
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockGetArticlesByTicket.mockResolvedValue([])
  mockSearchTicketsRawQuery.mockResolvedValue({ tickets: [], tickets_count: 0 })
  mockEnv.EMAIL_USER_AUTO_PASSWORD_ENABLED = true
  mockEnv.EMAIL_USER_WELCOME_EMAIL_ENABLED = true
  mockEnv.WEB_PLATFORM_URL = 'https://support.example.com'
})

describe('generateSecurePassword', () => {
  it('generates password of specified length', () => {
    const password = generateSecurePassword(12)
    expect(password).toHaveLength(12)
  })

  it('generates password with default length of 12', () => {
    const password = generateSecurePassword()
    expect(password).toHaveLength(12)
  })

  it('contains only allowed characters (no confusing chars)', () => {
    const password = generateSecurePassword(100)
    const confusingChars = ['0', 'O', '1', 'l', 'I']

    for (const char of confusingChars) {
      expect(password).not.toContain(char)
    }
  })

  it('contains at least one uppercase, one lowercase, and one digit', () => {
    for (let i = 0; i < 10; i++) {
      const password = generateSecurePassword(12)
      expect(password).toMatch(/[A-Z]/)
      expect(password).toMatch(/[a-z]/)
      expect(password).toMatch(/[0-9]/)
    }
  })

  it('generates unique passwords each time', () => {
    const passwords = new Set<string>()
    for (let i = 0; i < 100; i++) {
      passwords.add(generateSecurePassword(12))
    }
    expect(passwords.size).toBe(100)
  })
})

describe('email welcome state', () => {
  it('treats empty note as a new email user state', () => {
    expect(getEmailUserWelcomeState(null)).toBe('new_email_user')
    expect(getEmailUserWelcomeState(undefined)).toBe('new_email_user')
    expect(getEmailUserWelcomeState('')).toBe('new_email_user')
    expect(isFirstTimeEmailUserByState(null)).toBe(true)
  })

  it('does not let region or unrelated note content block the first-time flow', () => {
    expect(getEmailUserWelcomeState('Region: asia-pacific')).toBe('new_email_user')
    expect(getEmailUserWelcomeState('Some prefix\nRegion: middle-east')).toBe('new_email_user')
    expect(isFirstTimeEmailUserByState('Region: asia-pacific')).toBe(true)
  })

  it('tracks explicit welcome progress from markers', () => {
    expect(getEmailUserWelcomeState('WelcomePasswordSet: 2024-01-01T00:00:00Z')).toBe('password_set')
    expect(getEmailUserWelcomeState('WelcomeEmailSent: 2024-01-01T00:00:00Z')).toBe('completed')
  })

  it('treats unrelated or invalid region note content as first-time state until welcome markers exist', () => {
    expect(getEmailUserWelcomeState('Some other note')).toBe('new_email_user')
    expect(getEmailUserWelcomeState('Region: invalid-region')).toBe('new_email_user')
  })
})

describe('hasPasswordBeenSet', () => {
  it('returns false for empty or null note', () => {
    expect(hasPasswordBeenSet(null)).toBe(false)
    expect(hasPasswordBeenSet(undefined)).toBe(false)
    expect(hasPasswordBeenSet('')).toBe(false)
  })

  it('returns false when marker is not present', () => {
    expect(hasPasswordBeenSet('Region: asia-pacific')).toBe(false)
    expect(hasPasswordBeenSet('Some other note')).toBe(false)
  })

  it('returns true when marker is present', () => {
    expect(hasPasswordBeenSet('WelcomePasswordSet: 2024-01-01T00:00:00Z')).toBe(true)
    expect(hasPasswordBeenSet('Region: asia-pacific\nWelcomePasswordSet: 2024-01-01T00:00:00Z')).toBe(true)
  })
})

describe('hasWelcomeEmailSent', () => {
  it('returns false for empty or null note', () => {
    expect(hasWelcomeEmailSent(null)).toBe(false)
    expect(hasWelcomeEmailSent(undefined)).toBe(false)
    expect(hasWelcomeEmailSent('')).toBe(false)
  })

  it('returns false when marker is not present', () => {
    expect(hasWelcomeEmailSent('Region: asia-pacific')).toBe(false)
    expect(hasWelcomeEmailSent('WelcomePasswordSet: 2024-01-01T00:00:00Z')).toBe(false)
  })

  it('returns true when marker is present', () => {
    expect(hasWelcomeEmailSent('WelcomeEmailSent: 2024-01-01T00:00:00Z')).toBe(true)
    expect(hasWelcomeEmailSent('WelcomePasswordSet: 2024-01-01T00:00:00Z\nWelcomeEmailSent: 2024-01-01T00:00:00Z')).toBe(true)
  })
})

describe('buildNoteWithPasswordMarker', () => {
  it('creates marker for empty note', () => {
    const result = buildNoteWithPasswordMarker('')
    expect(result).toMatch(/^WelcomePasswordSet: \d{4}-\d{2}-\d{2}T/)
  })

  it('appends marker to existing note', () => {
    const result = buildNoteWithPasswordMarker('Region: asia-pacific')
    expect(result).toContain('Region: asia-pacific')
    expect(result).toContain('\nWelcomePasswordSet:')
  })
})

describe('buildNoteWithWelcomeMarker', () => {
  it('creates marker for empty note', () => {
    const result = buildNoteWithWelcomeMarker('')
    expect(result).toMatch(/^WelcomeEmailSent: \d{4}-\d{2}-\d{2}T/)
  })

  it('appends marker to existing note', () => {
    const result = buildNoteWithWelcomeMarker('WelcomePasswordSet: 2024-01-01T00:00:00Z')
    expect(result).toContain('WelcomePasswordSet: 2024-01-01T00:00:00Z')
    expect(result).toContain('\nWelcomeEmailSent:')
  })
})

describe('handleEmailUserWelcomeFromWebhookPayload', () => {
  it('skips when article.type is not email', async () => {
    await handleEmailUserWelcomeFromWebhookPayload({
      ticket: { id: 100, customer_id: 1, number: '100', title: 'Test' },
      article: { id: 1, type: 'web' },
    } as any)

    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it('skips when customer_id is missing', async () => {
    await handleEmailUserWelcomeFromWebhookPayload({
      ticket: { id: 100, number: '100', title: 'Test' },
      article: { id: 1, type: 'email' },
    } as any)

    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it('continues the welcome flow when note only contains legacy region data', async () => {
    mockGetUser.mockResolvedValue({
      id: 1,
      email: 'customer@example.com',
      note: 'Region: asia-pacific',
    })

    await handleEmailUserWelcomeFromWebhookPayload({
      ticket: { id: 100, customer_id: 1, number: '100', title: 'Test' },
      article: { id: 1, type: 'email' },
    } as any)

    expect(mockUpdateUser).toHaveBeenCalledWith(1, expect.objectContaining({
      password: expect.any(String),
    }))
    expect(mockUpdateUser).toHaveBeenCalledWith(1, expect.objectContaining({
      note: expect.stringContaining('WelcomePasswordSet:'),
    }))
    expect(mockCreateArticle).toHaveBeenCalledWith(expect.objectContaining({
      to: 'customer@example.com',
    }))
  })

  it('does not reinitialize password after welcome flow is already completed', async () => {
    mockGetUser.mockResolvedValue({
      id: 1,
      email: 'customer@example.com',
      note: 'WelcomePasswordSet: 2024-01-01T00:00:00Z\nWelcomeEmailSent: 2024-01-01T00:05:00Z',
    })

    await handleEmailUserWelcomeFromWebhookPayload({
      ticket: { id: 100, customer_id: 1, number: '100', title: 'Test' },
      article: { id: 1, type: 'email' },
    } as any)

    expect(mockUpdateUser).not.toHaveBeenCalledWith(1, expect.objectContaining({
      password: expect.any(String),
    }))
    expect(mockCreateArticle).not.toHaveBeenCalled()
  })

  it('sets password and sends welcome email for new email user state', async () => {
    mockGetUser.mockResolvedValue({
      id: 1,
      email: 'customer@example.com',
      firstname: 'John',
      lastname: 'Doe',
      note: '',
    })
    mockUpdateUser.mockResolvedValue({ id: 1 })
    mockCreateArticle.mockResolvedValue({ id: 10 })

    await handleEmailUserWelcomeFromWebhookPayload({
      ticket: { id: 100, customer_id: 1, number: '100', title: 'Test' },
      article: { id: 1, type: 'email' },
    } as any)

    expect(mockUpdateUser).toHaveBeenCalledWith(1, expect.objectContaining({
      password: expect.any(String),
    }))
    expect(mockUpdateUser).toHaveBeenCalledWith(1, expect.objectContaining({
      note: expect.stringContaining('WelcomePasswordSet:'),
    }))
    expect(mockCreateArticle).toHaveBeenCalledWith(expect.objectContaining({
      ticket_id: 100,
      type: 'email',
      content_type: 'text/html',
      internal: false,
      to: 'customer@example.com',
    }))
    expect(mockUpdateUser).toHaveBeenCalledWith(1, expect.objectContaining({
      note: expect.stringContaining('WelcomeEmailSent:'),
    }))
  })

  it('does not resend email after welcome flow is already completed', async () => {
    mockGetUser.mockResolvedValue({
      id: 1,
      email: 'customer@example.com',
      note: 'WelcomePasswordSet: 2024-01-01T00:00:00Z\nWelcomeEmailSent: 2024-01-01T00:05:00Z',
    })

    await handleEmailUserWelcomeFromWebhookPayload({
      ticket: { id: 100, customer_id: 1, number: '100', title: 'Test' },
      article: { id: 1, type: 'email' },
    } as any)

    expect(mockUpdateUser).not.toHaveBeenCalledWith(1, expect.objectContaining({
      password: expect.any(String),
    }))
    expect(mockCreateArticle).not.toHaveBeenCalled()
  })

  it('resets password and retries welcome email when previous email delivery failed', async () => {
    mockGetUser.mockResolvedValue({
      id: 1,
      email: 'customer@example.com',
      firstname: 'John',
      lastname: 'Doe',
      note: 'WelcomePasswordSet: 2024-01-01T00:00:00Z',
    })
    mockUpdateUser.mockResolvedValue({ id: 1 })
    mockCreateArticle.mockResolvedValue({ id: 10 })

    await handleEmailUserWelcomeFromWebhookPayload({
      ticket: { id: 100, customer_id: 1, number: '100', title: 'Test' },
      article: { id: 1, type: 'email' },
    } as any)

    expect(mockUpdateUser).toHaveBeenCalledWith(1, expect.objectContaining({
      password: expect.any(String),
    }))
    expect(mockCreateArticle).toHaveBeenCalledWith(expect.objectContaining({
      ticket_id: 100,
      to: 'customer@example.com',
    }))
    expect(mockUpdateUser).toHaveBeenCalledWith(1, expect.objectContaining({
      note: expect.stringContaining('WelcomeEmailSent:'),
    }))
  })

  it('does not reset password again when current ticket already contains the welcome email article', async () => {
    mockGetUser.mockResolvedValue({
      id: 1,
      email: 'customer@example.com',
      firstname: 'John',
      lastname: 'Doe',
      note: 'WelcomePasswordSet: 2024-01-01T00:00:00Z',
    })
    mockGetArticlesByTicket.mockResolvedValue([
      {
        id: 99,
        type: 'email',
        subject: 'Welcome! Your account has been created (Ticket #100)',
        to: 'customer@example.com',
      },
    ])
    mockUpdateUser.mockResolvedValue({ id: 1 })

    await handleEmailUserWelcomeFromWebhookPayload({
      ticket: { id: 100, customer_id: 1, number: '100', title: 'Test' },
      article: { id: 1, type: 'email' },
    } as any)

    expect(mockUpdateUser).not.toHaveBeenCalledWith(1, expect.objectContaining({
      password: expect.any(String),
    }))
    expect(mockCreateArticle).not.toHaveBeenCalled()
    expect(mockUpdateUser).toHaveBeenCalledWith(1, expect.objectContaining({
      note: expect.stringContaining('WelcomeEmailSent:'),
    }))
  })

  it('does not mark email sent if email fails', async () => {
    mockGetUser.mockResolvedValue({
      id: 1,
      email: 'customer@example.com',
      note: '',
    })
    mockUpdateUser.mockResolvedValue({ id: 1 })
    mockCreateArticle.mockRejectedValue(new Error('Email failed'))

    await handleEmailUserWelcomeFromWebhookPayload({
      ticket: { id: 100, customer_id: 1, number: '100', title: 'Test' },
      article: { id: 1, type: 'email' },
    } as any)

    expect(mockUpdateUser).toHaveBeenCalledWith(1, expect.objectContaining({
      password: expect.any(String),
    }))
    expect(mockUpdateUser).toHaveBeenCalledWith(1, expect.objectContaining({
      note: expect.stringContaining('WelcomePasswordSet:'),
    }))
    expect(mockUpdateUser).toHaveBeenCalledTimes(1)
  })

  it('does not send welcome email with a placeholder link when WEB_PLATFORM_URL is missing', async () => {
    mockEnv.WEB_PLATFORM_URL = undefined
    mockGetUser.mockResolvedValue({
      id: 1,
      email: 'customer@example.com',
      firstname: 'John',
      lastname: 'Doe',
      note: '',
    })
    mockUpdateUser.mockResolvedValue({ id: 1 })

    await handleEmailUserWelcomeFromWebhookPayload({
      ticket: { id: 100, customer_id: 1, number: '100', title: 'Test' },
      article: { id: 1, type: 'email' },
    } as any)

    expect(mockCreateArticle).not.toHaveBeenCalled()
    expect(mockUpdateUser).toHaveBeenCalledWith(1, expect.objectContaining({
      password: expect.any(String),
    }))
    expect(mockUpdateUser).toHaveBeenCalledWith(1, expect.objectContaining({
      note: expect.stringContaining('WelcomePasswordSet:'),
    }))
    expect(mockUpdateUser).toHaveBeenCalledTimes(1)
  })

  it('recovers missing welcome-email marker from a previous ticket article without resetting password', async () => {
    mockGetUser.mockResolvedValue({
      id: 1,
      email: 'customer@example.com',
      note: 'WelcomePasswordSet: 2024-01-01T00:00:00Z',
    })
    mockSearchTicketsRawQuery.mockResolvedValue({
      tickets: [{ id: 88 }, { id: 100 }],
      tickets_count: 2,
    })
    mockGetArticlesByTicket
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 501,
          type: 'email',
          subject: 'Welcome! Your account has been created (Ticket #88)',
          to: 'customer@example.com',
        },
      ])
    mockUpdateUser.mockResolvedValue({ id: 1 })

    await handleEmailUserWelcomeFromWebhookPayload({
      ticket: { id: 100, customer_id: 1, number: '100', title: 'Test' },
      article: { id: 1, type: 'email' },
    } as any)

    expect(mockUpdateUser).not.toHaveBeenCalledWith(1, expect.objectContaining({
      password: expect.any(String),
    }))
    expect(mockCreateArticle).not.toHaveBeenCalled()
    expect(mockUpdateUser).toHaveBeenCalledWith(1, expect.objectContaining({
      note: expect.stringContaining('WelcomeEmailSent:'),
    }))
  })

  it('recovers missing welcome markers from a previous ticket article without resetting password', async () => {
    mockGetUser.mockResolvedValue({
      id: 1,
      email: 'customer@example.com',
      note: '',
    })
    mockSearchTicketsRawQuery.mockResolvedValue({
      tickets: [{ id: 77 }],
      tickets_count: 1,
    })
    mockGetArticlesByTicket
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 502,
          type: 'email',
          subject: 'Welcome! Your account has been created (Ticket #77)',
          to: 'customer@example.com',
        },
      ])
    mockUpdateUser.mockResolvedValue({ id: 1 })

    await handleEmailUserWelcomeFromWebhookPayload({
      ticket: { id: 100, customer_id: 1, number: '100', title: 'Test' },
      article: { id: 1, type: 'email' },
    } as any)

    expect(mockCreateArticle).not.toHaveBeenCalled()
    expect(mockUpdateUser).not.toHaveBeenCalledWith(1, expect.objectContaining({
      password: expect.any(String),
    }))
    expect(mockUpdateUser).toHaveBeenCalledWith(1, expect.objectContaining({
      note: expect.stringContaining('WelcomePasswordSet:'),
    }))
    expect(mockUpdateUser).toHaveBeenCalledWith(1, expect.objectContaining({
      note: expect.stringContaining('WelcomeEmailSent:'),
    }))
  })

  it('handles password setting failure gracefully', async () => {
    mockGetUser.mockResolvedValue({
      id: 1,
      email: 'customer@example.com',
      note: '',
    })
    mockUpdateUser.mockRejectedValue(new Error('API error'))

    await expect(handleEmailUserWelcomeFromWebhookPayload({
      ticket: { id: 100, customer_id: 1, number: '100', title: 'Test' },
      article: { id: 1, type: 'email' },
    } as any)).resolves.not.toThrow()

    expect(mockCreateArticle).not.toHaveBeenCalled()
  })
})
