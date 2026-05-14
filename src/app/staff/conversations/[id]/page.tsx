import { AiConversationPage } from '@/components/conversation/ai-conversation-page'

export default function StaffConversationDetailPage() {
  return <AiConversationPage basePath="/staff/conversations" humanMessageRole="staff" />
}
