/**
 * Shared agent helper unit tests
 */

import { describe, it, expect } from 'vitest'
import { checkIsOnVacation, getAgentDisplayName, isAgentEligible } from '@/lib/ticket/agent-helpers'

describe('checkIsOnVacation', () => {
  it('returns false when not on vacation', () => {
    expect(checkIsOnVacation({ out_of_office: false })).toBe(false)
  })

  it('returns true when within vacation range', () => {
    const now = new Date()
    expect(checkIsOnVacation({
      out_of_office: true,
      out_of_office_start_at: new Date(now.getTime() - 86400000).toISOString(),
      out_of_office_end_at: new Date(now.getTime() + 86400000).toISOString(),
    })).toBe(true)
  })

  it('returns false when vacation is in the future', () => {
    const now = new Date()
    expect(checkIsOnVacation({
      out_of_office: true,
      out_of_office_start_at: new Date(now.getTime() + 86400000).toISOString(),
      out_of_office_end_at: new Date(now.getTime() + 172800000).toISOString(),
    })).toBe(false)
  })

  it('returns true for open-ended vacation (start only)', () => {
    const now = new Date()
    expect(checkIsOnVacation({
      out_of_office: true,
      out_of_office_start_at: new Date(now.getTime() - 86400000).toISOString(),
    })).toBe(true)
  })

  it('returns true for end-only vacation when before end date', () => {
    const now = new Date()
    expect(checkIsOnVacation({
      out_of_office: true,
      out_of_office_end_at: new Date(now.getTime() + 86400000).toISOString(),
    })).toBe(true)
  })
})

describe('getAgentDisplayName', () => {
  it('returns full name when both first and last name exist', () => {
    expect(getAgentDisplayName({ firstname: 'John', lastname: 'Doe', login: 'jdoe', email: 'j@test.com' })).toBe('John Doe')
  })

  it('falls back to login when name is empty', () => {
    expect(getAgentDisplayName({ firstname: '', lastname: '', login: 'jdoe', email: 'j@test.com' })).toBe('jdoe')
  })

  it('falls back to email when login is also empty', () => {
    expect(getAgentDisplayName({ firstname: '', lastname: '', login: '', email: 'j@test.com' })).toBe('j@test.com')
  })
})

const EXCLUDED_EMAILS = ['support@howentech.com', 'howensupport@howentech.com']

describe('isAgentEligible', () => {
  const baseAgent = {
    id: 1, email: 'agent@test.com', active: true,
    role_ids: [2], group_ids: { '4': ['full'] }, out_of_office: false,
    firstname: 'A', lastname: 'B', login: 'ab',
  }

  it('returns true for eligible agent', () => {
    expect(isAgentEligible(baseAgent as any, 4, EXCLUDED_EMAILS)).toBe(true)
  })

  it('excludes inactive agents', () => {
    expect(isAgentEligible({ ...baseAgent, active: false } as any, 4, EXCLUDED_EMAILS)).toBe(false)
  })

  it('excludes system accounts', () => {
    expect(isAgentEligible({ ...baseAgent, email: 'support@howentech.com' } as any, 4, EXCLUDED_EMAILS)).toBe(false)
  })

  it('excludes admin role', () => {
    expect(isAgentEligible({ ...baseAgent, role_ids: [1, 2] } as any, 4, EXCLUDED_EMAILS)).toBe(false)
  })

  it('excludes agents without group access', () => {
    expect(isAgentEligible(baseAgent as any, 99, EXCLUDED_EMAILS)).toBe(false)
  })

  it('excludes agents on vacation', () => {
    const now = new Date()
    expect(isAgentEligible({
      ...baseAgent,
      out_of_office: true,
      out_of_office_start_at: new Date(now.getTime() - 86400000).toISOString(),
      out_of_office_end_at: new Date(now.getTime() + 86400000).toISOString(),
    } as any, 4, EXCLUDED_EMAILS)).toBe(false)
  })
})
