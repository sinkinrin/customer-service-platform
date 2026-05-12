/**
 * Conversation Constants
 */

const CONVERSATION_LAST_VISIT_KEY_PREFIX = 'conversationLastVisitAt'
const CONVERSATION_AI_CHAT_MODE_KEY_PREFIX = 'conversationAiChatMode'
const CONVERSATION_JUST_CREATED_KEY_PREFIX = 'conversationJustCreated'

export const HISTORY_LIST_PAGE_SIZE = 20
export const HISTORY_MESSAGE_PAGE_SIZE = 50
export const HISTORY_CACHE_TTL_MS = 24 * 60 * 60 * 1000
export const HISTORY_LIST_MAX = 50
export const HISTORY_MESSAGE_MAX_CONVERSATIONS = 10
export const HISTORY_MESSAGE_MAX_PER_CONVERSATION = 100
export const HISTORY_CACHE_MAX_BYTES = 2 * 1024 * 1024

export const INITIAL_AI_MESSAGES_LIMIT = 100

/** sessionStorage key for tracking last conversation page visit */
export function getConversationLastVisitKey(userId?: string | null): string {
  return `${CONVERSATION_LAST_VISIT_KEY_PREFIX}:${userId || 'anonymous'}`
}

/** localStorage key for remembering the customer's AI chat mode */
export function getConversationAiChatModeKey(userId?: string | null): string {
  return `${CONVERSATION_AI_CHAT_MODE_KEY_PREFIX}:${userId || 'anonymous'}`
}

export function getConversationJustCreatedKey(userId?: string | null): string {
  return `${CONVERSATION_JUST_CREATED_KEY_PREFIX}:${userId || 'anonymous'}`
}
