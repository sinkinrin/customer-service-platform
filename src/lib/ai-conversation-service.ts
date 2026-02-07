/**
 * AI Conversation Service
 *
 * Prisma-based storage for AI conversations, replacing file-based local storage.
 * Provides CRUD operations for conversations, messages, and message ratings.
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/utils/logger'

// ============================================================================
// Conversation Operations
// ============================================================================

/**
 * Create a new AI conversation.
 * Automatically closes all existing active conversations for the same customer.
 */
export async function createAIConversation(
  customerId: string,
  customerEmail: string
) {
  // Close all existing active conversations for this customer
  await prisma.aiConversation.updateMany({
    where: {
      customerId,
      status: 'active',
    },
    data: {
      status: 'closed',
    },
  })

  const conversation = await prisma.aiConversation.create({
    data: {
      customerId,
      customerEmail,
      status: 'active',
    },
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
 * Get conversations for a customer by email
 */
export async function getCustomerConversations(customerEmail: string) {
  return prisma.aiConversation.findMany({
    where: { customerEmail },
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
  } catch {
    return null
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
  } catch {
    return false
  }
}

// ============================================================================
// Message Operations
// ============================================================================

/**
 * Add a message to a conversation.
 * Updates the conversation's lastMessageAt timestamp.
 */
export async function addMessage(
  conversationId: string,
  senderRole: 'customer' | 'ai' | 'system',
  senderId: string,
  content: string,
  metadata?: Record<string, any>,
  messageType?: 'text' | 'image' | 'file' | 'system'
) {
  const message = await prisma.aiMessage.create({
    data: {
      conversationId,
      senderRole,
      senderId,
      content,
      messageType: messageType || 'text',
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  })

  // Update conversation's lastMessageAt
  await prisma.aiConversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  })

  return {
    ...message,
    metadata: message.metadata ? JSON.parse(message.metadata) : null,
  }
}

/**
 * Get messages for a conversation, including ratings
 */
export async function getConversationMessages(conversationId: string) {
  const messages = await prisma.aiMessage.findMany({
    where: { conversationId },
    include: { rating: true },
    orderBy: { createdAt: 'asc' },
  })

  return messages.map((msg) => ({
    ...msg,
    metadata: msg.metadata ? JSON.parse(msg.metadata) : null,
  }))
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
        where: {
          messageId_userId: { messageId, userId },
        },
      })
    } catch {
      // Rating didn't exist, that's fine
    }
    return null
  }

  const result = await prisma.aiMessageRating.upsert({
    where: {
      messageId_userId: { messageId, userId },
    },
    update: {
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
 * Get rating for a specific message by a specific user
 */
export async function getMessageRating(messageId: string, userId: string) {
  return prisma.aiMessageRating.findUnique({
    where: {
      messageId_userId: { messageId, userId },
    },
  })
}

// ============================================================================
// Dashboard Statistics
// ============================================================================

/**
 * Get AI conversation dashboard statistics for admin
 */
export async function getAiConversationDashboardStats() {
  const [
    totalConversations,
    activeConversations,
    closedConversations,
    totalMessages,
    customerMessages,
    aiMessages,
    positiveRatings,
    negativeRatings,
    recentNegativeRaw,
  ] = await Promise.all([
    prisma.aiConversation.count(),
    prisma.aiConversation.count({ where: { status: 'active' } }),
    prisma.aiConversation.count({ where: { status: 'closed' } }),
    prisma.aiMessage.count(),
    prisma.aiMessage.count({ where: { senderRole: 'customer' } }),
    prisma.aiMessage.count({ where: { senderRole: 'ai' } }),
    prisma.aiMessageRating.count({ where: { rating: 'positive' } }),
    prisma.aiMessageRating.count({ where: { rating: 'negative' } }),
    prisma.aiMessageRating.findMany({
      where: { rating: 'negative' },
      include: { message: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

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
