'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageTransition } from '@/components/ui/page-transition'
import { MessageSquare, FileText, HelpCircle, MessageCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function CustomerDashboardPage() {
  const t = useTranslations('customer.dashboard')
  const tQuick = useTranslations('customer.dashboard.quickActions')
  const tStart = useTranslations('customer.dashboard.getStarted')

  const router = useRouter()

  const quickActions = [
    {
      titleKey: 'liveChat.title',
      descriptionKey: 'liveChat.description',
      icon: MessageSquare,
      action: () => router.push('/customer/conversations'),
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      titleKey: 'knowledgeBase.title',
      descriptionKey: 'knowledgeBase.description',
      icon: HelpCircle,
      action: () => router.push('/customer/faq'),
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      titleKey: 'myTickets.title',
      descriptionKey: 'myTickets.description',
      icon: FileText,
      action: () => router.push('/customer/my-tickets'),
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      titleKey: 'submitFeedback.title',
      descriptionKey: 'submitFeedback.description',
      icon: MessageCircle,
      action: () => router.push('/customer/feedback'),
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ]

  return (
    <PageTransition className="container max-w-6xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('welcomeMessage')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {quickActions.map((action) => {
          const Icon = action.icon
          return (
            <Card
              key={action.titleKey}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={action.action}
            >
              <CardHeader>
                <div className={`w-12 h-12 rounded-lg ${action.bgColor} flex items-center justify-center mb-4`}>
                  <Icon className={`h-6 w-6 ${action.color}`} />
                </div>
                <CardTitle className="text-lg">{tQuick(action.titleKey)}</CardTitle>
                <CardDescription>{tQuick(action.descriptionKey)}</CardDescription>
              </CardHeader>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tStart('title')}</CardTitle>
          <CardDescription>{tStart('subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start space-x-4">
            <div className={`w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0`}>
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">{tStart('liveChat.title')}</h3>
              <p className="text-sm text-muted-foreground mb-2">
                {tStart('liveChat.description')}
              </p>
              <Button onClick={() => router.push('/customer/conversations')} size="sm">
                {tStart('liveChat.button')}
              </Button>
            </div>
          </div>

          <div className="flex items-start space-x-4">
            <div className={`w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0`}>
              <HelpCircle className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">{tStart('knowledgeBase.title')}</h3>
              <p className="text-sm text-muted-foreground mb-2">
                {tStart('knowledgeBase.description')}
              </p>
              <Button onClick={() => router.push('/customer/faq')} variant="outline" size="sm">
                {tStart('knowledgeBase.button')}
              </Button>
            </div>
          </div>

          <div className="flex items-start space-x-4">
            <div className={`w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0`}>
              <FileText className="h-5 w-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">{tStart('ticket.title')}</h3>
              <p className="text-sm text-muted-foreground mb-2">
                {tStart('ticket.description')}
              </p>
              <Button onClick={() => router.push('/customer/my-tickets/create')} variant="outline" size="sm">
                {tStart('ticket.button')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageTransition>
  )
}
