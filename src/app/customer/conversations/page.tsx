/**
 * Conversations Auto-Redirect Page
 *
 * Automatically creates or joins an active conversation
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useConversation } from '@/lib/hooks/use-conversation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

// Threshold for auto-creating a new conversation when user returns.
// If the user left the conversation page more than this many ms ago,
// we treat it as a "return" and start fresh. Otherwise it's a "page switch"
// and we reuse the existing conversation.
const NEW_CONVERSATION_THRESHOLD_MS = 30 * 60 * 1000 // 30 minutes

export default function ConversationsPage() {
  const t = useTranslations('customer.conversations.starting')
  const tToast = useTranslations('toast.customer.conversations')

  const router = useRouter()
  const { conversations, fetchConversations, createConversation } = useConversation()
  const [isProcessing, setIsProcessing] = useState(true)
  const [conversationsLoaded, setConversationsLoaded] = useState(false)

  // R3: Fetch conversations first and set explicit loaded flag
  useEffect(() => {
    const loadConversations = async () => {
      try {
        setIsProcessing(true)
        setConversationsLoaded(false)

        // Fetch all conversations and wait for completion
        await fetchConversations()

        // R3: Set explicit flag after fetch completes
        setConversationsLoaded(true)
      } catch (error) {
        console.error('Error fetching conversations:', error)
        toast.error(tToast('loadError'))
        setIsProcessing(false)
      }
    }

    loadConversations()
  }, [fetchConversations])

  // R3: Only run after conversations are explicitly loaded
  useEffect(() => {
    if (!conversationsLoaded || !isProcessing) return

    const handleRedirect = async () => {
      try {
        // Ensure conversations is an array
        const conversationsList = Array.isArray(conversations) ? conversations : []

        // Find an active (non-closed) conversation
        const activeConversation = conversationsList.find(
          (conv) => conv.status !== 'closed'
        )

        // Check how long the user has been away from the conversation page
        const lastVisit = sessionStorage.getItem('conversationLastVisitAt')
        const elapsed = lastVisit ? Date.now() - parseInt(lastVisit, 10) : Infinity

        if (activeConversation && elapsed < NEW_CONVERSATION_THRESHOLD_MS) {
          // Quick page switch — reuse existing conversation
          console.log('[Conversations] Reusing existing conversation:', activeConversation.id)
          router.replace(`/customer/conversations/${activeConversation.id}`)
        } else {
          // User returned after a while (or no active conversation) — start fresh
          if (activeConversation) {
            // Close the stale conversation before creating a new one
            console.log('[Conversations] Closing stale conversation:', activeConversation.id)
            await fetch(`/api/conversations/${activeConversation.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'closed' }),
            }).catch(() => {})
          }
          console.log('[Conversations] Creating new conversation')
          const newConversation = await createConversation()
          router.replace(`/customer/conversations/${newConversation.id}`)
        }
      } catch (error) {
        console.error('Error handling conversation:', error)
        toast.error(tToast('startError'))
        setIsProcessing(false)
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
              <div className="h-2 w-2 bg-primary rounded-full animate-bounce motion-reduce:animate-none" style={{ animationDelay: '0ms' }} />
              <div className="h-2 w-2 bg-primary rounded-full animate-bounce motion-reduce:animate-none" style={{ animationDelay: '150ms' }} />
              <div className="h-2 w-2 bg-primary rounded-full animate-bounce motion-reduce:animate-none" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

