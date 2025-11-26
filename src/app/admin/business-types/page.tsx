'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Settings } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function BusinessTypesPage() {
  const t = useTranslations('admin.businessTypes')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('pageTitle')}</h1>
          <p className="text-muted-foreground">
            {t('pageDescription')}
          </p>
        </div>
        <Button disabled>
          <Plus className="mr-2 h-4 w-4" />
          Create Business Type (Coming Soon)
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('managementTitle')}</CardTitle>
          <CardDescription>
            {t('managementDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Settings className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('comingSoon')}</h3>
            <p className="text-muted-foreground max-w-md">
              {t('comingSoonDescription')}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('whatAreBusinessTypes')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">{t('purpose')}</h4>
            <p className="text-sm text-muted-foreground">
              Business types help categorize customer conversations based on the nature
              of their inquiry (e.g., Sales, Support, Billing, Technical).
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-2">{t('benefits')}</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>{t('benefitsList.routing')}</li>
              <li>{t('benefitsList.analytics')}</li>
              <li>{t('benefitsList.customerExperience')}</li>
              <li>{t('benefitsList.workflow')}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">{t('plannedFeatures')}</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>{t('featuresList.createEdit')}</li>
              <li>{t('featuresList.assignTeams')}</li>
              <li>{t('featuresList.setSLA')}</li>
              <li>{t('featuresList.automatedRouting')}</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

