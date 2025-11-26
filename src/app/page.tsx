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
            <div className="h-8 w-8 bg-blue-600 rounded flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" /></svg>
            </div>
            {t('brand')}
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="#" className="hover:text-blue-600 transition-colors">{t('nav.solutions')}</Link>
            <Link href="#" className="hover:text-blue-600 transition-colors">{t('nav.pricing')}</Link>
            <Link href="#" className="hover:text-blue-600 transition-colors">{t('nav.resources')}</Link>
            <Link href="#" className="hover:text-blue-600 transition-colors">{t('nav.company')}</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/auth/login" className="text-sm font-medium text-slate-600 hover:text-blue-600 hidden sm:block">
              {t('nav.login')}
            </Link>
            <Link href="/auth/register">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                {t('nav.getStarted')}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Hero />
        <Features />

        {/* CTA Section */}
        <section className="py-20 bg-slate-900 text-white">
          <div className="container px-4 mx-auto text-center max-w-3xl">
            <h2 className="text-3xl font-bold mb-6">{t('cta.title')}</h2>
            <p className="text-slate-300 mb-8 text-lg">
              {t('cta.description')}
            </p>
            <Link href="/auth/register">
              <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100 px-8 h-12 font-semibold">
                {t('cta.button')}
              </Button>
            </Link>
            <p className="mt-4 text-sm text-slate-400">{t('cta.noCreditCard')}</p>
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
