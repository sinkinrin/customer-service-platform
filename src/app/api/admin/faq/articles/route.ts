/**
 * Admin FAQ Articles Management API
 *
 * POST /api/admin/faq/articles - Create new article
 * PUT /api/admin/faq/articles - Update article
 * DELETE /api/admin/faq/articles - Delete article
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
import { faqCache } from '@/lib/cache/simple-cache'

// ============================================================================
// POST /api/admin/faq/articles - Create article
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    if (user.role !== 'admin') {
      return unauthorizedResponse('Admin access required')
    }

    const body = await request.json()
    const { category_id, slug, translations } = body

    if (!category_id || !slug || !translations || !Array.isArray(translations)) {
      return errorResponse('MISSING_FIELDS', 'Missing required fields', undefined, 400)
    }

    // Check if category exists
    const category = await prisma.faqCategory.findUnique({
      where: { id: parseInt(category_id) },
    })

    if (!category) {
      return errorResponse('NOT_FOUND', 'Category not found', undefined, 404)
    }

    // Check if slug already exists
    const existing = await prisma.faqArticle.findUnique({
      where: { slug },
    })

    if (existing) {
      return errorResponse('SLUG_EXISTS', 'Article with this slug already exists', undefined, 400)
    }

    // Create article with translations
    const article = await prisma.faqArticle.create({
      data: {
        categoryId: parseInt(category_id),
        slug,
        views: 0,
        isActive: true,
        translations: {
          create: translations.map((t: any) => ({
            locale: t.locale,
            title: t.title,
            content: t.content,
            keywords: JSON.stringify(t.keywords || []),
          })),
        },
      },
      include: {
        translations: true,
      },
    })

    // FIX: Clear FAQ cache after article creation
    faqCache.clear()
    console.log('[Cache] Cleared FAQ cache after article creation')

    return successResponse(
      {
        message: 'Article created successfully',
        article,
      },
      201
    )
  } catch (error: any) {
    console.error('POST /api/admin/faq/articles error:', error)
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

// ============================================================================
// PUT /api/admin/faq/articles - Update article
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth()

    if (user.role !== 'admin') {
      return unauthorizedResponse('Admin access required')
    }

    const body = await request.json()
    const { id, category_id, slug, is_active, translations } = body

    if (!id) {
      return errorResponse('MISSING_ID', 'Article ID is required', undefined, 400)
    }

    // Check if article exists
    const existing = await prisma.faqArticle.findUnique({
      where: { id: parseInt(id) },
    })

    if (!existing) {
      return errorResponse('NOT_FOUND', 'Article not found', undefined, 404)
    }

    // Update article
    await prisma.faqArticle.update({
      where: { id: parseInt(id) },
      data: {
        ...(category_id && { categoryId: parseInt(category_id) }),
        ...(slug && { slug }),
        ...(typeof is_active === 'boolean' && { isActive: is_active }),
      },
    })

    // Update translations if provided
    if (translations && Array.isArray(translations)) {
      for (const t of translations) {
        await prisma.faqArticleTranslation.upsert({
          where: {
            articleId_locale: {
              articleId: parseInt(id),
              locale: t.locale,
            },
          },
          update: {
            title: t.title,
            content: t.content,
            keywords: JSON.stringify(t.keywords || []),
          },
          create: {
            articleId: parseInt(id),
            locale: t.locale,
            title: t.title,
            content: t.content,
            keywords: JSON.stringify(t.keywords || []),
          },
        })
      }
    }

    // Get updated article with translations
    const updatedArticle = await prisma.faqArticle.findUnique({
      where: { id: parseInt(id) },
      include: {
        translations: true,
      },
    })

    // FIX: Clear FAQ cache after article update
    faqCache.clear()
    console.log('[Cache] Cleared FAQ cache after article update')

    return successResponse({
      message: 'Article updated successfully',
      article: updatedArticle,
    })
  } catch (error: any) {
    console.error('PUT /api/admin/faq/articles error:', error)
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

// ============================================================================
// DELETE /api/admin/faq/articles - Delete article
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth()

    if (user.role !== 'admin') {
      return unauthorizedResponse('Admin access required')
    }

    const body = await request.json()
    const { id } = body

    if (!id) {
      return errorResponse('MISSING_ID', 'Article ID is required', undefined, 400)
    }

    // Check if article exists
    const existing = await prisma.faqArticle.findUnique({
      where: { id: parseInt(id) },
    })

    if (!existing) {
      return errorResponse('NOT_FOUND', 'Article not found', undefined, 404)
    }

    // Delete article (translations and ratings will be cascade deleted)
    await prisma.faqArticle.delete({
      where: { id: parseInt(id) },
    })

    // FIX: Clear FAQ cache after article deletion
    faqCache.clear()
    console.log('[Cache] Cleared FAQ cache after article deletion')

    return successResponse({
      message: 'Article deleted successfully',
    })
  } catch (error: any) {
    console.error('DELETE /api/admin/faq/articles error:', error)
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

