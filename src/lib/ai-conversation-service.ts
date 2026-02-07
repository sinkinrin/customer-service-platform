/**
 * AI Conversation Service
 *
 * Prisma-based storage for AI conversations.
 * Provides CRUD operations for conversations, messages, and message ratings.
 */

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { logger } from '@/lib/utils/logger'

// ============================================================================
// Helpers
// ============================================================================

/** Safely parse a JSON string, returning null on failure */
function safeJsonParse(value: string | null | undefined): any {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

// ============================================================================
// Conversation Operations
// ============================================================================

/**
 * Create a new AI conversation.
 * Automatically closes all existing active conversations for the same customer.
 * Wrapped in a transaction to ensure atomicity.
 */
export async function createAIConversation(
  customerId: string,
  customerEmail: string
) {
  const conversation = await prisma.$transaction(async (tx) => {
    // Close all existing active conversations for this customer
    await tx.aiConversation.updateMany({
      where: {
        customerId,
        status: 'active',
      },
      data: {
        status: 'closed',
      },
    })

    return tx.aiConversation.create({
      data: {
        customerId,
        customerEmail,
        status: 'active',
      },
    })
  })

  logger.info('AiConversationService', 'Created new AI conversation', {
    data: { conversationId: conversation.id, customerId },
  })

  return conversation
}

/**
 * Get conversation by ID
 */
export async function getConversation(id: string) {
  return prisma.aiConversation.findUnique({
    where: { id },
  })
}

/**
 * Get conversations for a customer by email, with message count
 */
export async function getCustomerConversations(customerEmail: string) {
  return prisma.aiConversation.findMany({
    where: { customerEmail },
    include: { _count: { select: { messages: true } } },
    orderBy: { lastMessageAt: 'desc' },
  })
}

/**
 * Get all conversations (admin use)
 */
export async function getAllConversations() {
  return prisma.aiConversation.findMany({
    orderBy: { lastMessageAt: 'desc' },
  })
}

/**
 * Update a conversation
 */
export async function updateConversation(
  id: string,
  updates: { status?: string; lastMessageAt?: Date }
) {
  try {
    const conversation = await prisma.aiConversation.update({
      where: { id },
      data: updates,
    })
    return conversation
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return null
    }
    throw error
  }
}

/**
 * Delete a conversation (cascades to messages and ratings)
 */
export async function deleteConversation(id: string): Promise<boolean> {
  try {
    await prisma.aiConversation.delete({
      where: { id },
    })
    return true
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return false
    }
    throw error
  }
}

/**
 * Get message count for a conversation
 */
export async function getConversationMessageCount(conversationId: string) {
  return prisma.aiMessage.count({
    where: { conversationId },
  })
}

// ============================================================================
// Message Operations
// ============================================================================

/**
 * Add a message to a conversation.
 * Updates the conversation's lastMessageAt timestamp atomically.
 */
export async function addMessage(
  conversationId: string,
  senderRole: 'customer' | 'ai' | 'system',
  senderId: string,
  content: string,
  metadata?: Record<string, any>,
  messageType?: 'text' | 'image' | 'file' | 'system'
) {
  const [message] = await prisma.$transaction([
    prisma.aiMessage.create({
      data: {
        conversationId,
        senderRole,
        senderId,
        content,
        messageType: messageType || 'text',
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    }),
    prisma.aiConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    }),
  ])

  return {
    ...message,
    metadata: safeJsonParse(message.metadata),
  }
}

/**
 * Get messages for a conversation, including ratings.
 * Supports database-level pagination.
 */
export async function getConversationMessages(
  conversationId: string,
  options?: { limit?: number; offset?: number; order?: 'asc' | 'desc' }
) {
  const { limit, offset, order = 'asc' } = options || {}

  const messages = await prisma.aiMessage.findMany({
    where: { conversationId },
    include: { rating: true },
    orderBy: { createdAt: order },
    ...(limit !== undefined && { take: limit }),
    ...(offset !== undefined && { skip: offset }),
  })

  return messages.map((msg) => ({
    ...msg,
    metadata: safeJsonParse(msg.metadata),
  }))
}

/**
 * Get total message count for a conversation (for pagination)
 */
export async function getConversationMessageTotal(conversationId: string) {
  return prisma.aiMessage.count({ where: { conversationId } })
}

/**
 * Verify a message belongs to a conversation
 */
export async function verifyMessageOwnership(messageId: string, conversationId: string) {
  const message = await prisma.aiMessage.findFirst({
    where: { id: messageId, conversationId },
    select: { id: true },
  })
  return !!message
}

/**
 * Get conversation statistics for a customer
 */
export async function getConversationStats(customerEmail: string) {
  const [total, active, closed] = await Promise.all([
    prisma.aiConversation.count({ where: { customerEmail } }),
    prisma.aiConversation.count({ where: { customerEmail, status: 'active' } }),
    prisma.aiConversation.count({ where: { customerEmail, status: 'closed' } }),
  ])

  return { total, active, closed }
}

// ============================================================================
// Rating Operations
// ============================================================================

/**
 * Rate a message (upsert). Pass rating as null to remove the rating.
 * Uses messageId as the unique key (one rating per message).
 */
export async function rateMessage(
  messageId: string,
  userId: string,
  rating: 'positive' | 'negative' | null,
  feedback?: string
) {
  if (rating === null) {
    // Remove rating
    try {
      await prisma.aiMessageRating.delete({
        where: { messageId },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        // Rating didn't exist, that's fine
      } else {
        throw error
      }
    }
    return null
  }

  const result = await prisma.aiMessageRating.upsert({
    where: { messageId },
    update: {
      userId,
      rating,
      feedback: rating === 'positive' ? null : (feedback || null),
    },
    create: {
      messageId,
      userId,
      rating,
      feedback: rating === 'positive' ? null : (feedback || null),
    },
  })

  return result
}

/**
 * Get rating for a specific message
 */
export async function getMessageRating(messageId: string) {
  return prisma.aiMessageRating.findUnique({
    where: { messageId },
  })
}

// ============================================================================
// Dashboard Statistics
// ============================================================================

/**
 * Get AI conversation dashboard statistics for admin.
 * Uses groupBy to reduce query count where possible.
 */
export async function getAiConversationDashboardStats() {
  const [
    conversationsByStatus,
    messagesByRole,
    ratingsByType,
    recentNegativeRaw,
  ] = await Promise.all([
    prisma.aiConversation.groupBy({
      by: ['status'],
      _count: true,
    }),
    prisma.aiMessage.groupBy({
      by: ['senderRole'],
      _count: true,
    }),
    prisma.aiMessageRating.groupBy({
      by: ['rating'],
      _count: true,
    }),
    prisma.aiMessageRating.findMany({
      where: { rating: 'negative' },
      include: { message: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  // Parse conversation stats
  const activeConversations = conversationsByStatus.find(c => c.status === 'active')?._count ?? 0
  const closedConversations = conversationsByStatus.find(c => c.status === 'closed')?._count ?? 0
  const totalConversations = conversationsByStatus.reduce((sum, c) => sum + c._count, 0)

  // Parse message stats
  const customerMessages = messagesByRole.find(m => m.senderRole === 'customer')?._count ?? 0
  const aiMessages = messagesByRole.find(m => m.senderRole === 'ai')?._count ?? 0
  const totalMessages = messagesByRole.reduce((sum, m) => sum + m._count, 0)

  // Parse rating stats
  const positiveRatings = ratingsByType.find(r => r.rating === 'positive')?._count ?? 0
  const negativeRatings = ratingsByType.find(r => r.rating === 'negative')?._count ?? 0
  const totalRatings = positiveRatings + negativeRatings
  const satisfactionRate =
    totalRatings > 0
      ? Math.round((positiveRatings / totalRatings) * 100)
      : 0

  const recentNegative = recentNegativeRaw.map((r) => ({
    messageId: r.messageId,
    content:
      r.message.content.length > 100
        ? r.message.content.substring(0, 100) + '...'
        : r.message.content,
    feedback: r.feedback,
    createdAt: r.createdAt.toISOString(),
  }))

  return {
    conversations: {
      total: totalConversations,
      active: activeConversations,
      closed: closedConversations,
    },
    messages: {
      total: totalMessages,
      customer: customerMessages,
      ai: aiMessages,
    },
    ratings: {
      positive: positiveRatings,
      negative: negativeRatings,
      satisfactionRate,
    },
    recentNegative,
  }
}
