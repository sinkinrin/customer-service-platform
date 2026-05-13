import { describe, it, expect, vi } from 'vitest'
import ConversationsPage from '@/app/customer/conversations/page'

const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}))

describe('Conversations entry page', () => {
  it('redirects to the draft conversation on the server', () => {
    ConversationsPage()

    expect(mockRedirect).toHaveBeenCalledWith('/customer/conversations/new')
  })
})
