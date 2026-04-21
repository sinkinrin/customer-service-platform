/**
 * Conversation Constants
 */

const CONVERSATION_LAST_VISIT_KEY_PREFIX = 'conversationLastVisitAt'

/** sessionStorage key for tracking last conversation page visit */
export function getConversationLastVisitKey(userId?: string | null): string {
  return `${CONVERSATION_LAST_VISIT_KEY_PREFIX}:${userId || 'anonymous'}`
}
