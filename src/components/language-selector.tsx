'use client'

import { useState, useEffect } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Globe } from 'lucide-react'
import { useTranslations } from 'next-intl'

// Simplified language configuration
const locales = ['en', 'zh-CN', 'fr', 'es', 'ru', 'pt'] as const
type Locale = (typeof locales)[number]

export function LanguageSelector() {
  const tCommon = useTranslations('common.localeNames')
  const tSettings = useTranslations('settings')
  const [locale, setLocale] = useState<Locale>('en')

  useEffect(() => {
    // Load saved preference from localStorage
    const saved = localStorage.getItem('preferred-locale') as Locale
    if (saved && locales.includes(saved)) {
      setLocale(saved)
    }
  }, [])

  const handleLanguageChange = (newLocale: Locale) => {
    // Save preference to localStorage and cookie
    localStorage.setItem('preferred-locale', newLocale)
    // Set cookie for server-side locale detection (next-intl uses NEXT_LOCALE cookie)
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000`
    setLocale(newLocale)

    console.log(`Language changed to: ${newLocale}`)
    // Reload page to apply new locale
    window.location.reload()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="flex gap-2">
          <Globe className="h-4 w-4" />
          <span className="uppercase">{locale === 'zh-CN' ? 'ZH' : locale.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{tSettings('selectLanguage')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => handleLanguageChange(loc)}
            className={locale === loc ? 'bg-accent' : ''}
          >
            {tCommon(loc)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

