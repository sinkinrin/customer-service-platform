/**
 * Auth Layout
 *
 * Layout for authentication pages (login, register, etc.)
 */

import { ReactNode } from 'react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('auth.layout')
  const tCommon = await getTranslations('common')

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <Link href="/" className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">{t('brandShort')}</span>
            </div>
            <span className="font-semibold text-lg">{t('brandName')}</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} {tCommon('appName')}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

