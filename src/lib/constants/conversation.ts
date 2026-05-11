/**
 * Conversation Constants
 */

const CONVERSATION_LAST_VISIT_KEY_PREFIX = 'conversationLastVisitAt'
const CONVERSATION_AI_CHAT_MODE_KEY_PREFIX = 'conversationAiChatMode'

export const INITIAL_AI_MESSAGES_LIMIT = 100

/** sessionStorage key for tracking last conversation page visit */
export function getConversationLastVisitKey(userId?: string | null): string {
  return `${CONVERSATION_LAST_VISIT_KEY_PREFIX}:${userId || 'anonymous'}`
}

/** localStorage key for remembering the customer's AI chat mode */
export function getConversationAiChatModeKey(userId?: string | null): string {
  return `${CONVERSATION_AI_CHAT_MODE_KEY_PREFIX}:${userId || 'anonymous'}`
}
