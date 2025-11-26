import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

// Supported locales
export const locales = ['en', 'zh-CN', 'fr', 'es', 'ru', 'pt'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

export const localeNames: Record<Locale, string> = {
  en: 'English',
  'zh-CN': '简体中文',
  fr: 'Français',
  es: 'Español',
  ru: 'Русский',
  pt: 'Português',
}

export default getRequestConfig(async () => {
  // Try to get locale from NEXT_LOCALE cookie
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value as Locale | undefined

  // Validate locale and fall back to default if invalid
  let locale: Locale = defaultLocale
  if (cookieLocale && locales.includes(cookieLocale)) {
    locale = cookieLocale
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})

