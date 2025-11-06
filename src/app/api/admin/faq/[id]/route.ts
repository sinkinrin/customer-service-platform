/**
 * Admin FAQ Item Detail API
 * 
 * GET /api/admin/faq/[id] - Get FAQ item details
 * PUT /api/admin/faq/[id] - Update FAQ item
 * DELETE /api/admin/faq/[id] - Delete FAQ item
 */

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/utils/auth'
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { z } from 'zod'

const UpdateFAQSchema = z.object({
  category_id: z.string().uuid().optional(),
  is_published: z.boolean().optional(),
  translations: z.array(
    z.object({
      locale: z.string(),
      title: z.string().min(1),
      content: z.string().min(1),
    })
  ).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['admin', 'staff'])
    const supabase = await createClient()

    const { data: item, error } = await supabase
      .from('faq_items')
      .select(`
        *,
        faq_categories(id, name, parent_id),
        faq_translations(locale, title, content),
        keywords(locale, keyword)
      `)
      .eq('id', params.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return notFoundResponse('FAQ item not found')
      }
      throw error
    }

    return successResponse(item)
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to fetch FAQ item', error.message)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['admin'])
    const supabase = await createClient()

    // Parse and validate request body
    const body = await request.json()
    const validation = UpdateFAQSchema.safeParse(body)

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    const { translations, ...faqData } = validation.data

    // Update FAQ item
    if (Object.keys(faqData).length > 0) {
      const { error: updateError } = await supabase
        .from('faq_items')
        .update(faqData)
        .eq('id', params.id)

      if (updateError) {
        throw updateError
      }
    }

    // Update translations if provided
    if (translations && translations.length > 0) {
      // Delete existing translations
      await supabase.from('faq_translations').delete().eq('faq_item_id', params.id)

      // Insert new translations
      const translationsData = translations.map((t) => ({
        faq_item_id: params.id,
        locale: t.locale,
        title: t.title,
        content: t.content,
      }))

      const { error: translationsError } = await supabase
        .from('faq_translations')
        .insert(translationsData)

      if (translationsError) {
        throw translationsError
      }
    }

    // Fetch updated item
    const { data: updated, error: fetchError } = await supabase
      .from('faq_items')
      .select(`
        *,
        faq_categories(id, name, parent_id),
        faq_translations(locale, title, content)
      `)
      .eq('id', params.id)
      .single()

    if (fetchError) {
      throw fetchError
    }

    return successResponse(updated)
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to update FAQ item', error.message)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['admin'])
    const supabase = await createClient()

    // Delete FAQ item (cascades to translations and keywords)
    const { error } = await supabase
      .from('faq_items')
      .delete()
      .eq('id', params.id)

    if (error) {
      throw error
    }

    return successResponse({ message: 'FAQ item deleted successfully' })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return unauthorizedResponse()
    }
    return serverErrorResponse('Failed to delete FAQ item', error.message)
  }
}

