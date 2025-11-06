/**
 * Admin FAQ Management API
 * 
 * GET /api/admin/faq - Get all FAQ items with pagination
 * POST /api/admin/faq - Create new FAQ item with translations
 */

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { z } from 'zod'

const CreateFAQSchema = z.object({
  category_id: z.string().uuid(),
  view_count: z.number().default(0),
  is_published: z.boolean().default(true),
  translations: z.array(
    z.object({
      locale: z.string(),
      title: z.string().min(1),
      content: z.string().min(1),
    })
  ).min(1),
  keywords: z.array(
    z.object({
      locale: z.string(),
      keyword: z.string(),
    })
  ).optional(),
})

export async function GET(request: NextRequest) {
  try {
    await requireRole(['admin', 'staff'])
    const supabase = await createClient()

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const category_id = searchParams.get('category_id') || ''

    // Build query
    let query = supabase
      .from('faq_items')
      .select(`
        *,
        faq_categories(id, name, parent_id),
        faq_translations(locale, title, content)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

    // Apply category filter
    if (category_id) {
      query = query.eq('category_id', category_id)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: items, error, count } = await query

    if (error) {
      throw error
    }

    return successResponse({
      items: items || [],
      pagination: {
        limit,
        offset,
        total: count || 0,
      },
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to fetch FAQ items', error.message)
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin'])
    const supabase = await createClient()

    // Parse and validate request body
    const body = await request.json()
    const validation = CreateFAQSchema.safeParse(body)

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    const { translations, keywords, ...faqData } = validation.data

    // Create FAQ item
    const { data: faqItem, error: faqError } = await supabase
      .from('faq_items')
      .insert(faqData)
      .select()
      .single()

    if (faqError) {
      throw faqError
    }

    // Create translations
    const translationsData = translations.map((t) => ({
      faq_item_id: faqItem.id,
      locale: t.locale,
      title: t.title,
      content: t.content,
    }))

    const { error: translationsError } = await supabase
      .from('faq_translations')
      .insert(translationsData)

    if (translationsError) {
      // Rollback: delete FAQ item
      await supabase.from('faq_items').delete().eq('id', faqItem.id)
      throw translationsError
    }

    // Create keywords if provided
    if (keywords && keywords.length > 0) {
      const keywordsData = keywords.map((k) => ({
        faq_item_id: faqItem.id,
        locale: k.locale,
        keyword: k.keyword,
      }))

      await supabase.from('keywords').insert(keywordsData)
    }

    return successResponse(faqItem, 201)
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to create FAQ item', error.message)
  }
}

