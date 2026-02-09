import { getTranslations } from 'next-intl/server'
import { DashboardContent } from './dashboard-content'

// PPR 需要 Next.js canary 版本，暂不启用
// export const experimental_ppr = true

export default async function CustomerDashboardPage() {
  const t = await getTranslations('customer.dashboard')
  const tQuick = await getTranslations('customer.dashboard.quickActions')
  const tStart = await getTranslations('customer.dashboard.getStarted')

  // Pre-translate all strings for client component
  const translations = {
    title: t('title'),
    welcomeMessage: t('welcomeMessage'),
    quickActions: {
      liveChat: {
        title: tQuick('liveChat.title'),
        description: tQuick('liveChat.description'),
      },
      knowledgeBase: {
        title: tQuick('knowledgeBase.title'),
        description: tQuick('knowledgeBase.description'),
      },
      myTickets: {
        title: tQuick('myTickets.title'),
        description: tQuick('myTickets.description'),
      },
    },
    getStarted: {
      title: tStart('title'),
      subtitle: tStart('subtitle'),
      liveChat: {
        title: tStart('liveChat.title'),
        description: tStart('liveChat.description'),
        button: tStart('liveChat.button'),
      },
      knowledgeBase: {
        title: tStart('knowledgeBase.title'),
        description: tStart('knowledgeBase.description'),
        button: tStart('knowledgeBase.button'),
      },
      ticket: {
        title: tStart('ticket.title'),
        description: tStart('ticket.description'),
        button: tStart('ticket.button'),
      },
    },
  }

  return <DashboardContent translations={translations} />
}
