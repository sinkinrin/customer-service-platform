/**
 * FAQ Categories API
 *
 * GET /api/faq/categories - Get all FAQ categories from database
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { logger } from '@/lib/utils/logger'
import { categoriesCache } from '@/lib/cache/simple-cache'

// ============================================================================
// GET /api/faq/categories
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const language = searchParams.get('language') || 'en'
    const cacheKey = `faq:categories:${language}`
    const cached = categoriesCache.get(cacheKey)
    if (cached) {
      return successResponse({
        ...cached,
        cached: true,
      })
    }

    // Get categories from database
    const categories = await prisma.faqCategory.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
      include: {
        _count: {
          select: {
            articles: {
              where: {
                isActive: true,
              },
            },
          },
        },
      },
    })

    const response = {
      categories: categories.map((cat: typeof categories[number]) => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        icon: cat.icon,
        article_count: cat._count.articles,
      })),
      total: categories.length,
      language,
      source: 'database',
    }

    categoriesCache.set(cacheKey, response, 1800)
    return successResponse(response)
  } catch (error) {
    logger.error('FAQ', 'Failed to fetch FAQ categories', { data: { error: error instanceof Error ? error.message : error } })

    // Handle database connection errors
    if (error instanceof Error) {
      if (error.message.includes('SQLITE_CANTOPEN') || error.message.includes('database')) {
        return serverErrorResponse('Database connection failed. Please ensure the database is properly initialized.', error.message)
      }
    }

    return serverErrorResponse(error instanceof Error ? error.message : 'Failed to fetch FAQ categories')
  }
}

