/**
 * FAQ Article Card Component
 *
 * Displays a single FAQ item as a card with React.memo optimization
 */

'use client'

import { memo } from 'react'
import DOMPurify from 'dompurify'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, Eye, ThumbsUp } from 'lucide-react'
import { type FAQItem } from '@/lib/hooks/use-faq'
import { useTranslations } from 'next-intl'

interface ArticleCardProps {
  article: FAQItem
  onClick?: () => void
  showCategory?: boolean
  showStats?: boolean
  searchQuery?: string
}

// Helper function to highlight search terms with XSS protection
function highlightText(text: string | undefined, query: string): string {
  if (!text || !query.trim()) {
    // Sanitize even if no query to prevent XSS from raw content
    return DOMPurify.sanitize(text || '')
  }

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const highlighted = text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-900">$1</mark>')

  // Sanitize the final HTML to prevent XSS while preserving <mark> tags
  return DOMPurify.sanitize(highlighted, {
    ALLOWED_TAGS: ['mark'],
    ALLOWED_ATTR: ['class']
  })
}

// PERFORMANCE: React.memo prevents unnecessary re-renders
export const ArticleCard = memo(function ArticleCard({
  article,
  onClick,
  showCategory = true,
  showStats = true,
  searchQuery = '',
}: ArticleCardProps) {
  const t = useTranslations('faq')
  const highlightedQuestion = highlightText(article.question, searchQuery)
  const highlightedAnswer = highlightText(article.answer, searchQuery)

  return (
    <Card
      className={`${onClick ? 'cursor-pointer hover:bg-accent transition-colors' : ''}`}
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base line-clamp-2">
              <span dangerouslySetInnerHTML={{ __html: highlightedQuestion }} />
            </CardTitle>
            <CardDescription className="line-clamp-2 mt-1">
              <span dangerouslySetInnerHTML={{ __html: highlightedAnswer }} />
            </CardDescription>
          </div>
          {onClick && (
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          )}
        </div>
      </CardHeader>
      
      {(showCategory || showStats) && (
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {showCategory && article.category_name && (
              <Badge variant="secondary">{t(`categoryNames.${article.category_name}`, { defaultValue: article.category_name })}</Badge>
            )}
            
            {showStats && (
              <div className="flex items-center gap-4">
                {article.view_count !== undefined && (
                  <div className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    <span>{article.view_count}</span>
                  </div>
                )}
                
                {article.helpful_count !== undefined && (
                  <div className="flex items-center gap-1">
                    <ThumbsUp className="h-4 w-4" />
                    <span>{article.helpful_count}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
})

