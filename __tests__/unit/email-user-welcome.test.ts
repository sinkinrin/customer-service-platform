import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateSecurePassword,
  hasWelcomeEmailSent,
  buildNoteWithWelcomeMarker,
  handleEmailUserWelcomeFromWebhookPayload,
} from '@/lib/ticket/email-user-welcome'

const {
  mockGetUser,
  mockUpdateUser,
  mockCreateArticle,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockCreateArticle: vi.fn(),
}))

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    getUser: mockGetUser,
    updateUser: mockUpdateUser,
    createArticle: mockCreateArticle,
  },
}))

vi.mock('@/lib/env', () => ({
  env: {
    EMAIL_USER_AUTO_PASSWORD_ENABLED: true,
    EMAIL_USER_WELCOME_EMAIL_ENABLED: true,
    WEB_PLATFORM_URL: 'https://support.example.com',
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
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
    const password = generateSecurePassword(100) // Long password to increase coverage
    const confusingChars = ['0', 'O', '1', 'l', 'I']

    for (const char of confusingChars) {
      expect(password).not.toContain(char)
    }
  })

  it('contains at least one uppercase, one lowercase, and one digit', () => {
    // Run multiple times to ensure requirement is consistently met
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
    // All should be unique
    expect(passwords.size).toBe(100)
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
    expect(hasWelcomeEmailSent('Some other note')).toBe(false)
  })

  it('returns true when marker is present', () => {
    expect(hasWelcomeEmailSent('WelcomeEmailSent: 2024-01-01T00:00:00Z')).toBe(true)
    expect(hasWelcomeEmailSent('Region: asia-pacific\nWelcomeEmailSent: 2024-01-01T00:00:00Z')).toBe(true)
  })
})

describe('buildNoteWithWelcomeMarker', () => {
  it('creates marker for empty note', () => {
    const result = buildNoteWithWelcomeMarker('')
    expect(result).toMatch(/^WelcomeEmailSent: \d{4}-\d{2}-\d{2}T/)
  })

  it('appends marker to existing note', () => {
    const result = buildNoteWithWelcomeMarker('Region: asia-pacific')
    expect(result).toContain('Region: asia-pacific')
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

  it('skips when user already has welcome email marker', async () => {
    mockGetUser.mockResolvedValue({
      id: 1,
      email: 'customer@example.com',
      note: 'WelcomeEmailSent: 2024-01-01T00:00:00Z',
    })

    await handleEmailUserWelcomeFromWebhookPayload({
      ticket: { id: 100, customer_id: 1, number: '100', title: 'Test' },
      article: { id: 1, type: 'email' },
    } as any)

    expect(mockUpdateUser).not.toHaveBeenCalled()
    expect(mockCreateArticle).not.toHaveBeenCalled()
  })

  it('sets password and sends welcome email for new email user', async () => {
    mockGetUser.mockResolvedValue({
      id: 1,
      email: 'customer@example.com',
      firstname: 'John',
      lastname: 'Doe',
      note: 'Region: asia-pacific',
    })
    mockUpdateUser.mockResolvedValue({ id: 1 })
    mockCreateArticle.mockResolvedValue({ id: 10 })

    await handleEmailUserWelcomeFromWebhookPayload({
      ticket: { id: 100, customer_id: 1, number: '100', title: 'Test' },
      article: { id: 1, type: 'email' },
    } as any)

    // Should set password (first updateUser call)
    expect(mockUpdateUser).toHaveBeenCalledWith(1, expect.objectContaining({
      password: expect.any(String),
    }))

    // Should send welcome email
    expect(mockCreateArticle).toHaveBeenCalledWith(expect.objectContaining({
      ticket_id: 100,
      type: 'email',
      content_type: 'text/html',
      internal: false,
      to: 'customer@example.com',
    }))

    // Should mark welcome email as sent (second updateUser call)
    expect(mockUpdateUser).toHaveBeenCalledWith(1, expect.objectContaining({
      note: expect.stringContaining('WelcomeEmailSent:'),
    }))
  })

  it('does not mark as sent if email fails', async () => {
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

    // Should set password
    expect(mockUpdateUser).toHaveBeenCalledWith(1, expect.objectContaining({
      password: expect.any(String),
    }))

    // Should NOT mark as sent (only one updateUser call for password)
    expect(mockUpdateUser).toHaveBeenCalledTimes(1)
  })

  it('handles password setting failure gracefully', async () => {
    mockGetUser.mockResolvedValue({
      id: 1,
      email: 'customer@example.com',
      note: '',
    })
    mockUpdateUser.mockRejectedValue(new Error('API error'))

    // Should not throw
    await expect(handleEmailUserWelcomeFromWebhookPayload({
      ticket: { id: 100, customer_id: 1, number: '100', title: 'Test' },
      article: { id: 1, type: 'email' },
    } as any)).resolves.not.toThrow()

    // Should not try to send email
    expect(mockCreateArticle).not.toHaveBeenCalled()
  })
})
