import { describe, expect, it, vi } from 'vitest'

const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}))

describe('Staff conversations entry page', () => {
  it('redirects to the staff draft conversation route', async () => {
    const { default: StaffConversationsPage } = await import('@/app/staff/conversations/page')

    StaffConversationsPage()

    expect(mockRedirect).toHaveBeenCalledWith('/staff/conversations/new')
  })
})
