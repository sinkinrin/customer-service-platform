/**
 * Local Conversation Storage
 * 
 * File-based storage for AI conversations (does NOT create Zammad tickets)
 * Only creates Zammad tickets when user clicks "转人工" (Transfer to Human Agent)
 */

import fs from 'fs/promises'
import path from 'path'
import type { RegionValue } from '@/lib/constants/regions'

const STORAGE_DIR = path.join(process.cwd(), 'data', 'conversations')
const CONVERSATIONS_FILE = path.join(STORAGE_DIR, 'conversations.json')
const MESSAGES_FILE = path.join(STORAGE_DIR, 'messages.json')

export interface ConversationRating {
  score: 1 | 2 | 3 | 4 | 5 // 1-5 star rating
  feedback?: string // Optional feedback message
  rated_at: string // When the rating was submitted
}

export interface LocalConversation {
  id: string
  customer_id: string
  customer_email: string
  customer_name?: string // Customer display name
  region?: RegionValue // Customer's region for routing
  mode: 'ai' | 'human'
  status: 'active' | 'waiting' | 'closed'
  zammad_ticket_id?: number // Only set when escalated to human
  transferred_at?: string // When conversation was transferred to human
  transfer_reason?: string // Optional reason for transfer
  staff_id?: string // Assigned staff ID
  staff_name?: string // Assigned staff name
  assigned_at?: string // When staff was assigned
  customer_unread_count?: number // Number of unread messages for customer
  staff_unread_count?: number // Number of unread messages for staff
  customer_last_read_at?: string // Last time customer read messages
  staff_last_read_at?: string // Last time staff read messages
  rating?: ConversationRating // Customer satisfaction rating
  created_at: string
  updated_at: string
  last_message_at: string
}

export interface LocalMessage {
  id: string
  conversation_id: string
  sender_role: 'customer' | 'ai' | 'staff' | 'system'
  sender_id: string
  content: string
  message_type?: 'text' | 'image' | 'file' | 'system' | 'transfer_history' // R2: Support attachments
  metadata?: Record<string, any> // Optional metadata for storing AI history, attachments, etc.
  created_at: string
}

/**
 * Initialize storage directory and files
 */
async function initStorage() {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true })
    
    // Initialize conversations file if it doesn't exist
    try {
      await fs.access(CONVERSATIONS_FILE)
    } catch {
      await fs.writeFile(CONVERSATIONS_FILE, JSON.stringify([]))
    }
    
    // Initialize messages file if it doesn't exist
    try {
      await fs.access(MESSAGES_FILE)
    } catch {
      await fs.writeFile(MESSAGES_FILE, JSON.stringify([]))
    }
  } catch (error) {
    console.error('[LocalStorage] Failed to initialize storage:', error)
    throw error
  }
}

/**
 * Read conversations from file
 */
async function readConversations(): Promise<LocalConversation[]> {
  try {
    await initStorage()
    const data = await fs.readFile(CONVERSATIONS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error('[LocalStorage] Failed to read conversations:', error)
    return []
  }
}

/**
 * Write conversations to file
 */
async function writeConversations(conversations: LocalConversation[]): Promise<void> {
  try {
    await initStorage()
    await fs.writeFile(CONVERSATIONS_FILE, JSON.stringify(conversations, null, 2))
  } catch (error) {
    console.error('[LocalStorage] Failed to write conversations:', error)
    throw error
  }
}

/**
 * Read messages from file
 */
async function readMessages(): Promise<LocalMessage[]> {
  try {
    await initStorage()
    const data = await fs.readFile(MESSAGES_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error('[LocalStorage] Failed to read messages:', error)
    return []
  }
}

/**
 * Write messages to file
 */
async function writeMessages(messages: LocalMessage[]): Promise<void> {
  try {
    await initStorage()
    await fs.writeFile(MESSAGES_FILE, JSON.stringify(messages, null, 2))
  } catch (error) {
    console.error('[LocalStorage] Failed to write messages:', error)
    throw error
  }
}

/**
 * Create a new AI conversation (does NOT create Zammad ticket)
 * @param customer_id - Customer's user ID
 * @param customer_email - Customer's email
 * @param region - Customer's region for routing (optional, defaults to 'asia-pacific')
 */
export async function createAIConversation(
  customer_id: string,
  customer_email: string,
  region?: RegionValue
): Promise<LocalConversation> {
  const conversations = await readConversations()
  
  const newConversation: LocalConversation = {
    id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    customer_id,
    customer_email,
    region: region || 'asia-pacific', // Default to asia-pacific if not provided
    mode: 'ai',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_message_at: new Date().toISOString(),
  }
  
  conversations.push(newConversation)
  await writeConversations(conversations)
  
  console.log('[LocalStorage] Created AI conversation:', newConversation.id)
  return newConversation
}

/**
 * Get conversation by ID
 */
export async function getConversation(id: string): Promise<LocalConversation | null> {
  const conversations = await readConversations()
  return conversations.find(c => c.id === id) || null
}

/**
 * Get conversations for a customer
 */
export async function getCustomerConversations(customer_email: string): Promise<LocalConversation[]> {
  const conversations = await readConversations()
  return conversations.filter(c => c.customer_email === customer_email)
}

/**
 * Get all conversations (for staff/admin)
 */
export async function getAllConversations(): Promise<LocalConversation[]> {
  const conversations = await readConversations()
  return conversations
}

/**
 * Update conversation
 */
export async function updateConversation(
  id: string,
  updates: Partial<LocalConversation>
): Promise<LocalConversation | null> {
  const conversations = await readConversations()
  const index = conversations.findIndex(c => c.id === id)
  
  if (index === -1) return null
  
  conversations[index] = {
    ...conversations[index],
    ...updates,
    updated_at: new Date().toISOString(),
  }
  
  await writeConversations(conversations)
  return conversations[index]
}

/**
 * Add message to conversation
 * R2: Now accepts message_type to preserve attachment metadata
 */
export async function addMessage(
  conversation_id: string,
  sender_role: 'customer' | 'ai' | 'staff',
  sender_id: string,
  content: string,
  metadata?: Record<string, any>,
  message_type?: 'text' | 'image' | 'file' | 'system' | 'transfer_history'
): Promise<LocalMessage> {
  const messages = await readMessages()

  const newMessage: LocalMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    conversation_id,
    sender_role,
    sender_id,
    content,
    message_type: message_type || 'text',
    metadata,
    created_at: new Date().toISOString(),
  }

  messages.push(newMessage)
  await writeMessages(messages)

  // Update conversation's last_message_at
  await updateConversation(conversation_id, {
    last_message_at: newMessage.created_at,
  })

  console.log('[LocalStorage] Added message to conversation:', conversation_id, message_type || 'text')
  return newMessage
}

/**
 * Add message with metadata (for system messages, transfer history, etc.)
 */
export async function addMessageWithMetadata(
  conversation_id: string,
  sender_role: 'customer' | 'ai' | 'staff' | 'system',
  sender_id: string,
  content: string,
  message_type: 'text' | 'system' | 'transfer_history',
  metadata?: Record<string, any>
): Promise<LocalMessage> {
  const messages = await readMessages()

  const newMessage: LocalMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    conversation_id,
    sender_role,
    sender_id,
    content,
    message_type,
    metadata,
    created_at: new Date().toISOString(),
  }

  messages.push(newMessage)
  await writeMessages(messages)

  // Update conversation's last_message_at
  await updateConversation(conversation_id, {
    last_message_at: newMessage.created_at,
  })

  console.log('[LocalStorage] Added message with metadata:', conversation_id, message_type)
  return newMessage
}

/**
 * Get messages for a conversation
 */
export async function getConversationMessages(conversation_id: string): Promise<LocalMessage[]> {
  const messages = await readMessages()
  return messages.filter(m => m.conversation_id === conversation_id)
}

/**
 * Delete conversation and its messages
 */
export async function deleteConversation(id: string): Promise<boolean> {
  const conversations = await readConversations()
  const messages = await readMessages()
  
  const filteredConversations = conversations.filter(c => c.id !== id)
  const filteredMessages = messages.filter(m => m.conversation_id !== id)
  
  await writeConversations(filteredConversations)
  await writeMessages(filteredMessages)
  
  console.log('[LocalStorage] Deleted conversation:', id)
  return true
}

/**
 * Get conversation statistics for a customer
 */
export async function getConversationStats(customer_email: string) {
  const conversations = await getCustomerConversations(customer_email)

  return {
    total: conversations.length,
    active: conversations.filter(c => c.status === 'active').length,
    closed: conversations.filter(c => c.status === 'closed').length,
    ai_mode: conversations.filter(c => c.mode === 'ai').length,
    human_mode: conversations.filter(c => c.mode === 'human').length,
  }
}

/**
 * Increment unread count for specific user role
 * @param conversation_id - The conversation ID
 * @param forRole - Which role should see the unread count ('customer' or 'staff')
 */
export async function incrementUnreadCount(
  conversation_id: string,
  forRole: 'customer' | 'staff'
): Promise<LocalConversation | null> {
  const conversation = await getConversation(conversation_id)
  if (!conversation) return null

  if (forRole === 'customer') {
    const currentCount = conversation.customer_unread_count || 0
    return await updateConversation(conversation_id, {
      customer_unread_count: currentCount + 1,
    })
  } else {
    const currentCount = conversation.staff_unread_count || 0
    return await updateConversation(conversation_id, {
      staff_unread_count: currentCount + 1,
    })
  }
}

/**
 * Mark conversation as read for specific user role
 * @param conversation_id - The conversation ID
 * @param byRole - Which role is marking as read ('customer' or 'staff')
 */
export async function markConversationAsRead(
  conversation_id: string,
  byRole: 'customer' | 'staff'
): Promise<LocalConversation | null> {
  if (byRole === 'customer') {
    return await updateConversation(conversation_id, {
      customer_unread_count: 0,
      customer_last_read_at: new Date().toISOString(),
    })
  } else {
    return await updateConversation(conversation_id, {
      staff_unread_count: 0,
      staff_last_read_at: new Date().toISOString(),
    })
  }
}

/**
 * Get total unread count for a customer
 */
export async function getTotalUnreadCount(customer_email: string): Promise<number> {
  const conversations = await getCustomerConversations(customer_email)
  return conversations.reduce((total, conv) => total + (conv.customer_unread_count || 0), 0)
}

/**
 * Get total unread count for staff
 * R4: Now supports per-staff filtering for individual queues
 * @param staff_id - Optional staff ID to filter by assigned conversations. If omitted, returns global count (admin view)
 */
export async function getStaffUnreadCount(staff_id?: string): Promise<number> {
  const conversations = await getAllConversations()
  let humanConversations = conversations.filter(c => c.mode === 'human' && c.status === 'active')

  // R4: Filter by staff assignment if staff_id provided
  if (staff_id) {
    humanConversations = humanConversations.filter(c => c.staff_id === staff_id)
  }

  return humanConversations.reduce((total, conv) => total + (conv.staff_unread_count || 0), 0)
}

/**
 * Create a new message (with message_type support)
 */
export async function createMessage(data: {
  conversation_id: string
  sender_role: 'customer' | 'ai' | 'staff' | 'system'
  sender_id: string
  content: string
  message_type?: 'text' | 'system' | 'transfer_history'
  metadata?: Record<string, any>
}): Promise<LocalMessage> {
  const messages = await readMessages()

  const newMessage: LocalMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    conversation_id: data.conversation_id,
    sender_role: data.sender_role,
    sender_id: data.sender_id,
    content: data.content,
    message_type: data.message_type || 'text',
    metadata: data.metadata,
    created_at: new Date().toISOString(),
  }

  messages.push(newMessage)
  await writeMessages(messages)

  // Update conversation's last_message_at
  await updateConversation(data.conversation_id, {
    last_message_at: newMessage.created_at,
  })

  console.log('[LocalStorage] Created message:', newMessage.id)
  return newMessage
}

