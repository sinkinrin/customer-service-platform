/**
 * FAQ API
 *
 * GET /api/faq - Search FAQ items from database
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'

// ============================================================================
// GET /api/faq
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') || ''
    const language = searchParams.get('language') || 'zh-CN'
    const categoryId = searchParams.get('category_id')
    const limit = parseInt(searchParams.get('limit') || '10')

    // Validate limit (allow up to 1000 for admin pages)
    if (limit < 1 || limit > 1000) {
      return errorResponse('Limit must be between 1 and 1000', 400)
    }

    // Build where clause
    const where: any = {
      isActive: true,
    }

    // Filter by category if provided
    if (categoryId) {
      where.categoryId = parseInt(categoryId)
    }

    // Get articles from database
    const articles = await prisma.faqArticle.findMany({
      where,
      include: {
        translations: {
          where: {
            locale: language,
          },
        },
        _count: {
          select: {
            ratings: {
              where: {
                isHelpful: true,
              },
            },
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
      filteredArticles = articles.filter((article) => {
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

    // Get rating counts
    const articlesWithRatings = await Promise.all(
      filteredArticles.map(async (article) => {
        const helpfulCount = await prisma.faqRating.count({
          where: {
            articleId: article.id,
            isHelpful: true,
          },
        })

        const notHelpfulCount = await prisma.faqRating.count({
          where: {
            articleId: article.id,
            isHelpful: false,
          },
        })

        const translation = article.translations[0]

        return {
          id: article.id,
          title: translation?.title || '',
          content: translation?.content || '',
          category_id: article.categoryId,
          keywords: translation ? JSON.parse(translation.keywords) : [],
          views: article.views,
          helpful: helpfulCount,
          not_helpful: notHelpfulCount,
          created_at: article.createdAt.toISOString(),
          updated_at: article.updatedAt.toISOString(),
        }
      })
    )

    return successResponse({
      items: articlesWithRatings,
      total: articlesWithRatings.length,
      query,
      language,
      source: 'database',
    })
  } catch (error) {
    console.error('GET /api/faq error:', error)
    return serverErrorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
}

