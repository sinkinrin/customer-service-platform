/**
 * Local Conversation Storage
 * 
 * File-based storage for AI conversations (does NOT create Zammad tickets)
 * Only creates Zammad tickets when user clicks "转人工" (Transfer to Human Agent)
 */

import fs from 'fs/promises'
import path from 'path'

const STORAGE_DIR = path.join(process.cwd(), 'data', 'conversations')
const CONVERSATIONS_FILE = path.join(STORAGE_DIR, 'conversations.json')
const MESSAGES_FILE = path.join(STORAGE_DIR, 'messages.json')

export interface LocalConversation {
  id: string
  customer_id: string
  customer_email: string
  mode: 'ai' | 'human'
  status: 'active' | 'closed'
  zammad_ticket_id?: number // Only set when escalated to human
  created_at: string
  updated_at: string
  last_message_at: string
}

export interface LocalMessage {
  id: string
  conversation_id: string
  sender_role: 'customer' | 'ai' | 'staff'
  sender_id: string
  content: string
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
 */
export async function createAIConversation(
  customer_id: string,
  customer_email: string
): Promise<LocalConversation> {
  const conversations = await readConversations()
  
  const newConversation: LocalConversation = {
    id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    customer_id,
    customer_email,
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
 */
export async function addMessage(
  conversation_id: string,
  sender_role: 'customer' | 'ai' | 'staff',
  sender_id: string,
  content: string
): Promise<LocalMessage> {
  const messages = await readMessages()
  
  const newMessage: LocalMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    conversation_id,
    sender_role,
    sender_id,
    content,
    created_at: new Date().toISOString(),
  }
  
  messages.push(newMessage)
  await writeMessages(messages)
  
  // Update conversation's last_message_at
  await updateConversation(conversation_id, {
    last_message_at: newMessage.created_at,
  })
  
  console.log('[LocalStorage] Added message to conversation:', conversation_id)
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

