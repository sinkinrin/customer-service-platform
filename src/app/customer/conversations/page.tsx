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

        if (activeConversation) {
          // R3: Reuse existing active conversation
          console.log('[Conversations] Reusing existing conversation:', activeConversation.id)
          router.replace(`/customer/conversations/${activeConversation.id}`)
        } else {
          // R3: Only create new conversation if no active one exists
          console.log('[Conversations] No active conversation found, creating new one')
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

