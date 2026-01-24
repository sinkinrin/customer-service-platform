'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/use-auth'
import { getDefaultRouteForRole } from '@/lib/utils/route-helpers'
import { Hero } from '@/components/landing/hero'
import { Features } from '@/components/landing/features'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import { Logo } from '@/components/ui/logo'
import { LanguageSelector } from '@/components/language-selector'

export default function HomePage() {
  const router = useRouter()
  const { user, userRole } = useAuth()
  const t = useTranslations('landing')

  // Auto-redirect authenticated users to their dashboard
  useEffect(() => {
    if (user && userRole) {
      const defaultRoute = getDefaultRouteForRole(userRole)
      router.replace(defaultRoute)
    }
  }, [user, userRole, router])

  // Don't render landing page if user is authenticated (will redirect)
  if (user && userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <div className="animate-spin motion-reduce:animate-none h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          <h2 className="text-xl font-semibold text-slate-900">{t('loading.title')}</h2>
          <p className="text-sm text-slate-500">{t('loading.verifying')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl text-slate-900">
            <Logo size="md" />
            {t('brand')}
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="#features" className="hover:text-blue-600 transition-colors">{t('nav.features')}</Link>
            <Link href="/customer/faq" className="hover:text-blue-600 transition-colors">{t('nav.faq')}</Link>
          </nav>
          <div className="flex items-center gap-4">
            <LanguageSelector />
            <Link href="/auth/login" className="text-sm font-medium text-slate-600 hover:text-blue-600 hidden sm:block">
              {t('nav.login')}
            </Link>
            <Link href="/auth/login">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                {t('nav.getStarted')}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Hero />
        <div id="features">
          <Features />
        </div>

        {/* CTA Section */}
        <section className="py-20 bg-slate-900 text-white">
          <div className="container px-4 mx-auto text-center max-w-3xl">
            <h2 className="text-3xl font-bold mb-6">{t('cta.title')}</h2>
            <p className="text-slate-300 mb-8 text-lg">
              {t('cta.description')}
            </p>
            <Link href="/auth/login">
              <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100 px-8 h-12 font-semibold">
                {t('cta.button')}
              </Button>
            </Link>
            <p className="mt-4 text-sm text-slate-400">{t('cta.learnMore')}</p>
          </div>
        </section>
      </main>

      <footer className="py-12 bg-slate-50 border-t border-slate-200">
        <div className="container px-4 mx-auto text-center text-slate-500 text-sm">
          <p>{t('footer.copyright')}</p>
        </div>
      </footer>
    </div>
  )
}
