/**
 * Register Page
 * 
 * PUBLIC REGISTRATION IS DISABLED
 * Users must be created by administrators through the Admin Panel
 */

"use client"

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

export default function RegisterPage() {
  const t = useTranslations('auth')

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-6 w-6 text-amber-500" />
          <CardTitle className="text-2xl font-bold">{t('registerPage.title')}</CardTitle>
        </div>
        <CardDescription>
          {t('registerPage.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>{t('registerPage.policyTitle')}</strong>
          </p>
          <p className="text-sm text-amber-800 dark:text-amber-200 mt-2">
            {t('registerPage.policyDescription')}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t('registerPage.howToTitle')}</p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>{t('registerPage.step1')}</li>
            <li>{t('registerPage.step2')}</li>
            <li>{t('registerPage.step3')}</li>
            <li>{t('registerPage.step4')}</li>
          </ul>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <div className="text-sm text-center text-muted-foreground">
          {t('hasAccount')}{' '}
          <Link href="/auth/login" className="text-primary hover:underline font-medium">
            {t('loginButton')}
          </Link>
        </div>
      </CardFooter>
    </Card>
  )
}

