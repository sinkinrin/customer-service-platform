/**
 * Conversations Auto-Redirect Page
 *
 * Automatically creates or joins an active conversation.
 * - Returns within 30 min → reuse existing conversation (page switch)
 * - Returns after 30+ min (or first visit) → start fresh conversation
 */

'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useConversation } from '@/lib/hooks/use-conversation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { CONVERSATION_LAST_VISIT_KEY } from '@/lib/constants/conversation'

// If the user left the conversation page more than this many ms ago,
// we treat it as a "return" and start fresh.
const NEW_CONVERSATION_THRESHOLD_MS = 30 * 60 * 1000 // 30 minutes

export default function ConversationsPage() {
  const t = useTranslations('customer.conversations.starting')
  const tToast = useTranslations('toast.customer.conversations')

  const router = useRouter()
  const { conversations, fetchConversations, createConversation } = useConversation()
  const [isProcessing, setIsProcessing] = useState(true)
  const [conversationsLoaded, setConversationsLoaded] = useState(false)
  const hasRedirected = useRef(false)

  // Fetch conversations first
  useEffect(() => {
    const loadConversations = async () => {
      try {
        setIsProcessing(true)
        setConversationsLoaded(false)
        await fetchConversations()
        setConversationsLoaded(true)
      } catch (error) {
        console.error('Error fetching conversations:', error)
        toast.error(tToast('loadError'))
        setIsProcessing(false)
      }
    }

    loadConversations()
  }, [fetchConversations])

  // Redirect once conversations are loaded
  useEffect(() => {
    if (!conversationsLoaded || !isProcessing) return
    // Guard against double execution (conversations change triggers re-run)
    if (hasRedirected.current) return
    hasRedirected.current = true

    const handleRedirect = async () => {
      try {
        const conversationsList = Array.isArray(conversations) ? conversations : []

        // Find ALL active (non-closed) conversations
        const activeConversations = conversationsList.filter(
          (conv) => conv.status !== 'closed'
        )

        // Check how long the user has been away
        let elapsed = 0 // default: treat as "quick switch" (reuse existing)
        try {
          const lastVisit = sessionStorage.getItem(CONVERSATION_LAST_VISIT_KEY)
          if (lastVisit) {
            elapsed = Date.now() - parseInt(lastVisit, 10)
          }
        } catch {
          // sessionStorage unavailable (e.g., incognito restrictions) — treat as quick switch
        }

        const shouldStartFresh = activeConversations.length === 0 || elapsed >= NEW_CONVERSATION_THRESHOLD_MS

        if (!shouldStartFresh && activeConversations.length > 0) {
          // Quick page switch — reuse the most recent active conversation
          const latest = activeConversations[0]
          router.replace(`/customer/conversations/${latest.id}`)
        } else {
          // Return after absence or no active conversations — start fresh
          // Close ALL active conversations to prevent orphans
          for (const conv of activeConversations) {
            try {
              await fetch(`/api/conversations/${conv.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'closed' }),
              })
            } catch (e) {
              console.warn('[Conversations] Failed to close stale conversation:', conv.id, e)
            }
          }

          const newConversation = await createConversation()
          router.replace(`/customer/conversations/${newConversation.id}`)
        }
      } catch (error) {
        console.error('Error handling conversation:', error)
        toast.error(tToast('startError'))
        setIsProcessing(false)
        hasRedirected.current = false // allow retry on error
      }
    }

    handleRedirect()
  }, [conversationsLoaded, conversations, isProcessing, router, createConversation])

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-8 w-8 text-primary animate-pulse motion-reduce:animate-none" />
            </div>
          </div>
          <CardTitle className="text-center">{t('title')}</CardTitle>
          <CardDescription className="text-center">
            {isProcessing
              ? t('connectingMessage')
              : t('redirectingMessage')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center">
            <div className="flex space-x-2">
              <div className="h-2 w-2 bg-primary rounded-full animate-bounce motion-reduce:animate-none" />
              <div className="h-2 w-2 bg-primary rounded-full animate-bounce motion-reduce:animate-none [animation-delay:150ms]" />
              <div className="h-2 w-2 bg-primary rounded-full animate-bounce motion-reduce:animate-none [animation-delay:300ms]" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
