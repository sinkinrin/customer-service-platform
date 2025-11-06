/**
 * FAQ Article Card Component
 * 
 * Displays a single FAQ item as a card
 */

'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, Eye, ThumbsUp } from 'lucide-react'
import { type FAQItem } from '@/lib/hooks/use-faq'

interface ArticleCardProps {
  article: FAQItem
  onClick?: () => void
  showCategory?: boolean
  showStats?: boolean
  searchQuery?: string
}

// Helper function to highlight search terms
function highlightText(text: string, query: string): string {
  if (!query.trim()) return text

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-900">$1</mark>')
}

export function ArticleCard({
  article,
  onClick,
  showCategory = true,
  showStats = true,
  searchQuery = '',
}: ArticleCardProps) {
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
              <Badge variant="secondary">{article.category_name}</Badge>
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
}

