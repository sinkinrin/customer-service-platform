import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'

// Schema for template creation/update
const templateSchema = z.object({
  name: z.string().min(1).max(100),
  content: z.string().min(1).max(5000),
  category: z.enum(['first_contact', 'technical', 'follow_up', 'closing', 'general']),
  region: z.string().optional(),
  isActive: z.boolean().optional().default(true),
})

// GET /api/templates - List all templates
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    // Only staff and admin can access templates
    if (session.user.role === 'customer') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const region = searchParams.get('region')

    const where: Record<string, unknown> = { isActive: true }
    if (category) where.category = category
    
    // Staff can only see templates for their region or global templates
    if (session.user.role === 'staff' && session.user.region) {
      where.OR = [
        { region: session.user.region },
        { region: null },
      ]
    } else if (region) {
      where.region = region
    }

    const templates = await prisma.replyTemplate.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { name: 'asc' },
      ],
    })

    return NextResponse.json({
      success: true,
      data: templates,
    })
  } catch (error) {
    logger.error('Templates', 'Failed to fetch templates', { data: { error: error instanceof Error ? error.message : error } })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch templates' } },
      { status: 500 }
    )
  }
}

// POST /api/templates - Create a new template
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    // Only staff and admin can create templates
    if (session.user.role === 'customer') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validationResult = templateSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: validationResult.error.message } },
        { status: 400 }
      )
    }

    const { name, content, category, region, isActive } = validationResult.data

    const template = await prisma.replyTemplate.create({
      data: {
        name,
        content,
        category,
        region: region || null,
        createdById: session.user.id || session.user.email,
        isActive: isActive ?? true,
      },
    })

    return NextResponse.json({
      success: true,
      data: template,
    }, { status: 201 })
  } catch (error) {
    logger.error('Templates', 'Failed to create template', { data: { error: error instanceof Error ? error.message : error } })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create template' } },
      { status: 500 }
    )
  }
}
