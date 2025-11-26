/**
 * FAQ Breadcrumbs Component
 * 
 * Displays navigation breadcrumbs for FAQ pages
 */

'use client'

import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const t = useTranslations('faq')

  return (
    <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
      <Link
        href="/"
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <Home className="h-4 w-4" />
        <span>{t('home')}</span>
      </Link>
      
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <ChevronRight className="h-4 w-4" />
          {item.href ? (
            <Link 
              href={item.href}
              className="hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  )
}

