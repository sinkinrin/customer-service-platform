/**
 * FAQ API
 *
 * @swagger
 * /api/faq:
 *   get:
 *     description: Search FAQ items from database
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Search keywords
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: integer
 *         description: Filter by category ID
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *           default: en
 *         description: Language code
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items to return
 *     responses:
 *       200:
 *         description: List of FAQ articles
 *
 * Performance optimizations:
 * - Simple in-memory cache (no Redis needed for low concurrency)
 * - Fixed N+1 query problem
 * - Optimized field selection
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { faqCache } from '@/lib/cache/simple-cache'
import { logger } from '@/lib/utils/logger'

// ============================================================================
// GET /api/faq
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') || ''
    const language = searchParams.get('language') || 'en'
    // Support both camelCase (categoryId) and snake_case (category_id) for backwards compatibility
    const categoryId = searchParams.get('categoryId') || searchParams.get('category_id')
    const limit = parseInt(searchParams.get('limit') || '10')
    // FIX: Add forceRefresh parameter to bypass cache (for admin edits verification)
    const forceRefresh = searchParams.get('forceRefresh') === 'true'

    // Validate limit (allow up to 1000 for admin pages)
    if (limit < 1 || limit > 1000) {
      return errorResponse('INVALID_LIMIT', 'Limit must be between 1 and 1000', undefined, 400)
    }

    // PERFORMANCE: Check cache first (for non-search queries and non-force-refresh)
    if (!query && !forceRefresh) {
      const cacheKey = `faq:list:${language}:${categoryId || 'all'}:${limit}`
      const cached = faqCache.get(cacheKey)
      if (cached) {
        return successResponse({
          ...cached,
          cached: true,
        })
      }
    }

    // Build where clause
    const where: any = {
      isActive: true,
      // Only return articles that have a translation for the requested language
      translations: {
        some: {
          locale: language,
        },
      },
    }

    // Filter by category if provided
    if (categoryId) {
      where.categoryId = parseInt(categoryId)
    }

    // PERFORMANCE: Get articles with optimized include (fixed N+1 problem)
    const articles = await prisma.faqArticle.findMany({
      where,
      select: {
        id: true,
        categoryId: true,
        views: true,
        createdAt: true,
        updatedAt: true,
        translations: {
          where: {
            locale: language,
          },
          select: {
            title: true,
            content: true,
            keywords: true,
          },
        },
        category: {
          select: {
            name: true,
          },
        },
        ratings: {
          select: {
            isHelpful: true,
          },
        },
      },
      orderBy: {
        views: 'desc',
      },
      take: limit,
    })

    // Filter by search query if provided
    let filteredArticles = articles
    if (query) {
      const lowerQuery = query.toLowerCase()
      filteredArticles = articles.filter((article: typeof articles[number]) => {
        const translation = article.translations[0]
        if (!translation) return false

        const titleMatch = translation.title.toLowerCase().includes(lowerQuery)
        const contentMatch = translation.content.toLowerCase().includes(lowerQuery)
        const keywordsMatch = JSON.parse(translation.keywords).some((kw: string) =>
          kw.toLowerCase().includes(lowerQuery)
        )

        return titleMatch || contentMatch || keywordsMatch
      })
    }

    // PERFORMANCE: Calculate ratings in-memory (no extra DB queries)
    const articlesWithRatings = filteredArticles.map((article: typeof articles[number]) => {
      const translation = article.translations[0]
      const helpfulCount = article.ratings.filter((r: { isHelpful: boolean }) => r.isHelpful).length
      const notHelpfulCount = article.ratings.filter((r: { isHelpful: boolean }) => !r.isHelpful).length

      return {
        id: article.id.toString(), // Frontend expects string ID
        question: translation?.title || '', // Frontend expects 'question' field
        answer: translation?.content || '', // Frontend expects 'answer' field
        category_id: article.categoryId.toString(), // Frontend expects string category_id
        category_name: article.category?.name || `Category ${article.categoryId}`, // Frontend expects category_name
        language: language, // Frontend expects language field
        keywords: translation ? JSON.parse(translation.keywords) : [],
        view_count: article.views, // Frontend expects 'view_count'
        helpful_count: helpfulCount, // Frontend expects 'helpful_count'
        not_helpful_count: notHelpfulCount, // Frontend expects 'not_helpful_count'
        created_at: article.createdAt.toISOString(),
        updated_at: article.updatedAt.toISOString(),
      }
    })

    const response = {
      items: articlesWithRatings,
      total: articlesWithRatings.length,
      query,
      language,
      source: 'database',
    }

    // PERFORMANCE: Cache non-search results for 10 minutes
    if (!query) {
      const cacheKey = `faq:list:${language}:${categoryId || 'all'}:${limit}`
      faqCache.set(cacheKey, response, 600)
    }

    return successResponse(response)
  } catch (error) {
    logger.error('FAQ', 'Failed to fetch FAQ articles', { data: { error: error instanceof Error ? error.message : error } })
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

