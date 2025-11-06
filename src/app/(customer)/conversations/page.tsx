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

export default function ConversationsPage() {
  const router = useRouter()
  const { conversations, fetchConversations, createConversation } = useConversation()
  const [isProcessing, setIsProcessing] = useState(true)

  useEffect(() => {
    const autoJoinOrCreate = async () => {
      try {
        setIsProcessing(true)

        // Fetch all conversations
        await fetchConversations()

        // Wait a bit for state to update
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.error('Error fetching conversations:', error)
        toast.error('Failed to load conversations')
        setIsProcessing(false)
      }
    }

    autoJoinOrCreate()
  }, [fetchConversations])

  // After conversations are loaded, check for active conversation
  useEffect(() => {
    if (!isProcessing || !conversations) return

    const handleRedirect = async () => {
      try {
        // Ensure conversations is an array
        const conversationsList = Array.isArray(conversations) ? conversations : []

        // Find an active (non-closed) conversation
        const activeConversation = conversationsList.find(
          (conv) => conv.status !== 'closed'
        )

        if (activeConversation) {
          // Join existing active conversation
          router.replace(`/conversations/${activeConversation.id}`)
        } else {
          // Create new conversation
          const newConversation = await createConversation()
          router.replace(`/conversations/${newConversation.id}`)
        }
      } catch (error) {
        console.error('Error handling conversation:', error)
        toast.error('Failed to start conversation')
        setIsProcessing(false)
      }
    }

    handleRedirect()
  }, [conversations, isProcessing, router, createConversation])

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-8 w-8 text-primary animate-pulse" />
            </div>
          </div>
          <CardTitle className="text-center">Starting Conversation</CardTitle>
          <CardDescription className="text-center">
            {isProcessing
              ? 'Please wait while we connect you to support...'
              : 'Redirecting to your conversation...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center">
            <div className="flex space-x-2">
              <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

