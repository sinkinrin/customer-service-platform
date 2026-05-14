import { redirect } from 'next/navigation'
import { DRAFT_CONVERSATION_ID } from '@/lib/constants/conversation'

export default function StaffConversationsPage() {
  redirect(`/staff/conversations/${DRAFT_CONVERSATION_ID}`)
}
