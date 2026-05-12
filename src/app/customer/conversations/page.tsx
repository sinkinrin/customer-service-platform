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
import { useAuth } from '@/lib/hooks/use-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { getConversationJustCreatedKey } from '@/lib/constants/conversation'

export default function ConversationsPage() {
  const t = useTranslations('customer.conversations.starting')
  const tToast = useTranslations('toast.customer.conversations')

  const router = useRouter()
  const { user, isLoading: isAuthLoading } = useAuth()
  const { createConversation } = useConversation()
  const [isProcessing, setIsProcessing] = useState(true)
  const hasRedirected = useRef(false)

  useEffect(() => {
    if (!isProcessing) return
    if (isAuthLoading) return
    if (!user) {
      setIsProcessing(false)
      return
    }
    // Guard against double execution (conversations change triggers re-run)
    if (hasRedirected.current) return
    hasRedirected.current = true

    const handleRedirect = async () => {
      try {
        const newConversation = await createConversation()
        try {
          sessionStorage.setItem(getConversationJustCreatedKey(user.id), newConversation.id)
        } catch {
          // sessionStorage may be unavailable in restricted browser contexts.
        }
        router.replace(`/customer/conversations/${newConversation.id}?new=1`)
      } catch (error) {
        console.error('Error handling conversation:', error)
        toast.error(tToast('startError'))
        setIsProcessing(false)
        hasRedirected.current = false // allow retry on error
      }
    }

    handleRedirect()
  }, [isProcessing, isAuthLoading, router, createConversation, user, tToast])

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
