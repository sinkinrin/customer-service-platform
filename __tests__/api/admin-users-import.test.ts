/**
 * Admin User Import API Integration Tests
 *
 * Tests for /api/admin/users/import:
 * 1. Authentication/authorization (admin only)
 * 2. CSV file validation
 * 3. Preview mode (parses but doesn't import)
 * 4. Import mode (creates users in Zammad)
 * 5. Error handling for invalid data
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/admin/users/import/route'

// Mock auth module
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

// Mock Zammad client
vi.mock('@/lib/zammad/client', () => ({
  zammadClient: {
    createUser: vi.fn(),
    deleteUser: vi.fn(),
  },
}))

// Mock mock-auth module
vi.mock('@/lib/mock-auth', () => ({
  mockUsers: {},
  mockPasswords: {},
}))

vi.mock('@/lib/service-groups/customer-assignment-service', () => ({
  assignCustomerToServiceGroup: vi.fn(),
}))

vi.mock('@/lib/service-groups/service-group-service', () => ({
  getServiceGroupByName: vi.fn(),
}))

// Mock logger
vi.mock('@/lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}))

import { auth } from '@/auth'
import { zammadClient } from '@/lib/zammad/client'
import { mockUsers } from '@/lib/mock-auth'
import { assignCustomerToServiceGroup } from '@/lib/service-groups/customer-assignment-service'
import { getServiceGroupByName } from '@/lib/service-groups/service-group-service'

// Test users
const mockCustomer = {
  id: 'cust_001',
  email: 'customer@test.com',
  role: 'customer' as const,
  full_name: 'Test Customer',
  region: 'asia-pacific',
}

const mockStaff = {
  id: 'staff_001',
  email: 'staff@test.com',
  role: 'staff' as const,
  full_name: 'Test Staff',
  region: 'asia-pacific',
}

const mockAdmin = {
  id: 'admin_001',
  email: 'admin@test.com',
  role: 'admin' as const,
  full_name: 'Test Admin',
  region: 'asia-pacific',
}

// Valid CSV content
const validCSV = `email,full_name,role,service_group,region,phone
user1@test.com,User One,customer,APAC Premium,,+1111111111
user2@test.com,User Two,staff,,europe-zone-1,+2222222222
user3@test.com,User Three,admin,,asia-pacific,+3333333333`

// CSV with missing required field
const csvMissingEmail = `full_name,role,service_group,region
User One,customer,APAC Premium,`

// CSV with invalid data
const csvInvalidData = `email,full_name,role,service_group,region
invalid-email,User One,customer,APAC Premium,
user2@test.com,,customer,APAC Premium,`

const csvMissingCustomerServiceGroup = `email,full_name,role,service_group,region
user1@test.com,User One,customer,,`

// Helper to create form data request
function createFormDataRequest(file: File | null, preview: boolean = false): NextRequest {
  const formData = new FormData()
  if (file) {
    formData.append('file', file)
  }
  formData.append('preview', preview ? 'true' : 'false')

  // Create a request with the form data
  return new NextRequest('http://localhost/api/admin/users/import', {
    method: 'POST',
    body: formData,
  })
}

// Helper to create a File object
function createCSVFile(content: string, filename: string = 'users.csv'): File {
  return new File([content], filename, { type: 'text/csv' })
}

describe('Admin User Import API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServiceGroupByName).mockResolvedValue({
      id: 7,
      name: 'APAC Premium',
      baseRegion: 'ASIA_PACIFIC',
      staffZammadId: 11,
      isActive: true,
    } as any)
    vi.mocked(assignCustomerToServiceGroup).mockResolvedValue({} as any)
    // Reset mockUsers
    Object.keys(mockUsers).forEach(key => delete mockUsers[key])
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Authorization', () => {
    it('returns 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null)

      const request = createFormDataRequest(createCSVFile(validCSV))
      const response = await POST(request)

      expect(response.status).toBe(401)
    })

    it('returns 401 for customer users', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockCustomer,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })

      const request = createFormDataRequest(createCSVFile(validCSV))
      const response = await POST(request)

      expect(response.status).toBe(401)
    })

    it('returns 401 for staff users', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockStaff,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })

      const request = createFormDataRequest(createCSVFile(validCSV))
      const response = await POST(request)

      expect(response.status).toBe(401)
    })
  })

  describe('File Validation', () => {
    it('returns error when no file is provided', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockAdmin,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })

      const request = createFormDataRequest(null)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns error for non-CSV files', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockAdmin,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })

      const txtFile = new File(['content'], 'users.txt', { type: 'text/plain' })
      const request = createFormDataRequest(txtFile)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.details).toContainEqual(
        expect.objectContaining({ message: expect.stringContaining('CSV') })
      )
    })
  })

  describe('Preview Mode', () => {
    it('parses CSV and returns preview without creating users', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockAdmin,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })

      const request = createFormDataRequest(createCSVFile(validCSV), true)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.preview).toBe(true)
      expect(data.data.users).toHaveLength(3)
      expect(data.data.users[0].email).toBe('user1@test.com')
      expect(data.data.users[0].service_group).toBe('APAC Premium')
      expect(data.data.users[0].password).toBe('********') // Password hidden
      expect(zammadClient.createUser).not.toHaveBeenCalled()
    })

    it('returns parse errors for invalid CSV', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockAdmin,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })

      const request = createFormDataRequest(createCSVFile(csvMissingEmail), true)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.errors).toContainEqual(
        expect.stringContaining('Missing required column: email')
      )
    })

    it('reports validation errors for invalid data rows', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockAdmin,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })

      const request = createFormDataRequest(createCSVFile(csvInvalidData), true)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.errors.length).toBeGreaterThan(0)
      // Invalid email and missing name should be reported
      expect(data.data.errors.some((e: string) => e.includes('Invalid email'))).toBe(true)
      expect(data.data.errors.some((e: string) => e.includes('Missing name'))).toBe(true)
    })

    it('requires service group for customer rows', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockAdmin,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })

      const request = createFormDataRequest(createCSVFile(csvMissingCustomerServiceGroup), true)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.errors.some((e: string) => e.includes('Missing service group'))).toBe(true)
    })
  })

  describe('Import Mode', () => {
    it('creates users in Zammad successfully', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockAdmin,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })

      // Mock Zammad createUser to return success
      vi.mocked(zammadClient.createUser)
        .mockResolvedValueOnce({ id: 101, email: 'user1@test.com' })
        .mockResolvedValueOnce({ id: 102, email: 'user2@test.com' })
        .mockResolvedValueOnce({ id: 103, email: 'user3@test.com' })

      const request = createFormDataRequest(createCSVFile(validCSV), false)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.preview).toBe(false)
      expect(data.data.summary.success).toBe(3)
      expect(data.data.summary.failed).toBe(0)
      expect(zammadClient.createUser).toHaveBeenCalledTimes(3)
      expect(assignCustomerToServiceGroup).toHaveBeenCalledWith(101, 7, 'import:user1@test.com')
    })

    it('handles duplicate users correctly', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockAdmin,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })

      // Pre-populate mockUsers with an existing user
      mockUsers['user1@test.com'] = {
        id: 'existing',
        email: 'user1@test.com',
        role: 'customer',
        full_name: 'Existing User',
      }

      vi.mocked(zammadClient.createUser)
        .mockResolvedValueOnce({ id: 102, email: 'user2@test.com' })
        .mockResolvedValueOnce({ id: 103, email: 'user3@test.com' })

      const request = createFormDataRequest(createCSVFile(validCSV), false)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.summary.success).toBe(2)
      expect(data.data.summary.failed).toBe(1)
      expect(data.data.results.find((r: any) => r.email === 'user1@test.com').error).toContain('already exists')
    })

    it('handles Zammad API errors gracefully', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockAdmin,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })

      // First user succeeds, second fails
      vi.mocked(zammadClient.createUser)
        .mockResolvedValueOnce({ id: 101, email: 'user1@test.com' })
        .mockRejectedValueOnce(new Error('Zammad connection failed'))
        .mockResolvedValueOnce({ id: 103, email: 'user3@test.com' })

      const request = createFormDataRequest(createCSVFile(validCSV), false)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.summary.success).toBe(2)
      expect(data.data.summary.failed).toBe(1)
      expect(data.data.results.find((r: any) => r.email === 'user2@test.com').error).toBe('Zammad connection failed')
    })

    it('deletes customer when service-group assignment fails during import', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockAdmin,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })

      vi.mocked(zammadClient.createUser)
        .mockResolvedValueOnce({ id: 101, email: 'user1@test.com' })
        .mockResolvedValueOnce({ id: 102, email: 'user2@test.com' })
        .mockResolvedValueOnce({ id: 103, email: 'user3@test.com' })
      vi.mocked(assignCustomerToServiceGroup).mockRejectedValueOnce(new Error('Assignment failed'))

      const request = createFormDataRequest(createCSVFile(validCSV), false)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.summary.success).toBe(2)
      expect(data.data.summary.failed).toBe(1)
      expect(zammadClient.deleteUser).toHaveBeenCalledWith(101)
      expect(data.data.results.find((r: any) => r.email === 'user1@test.com').error).toBe('Assignment failed')
    })

    it('assigns correct Zammad roles based on user role', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: mockAdmin,
        expires: new Date(Date.now() + 3600000).toISOString(),
      })

      vi.mocked(zammadClient.createUser)
        .mockResolvedValue({ id: 100, email: 'test@test.com' })

      const request = createFormDataRequest(createCSVFile(validCSV), false)
      await POST(request)

      // Check customer role
      expect(zammadClient.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'user1@test.com',
          roles: ['Customer'],
        })
      )

      // Check staff role
      expect(zammadClient.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'user2@test.com',
          roles: ['Agent'],
        })
      )

      // Check admin role
      expect(zammadClient.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'user3@test.com',
          roles: ['Admin', 'Agent'],
        })
      )
    })
  })
})
