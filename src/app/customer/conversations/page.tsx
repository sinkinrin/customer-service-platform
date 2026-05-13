import { redirect } from 'next/navigation'
import { DRAFT_CONVERSATION_ID } from '@/lib/constants/conversation'

export default function ConversationsPage() {
  redirect(`/customer/conversations/${DRAFT_CONVERSATION_ID}`)
}
