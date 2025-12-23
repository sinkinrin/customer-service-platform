import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Schema for rating submission
const ratingSchema = z.object({
  rating: z.enum(['positive', 'negative']),
  reason: z.string().max(1000).optional(),
})

// GET /api/tickets/[id]/rating - Get ticket rating
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

    const { id } = await params
    const ticketId = parseInt(id, 10)

    if (isNaN(ticketId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid ticket ID' } },
        { status: 400 }
      )
    }

    const rating = await prisma.ticketRating.findUnique({
      where: { ticketId },
    })

    return NextResponse.json({
      success: true,
      data: rating,
    })
  } catch (error) {
    console.error('[GET /api/tickets/[id]/rating] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get rating' } },
      { status: 500 }
    )
  }
}

// POST /api/tickets/[id]/rating - Submit ticket rating
export async function POST(
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

    // Only customers can rate tickets
    if (session.user.role !== 'customer') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only customers can rate tickets' } },
        { status: 403 }
      )
    }

    const { id } = await params
    const ticketId = parseInt(id, 10)

    if (isNaN(ticketId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid ticket ID' } },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validationResult = ratingSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: validationResult.error.message } },
        { status: 400 }
      )
    }

    const { rating, reason } = validationResult.data

    // Check if rating already exists
    const existingRating = await prisma.ticketRating.findUnique({
      where: { ticketId },
    })

    let savedRating
    if (existingRating) {
      // Update existing rating
      savedRating = await prisma.ticketRating.update({
        where: { ticketId },
        data: {
          rating,
          reason,
          updatedAt: new Date(),
        },
      })
    } else {
      // Create new rating
      savedRating = await prisma.ticketRating.create({
        data: {
          ticketId,
          userId: session.user.id || session.user.email || 'unknown',
          rating,
          reason,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: savedRating,
    })
  } catch (error) {
    console.error('[POST /api/tickets/[id]/rating] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save rating' } },
      { status: 500 }
    )
  }
}
