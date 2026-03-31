'use client'

import { BookOpen } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { PageTransition } from '@/components/ui/page-transition'
import { useTranslations } from 'next-intl'

export default function StaffKnowledgePage() {
  const t = useTranslations('common')

  return (
    <PageTransition className="container max-w-4xl py-8">
      <h1 className="text-3xl font-bold mb-6">{t('knowledgeBase', { defaultMessage: 'Knowledge Base' })}</h1>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">{t('comingSoon', { defaultMessage: 'Coming Soon' })}</h2>
          <p className="text-muted-foreground text-center max-w-md">
            {t('comingSoonDescription', { defaultMessage: 'This feature is under development and will be available soon.' })}
          </p>
        </CardContent>
      </Card>
    </PageTransition>
  )
}
