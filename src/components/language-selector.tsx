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

// Simplified language configuration
const locales = ['en', 'zh-CN', 'fr', 'es', 'ru', 'pt'] as const
type Locale = (typeof locales)[number]

const localeNames: Record<Locale, string> = {
  en: 'English',
  'zh-CN': '简体中文',
  fr: 'Français',
  es: 'Español',
  ru: 'Русский',
  pt: 'Português',
}

export function LanguageSelector() {
  const [locale, setLocale] = useState<Locale>('en')

  useEffect(() => {
    // Load saved preference from localStorage
    const saved = localStorage.getItem('preferred-locale') as Locale
    if (saved && locales.includes(saved)) {
      setLocale(saved)
    }
  }, [])

  const handleLanguageChange = (newLocale: Locale) => {
    // Save preference to localStorage
    localStorage.setItem('preferred-locale', newLocale)
    setLocale(newLocale)

    // In a full implementation, this would trigger a re-render with new translations
    // For now, we just save the preference
    console.log(`Language changed to: ${newLocale}`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="hidden sm:flex gap-2">
          <Globe className="h-4 w-4" />
          <span className="uppercase">{locale === 'zh-CN' ? 'ZH' : locale.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Select Language</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => handleLanguageChange(loc)}
            className={locale === loc ? 'bg-accent' : ''}
          >
            {localeNames[loc]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

