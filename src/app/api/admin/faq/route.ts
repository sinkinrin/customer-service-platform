/**
 * Admin FAQ Management API
 *
 * GET /api/admin/faq - Get all FAQ items with pagination (including drafts)
 * POST /api/admin/faq - Create new FAQ item with translations
 */

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    await requireRole(['admin', 'staff'])

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '1000')
    const language = searchParams.get('language') || 'zh-CN'
    // Support both camelCase (categoryId) and snake_case (category_id) for backwards compatibility
    const categoryId = searchParams.get('categoryId') || searchParams.get('category_id')

    // Build where clause - NO isActive filter for admin (show all articles)
    const where: any = {}

    // Filter by category if provided
    if (categoryId) {
      where.categoryId = parseInt(categoryId)
    }

    // Get articles with translations
    const articles = await prisma.faqArticle.findMany({
      where,
      include: {
        category: true,
        translations: {
          where: {
            locale: language,
          },
        },
        ratings: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: limit,
    })

    // Format response
    const items = articles.map((article: typeof articles[number]) => {
      const translation = article.translations[0]
      return {
        id: article.id,
        category_id: article.categoryId,
        slug: article.slug,
        title: translation?.title || 'Untitled',
        content: translation?.content || '',
        is_active: article.isActive,
        views: article.views,
        helpful: article.ratings.filter((r: { isHelpful: boolean }) => r.isHelpful).length,
        not_helpful: article.ratings.filter((r: { isHelpful: boolean }) => !r.isHelpful).length,
        created_at: article.createdAt.toISOString(),
        updated_at: article.updatedAt.toISOString(),
      }
    })

    return successResponse({
      items,
      total: items.length,
    })
  } catch (error: any) {
    console.error('GET /api/admin/faq error:', error)
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to fetch FAQ items', error.message)
  }
}

