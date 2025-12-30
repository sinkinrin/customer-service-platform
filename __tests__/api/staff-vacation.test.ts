/**
 * Staff vacation API integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, PUT, DELETE } from '@/app/api/staff/vacation/route'

vi.mock('@/lib/utils/auth', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    getOutOfOffice: vi.fn(),
    setOutOfOffice: vi.fn(),
    cancelOutOfOffice: vi.fn(),
  },
}))

vi.mock('@/lib/mock-auth', () => ({
  mockUsers: {},
  mockPasswords: {},
}))

import { requireAuth } from '@/lib/utils/auth'
import { zammadClient } from '@/lib/zammad/client'
import { mockUsers } from '@/lib/mock-auth'

function createMockRequest(url: string, body?: any): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: body ? 'PUT' : 'GET',
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('Staff Vacation API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(mockUsers).forEach(key => delete (mockUsers as any)[key])
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('rejects non-staff users', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      id: 'cust_001',
      email: 'customer@test.com',
      role: 'customer',
    } as any)

    const request = createMockRequest('http://localhost:3000/api/staff/vacation')
    const response = await GET(request as any)

    expect(response.status).toBe(403)
  })

  it('returns error when user is not linked to Zammad', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      id: 'staff_001',
      email: 'staff@test.com',
      role: 'staff',
    } as any)

    const request = createMockRequest('http://localhost:3000/api/staff/vacation')
    const response = await GET(request as any)

    expect(response.status).toBe(500)
  })

  it('returns vacation status for staff', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      id: 'staff_001',
      email: 'staff@test.com',
      role: 'staff',
    } as any)

    ;(mockUsers as any)['staff@test.com'] = {
      id: 'staff_001',
      email: 'staff@test.com',
      role: 'staff',
      zammad_id: 42,
    }

    vi.mocked(zammadClient.getOutOfOffice).mockResolvedValue({
      out_of_office: true,
      out_of_office_start_at: '2025-01-01',
      out_of_office_end_at: '2025-01-10',
      out_of_office_replacement_id: null,
      replacement_user: null,
    } as any)

    const request = createMockRequest('http://localhost:3000/api/staff/vacation')
    const response = await GET(request as any)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.vacation.is_on_vacation).toBe(true)
  })

  it('sets vacation for staff', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      id: 'staff_001',
      email: 'staff@test.com',
      role: 'staff',
    } as any)

    ;(mockUsers as any)['staff@test.com'] = {
      id: 'staff_001',
      email: 'staff@test.com',
      role: 'staff',
      zammad_id: 42,
    }

    const request = createMockRequest('http://localhost:3000/api/staff/vacation', {
      start_date: '2025-01-01',
      end_date: '2025-01-10',
    })
    const response = await PUT(request as any)

    expect(response.status).toBe(200)
    expect(zammadClient.setOutOfOffice).toHaveBeenCalledWith(42, {
      out_of_office: true,
      out_of_office_start_at: '2025-01-01',
      out_of_office_end_at: '2025-01-10',
      out_of_office_replacement_id: null,
    })
  })

  it('cancels vacation for staff', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      id: 'staff_001',
      email: 'staff@test.com',
      role: 'staff',
    } as any)

    ;(mockUsers as any)['staff@test.com'] = {
      id: 'staff_001',
      email: 'staff@test.com',
      role: 'staff',
      zammad_id: 42,
    }

    const response = await DELETE()

    expect(response.status).toBe(200)
    expect(zammadClient.cancelOutOfOffice).toHaveBeenCalledWith(42)
  })
})
