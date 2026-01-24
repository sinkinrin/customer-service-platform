import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'

// Schema for template update
const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  content: z.string().min(1).max(5000).optional(),
  category: z.enum(['first_contact', 'technical', 'follow_up', 'closing', 'general']).optional(),
  region: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

// GET /api/templates/[id] - Get a single template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    if (session.user.role === 'customer') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      )
    }

    const { id } = await params
    const templateId = parseInt(id, 10)

    if (isNaN(templateId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid template ID' } },
        { status: 400 }
      )
    }

    const template = await prisma.replyTemplate.findUnique({
      where: { id: templateId },
    })

    if (!template) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: template,
    })
  } catch (error) {
    logger.error('Templates', 'Failed to fetch template by ID', { data: { error: error instanceof Error ? error.message : error } })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch template' } },
      { status: 500 }
    )
  }
}

// PUT /api/templates/[id] - Update a template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    if (session.user.role === 'customer') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      )
    }

    const { id } = await params
    const templateId = parseInt(id, 10)

    if (isNaN(templateId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid template ID' } },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validationResult = updateTemplateSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: validationResult.error.message } },
        { status: 400 }
      )
    }

    const template = await prisma.replyTemplate.update({
      where: { id: templateId },
      data: validationResult.data,
    })

    return NextResponse.json({
      success: true,
      data: template,
    })
  } catch (error) {
    logger.error('Templates', 'Failed to update template', { data: { error: error instanceof Error ? error.message : error } })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update template' } },
      { status: 500 }
    )
  }
}

// DELETE /api/templates/[id] - Delete a template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    // Only admin can delete templates
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only admins can delete templates' } },
        { status: 403 }
      )
    }

    const { id } = await params
    const templateId = parseInt(id, 10)

    if (isNaN(templateId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid template ID' } },
        { status: 400 }
      )
    }

    await prisma.replyTemplate.delete({
      where: { id: templateId },
    })

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully',
    })
  } catch (error) {
    logger.error('Templates', 'Failed to delete template', { data: { error: error instanceof Error ? error.message : error } })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete template' } },
      { status: 500 }
    )
  }
}
