/**
 * Admin FAQ Categories Management API
 *
 * POST /api/admin/faq/categories - Create new category
 * PUT /api/admin/faq/categories - Update category
 * DELETE /api/admin/faq/categories - Delete category
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/utils/auth'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { faqCache, categoriesCache } from '@/lib/cache/simple-cache'

// ============================================================================
// POST /api/admin/faq/categories - Create category
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    // Check if user is admin
    if (user.role !== 'admin') {
      return unauthorizedResponse('Admin access required')
    }

    const body = await request.json()
    const { name, description, icon, slug } = body

    if (!name || !description || !icon || !slug) {
      return errorResponse('MISSING_FIELDS', 'Missing required fields', undefined, 400)
    }

    // Check if slug already exists
    const existing = await prisma.faqCategory.findUnique({
      where: { slug },
    })

    if (existing) {
      return errorResponse('SLUG_EXISTS', 'Category with this slug already exists', undefined, 400)
    }

    // Create category
    const category = await prisma.faqCategory.create({
      data: {
        name,
        description,
        icon,
        slug,
        sortOrder: 0,
        isActive: true,
      },
    })

    // FIX: Clear FAQ and categories cache after category creation
    faqCache.clear()
    categoriesCache.clear()
    console.log('[Cache] Cleared FAQ and categories cache after category creation')

    return successResponse(
      {
        message: 'Category created successfully',
        category,
      },
      201
    )
  } catch (error: any) {
    console.error('POST /api/admin/faq/categories error:', error)
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

// ============================================================================
// PUT /api/admin/faq/categories - Update category
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth()

    if (user.role !== 'admin') {
      return unauthorizedResponse('Admin access required')
    }

    const body = await request.json()
    const { id, name, description, icon, slug, is_active } = body

    if (!id) {
      return errorResponse('MISSING_ID', 'Category ID is required', undefined, 400)
    }

    // Check if category exists
    const existing = await prisma.faqCategory.findUnique({
      where: { id: parseInt(id) },
    })

    if (!existing) {
      return errorResponse('NOT_FOUND', 'Category not found', undefined, 404)
    }

    // Update category
    const category = await prisma.faqCategory.update({
      where: { id: parseInt(id) },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(icon && { icon }),
        ...(slug && { slug }),
        ...(typeof is_active === 'boolean' && { isActive: is_active }),
      },
    })

    // FIX: Clear FAQ and categories cache after category update
    faqCache.clear()
    categoriesCache.clear()
    console.log('[Cache] Cleared FAQ and categories cache after category update')

    return successResponse({
      message: 'Category updated successfully',
      category,
    })
  } catch (error: any) {
    console.error('PUT /api/admin/faq/categories error:', error)
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

// ============================================================================
// DELETE /api/admin/faq/categories - Delete category
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth()

    if (user.role !== 'admin') {
      return unauthorizedResponse('Admin access required')
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return errorResponse('MISSING_ID', 'Category ID is required', undefined, 400)
    }

    // Check if category exists
    const existing = await prisma.faqCategory.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: { articles: true },
        },
      },
    })

    if (!existing) {
      return errorResponse('NOT_FOUND', 'Category not found', undefined, 404)
    }

    // Check if category has articles
    if (existing._count.articles > 0) {
      return errorResponse(
        'HAS_ARTICLES',
        'Cannot delete category with articles. Please delete or move articles first.',
        undefined,
        400
      )
    }

    // Delete category
    await prisma.faqCategory.delete({
      where: { id: parseInt(id) },
    })

    // FIX: Clear FAQ and categories cache after category deletion
    faqCache.clear()
    categoriesCache.clear()
    console.log('[Cache] Cleared FAQ and categories cache after category deletion')

    return successResponse({
      message: 'Category deleted successfully',
    })
  } catch (error: any) {
    console.error('DELETE /api/admin/faq/categories error:', error)
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

