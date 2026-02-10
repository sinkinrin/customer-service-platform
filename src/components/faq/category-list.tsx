/**
 * FAQ Category List Component
 * 
 * Displays list of FAQ categories
 */

'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  ChevronRight,
  Folder,
  HelpCircle,
  Settings,
  CreditCard,
  Shield,
  Users,
  FileText,
  Zap,
  Globe
} from 'lucide-react'
import { type FAQCategory } from '@/lib/hooks/use-faq'
import { useTranslations } from 'next-intl'

// Category icon mapping
const categoryIcons: Record<string, any> = {
  'general': HelpCircle,
  'account': Users,
  'billing': CreditCard,
  'security': Shield,
  'settings': Settings,
  'documentation': FileText,
  'features': Zap,
  'international': Globe,
}

function getCategoryIcon(categoryName: string) {
  const name = categoryName.toLowerCase()
  for (const [key, Icon] of Object.entries(categoryIcons)) {
    if (name.includes(key)) {
      return Icon
    }
  }
  return Folder
}

interface CategoryListProps {
  categories: FAQCategory[]
  selectedCategory?: string | null
  onSelectCategory: (categoryId: string | null) => void
  isLoading?: boolean
  categoryCounts?: Record<string, number>
}

export function CategoryList({
  categories,
  selectedCategory,
  onSelectCategory,
  isLoading = false,
  categoryCounts = {},
}: CategoryListProps) {
  const t = useTranslations('faq')
  const totalCount = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0)

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }
  
  if (categories.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Folder className="h-12 w-12 text-muted-foreground mb-2" />
          <p className="text-muted-foreground">{t('noCategoriesAvailable')}</p>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <div className="space-y-2">
      {/* All Categories option */}
      <Card
        className={`cursor-pointer transition-colors ${
          !selectedCategory
            ? 'border-primary bg-primary/5'
            : 'hover:bg-accent'
        }`}
        onClick={() => onSelectCategory(null)}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Folder className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{t('allCategories')}</h3>
                {totalCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {totalCount}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {t('browseAllFaqItems')}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
      
      {/* Category items */}
      {categories.map((category) => {
        const Icon = getCategoryIcon(category.name)
        const count = categoryCounts[category.id] || 0

        return (
          <Card
            key={category.id}
            className={`cursor-pointer transition-colors ${
              selectedCategory === category.id
                ? 'border-primary bg-primary/5'
                : 'hover:bg-accent'
            }`}
            onClick={() => onSelectCategory(category.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  selectedCategory === category.id ? 'bg-primary/10' : 'bg-muted'
                }`}>
                  <Icon className={`h-5 w-5 ${
                    selectedCategory === category.id ? 'text-primary' : 'text-muted-foreground'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{t(`categoryNames.${category.name}`, { defaultValue: category.name })}</h3>
                    {count > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {count}
                      </Badge>
                    )}
                  </div>
                  {category.description && (
                    <p className="text-sm text-muted-foreground truncate">
                      {t(`categoryDescriptions.${category.name}`, { defaultValue: category.description })}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

