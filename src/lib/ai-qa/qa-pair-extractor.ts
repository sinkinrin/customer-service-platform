/**
 * QA Pair Extractor
 *
 * Shared utility that pairs AI messages with their preceding customer questions.
 * Extracted from the admin ai-export route for reuse across QA review and export.
 */

interface MinimalMessage {
  id: string
  conversationId: string
  senderRole: string
  content: string
  createdAt: Date
}

/**
 * Given a set of AI messages and all conversation messages grouped by conversationId,
 * finds the customer question that preceded each AI reply.
 *
 * @param aiMessageId - The AI message ID to find the question for
 * @param conversationMessages - All messages in the conversation, sorted by createdAt ASC
 * @returns The customer question text, or empty string if none found
 */
export function findQuestionForAiMessage(
  aiMessageId: string,
  conversationMessages: MinimalMessage[]
): string {
  const aiMsgIndex = conversationMessages.findIndex((m) => m.id === aiMessageId)
  if (aiMsgIndex < 0) return ''

  const aiMsg = conversationMessages[aiMsgIndex]
  // Walk backwards from the AI message to find the nearest customer message
  for (let i = aiMsgIndex - 1; i >= 0; i--) {
    const m = conversationMessages[i]
    if (m.senderRole === 'customer' && m.createdAt <= aiMsg.createdAt) {
      return m.content
    }
  }

  return ''
}

/**
 * Builds a lookup map from conversationId -> messages sorted by createdAt ASC.
 * Used by both the rounds listing and export features.
 */
export function buildConversationMessageMap(
  messages: MinimalMessage[]
): Map<string, MinimalMessage[]> {
  const map = new Map<string, MinimalMessage[]>()
  for (const msg of messages) {
    let list = map.get(msg.conversationId)
    if (!list) {
      list = []
      map.set(msg.conversationId, list)
    }
    list.push(msg)
  }
  return map
}
