/**
 * FAQ Article Detail Page
 *
 * Displays a single FAQ article with feedback
 */

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import DOMPurify from 'dompurify'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useFAQ, type FAQItem } from '@/lib/hooks/use-faq'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, ThumbsUp, ThumbsDown, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { Loading } from '@/components/common/loading'
import { Breadcrumbs } from '@/components/faq/breadcrumbs'
import { ArticleCard } from '@/components/faq/article-card'

type BreadcrumbItem = {
  label: string
  href?: string
}

export default function FAQArticlePage() {
  const params = useParams()
  const router = useRouter()
  const articleId = params.id as string
  const t = useTranslations('faq')
  const tToast = useTranslations('toast.customer.faq')
  const locale = useLocale()

  const { submitFeedback } = useFAQ()
  const [article, setArticle] = useState<FAQItem | null>(null)
  const [relatedArticles, setRelatedArticles] = useState<FAQItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  
  // Fetch article details
  useEffect(() => {
    const fetchArticle = async () => {
      setIsLoading(true)

      try {
        const response = await fetch(`/api/faq/${articleId}?language=${locale}`)

        if (!response.ok) {
          throw new Error('Failed to fetch article')
        }

        const data = await response.json()
        const fetchedArticle = data.data.item
        setArticle(fetchedArticle)

        // Fetch related articles from the same category
        if (fetchedArticle.category_id) {
          try {
            const relatedResponse = await fetch(
              `/api/faq?categoryId=${fetchedArticle.category_id}&limit=3&language=${locale}`
            )
            if (relatedResponse.ok) {
              const relatedData = await relatedResponse.json()
              // Filter out the current article
              const related = (relatedData.data?.items || []).filter(
                (item: FAQItem) => item.id !== articleId
              )
              setRelatedArticles(related.slice(0, 3))
            }
          } catch (error) {
            console.error('Error fetching related articles:', error)
          }
        }
      } catch (error) {
        console.error('Error fetching article:', error)
        toast.error(tToast('articleError'))
        router.push('/customer/faq')
      } finally {
        setIsLoading(false)
      }
    }

    if (articleId) {
      fetchArticle()
    }
  }, [articleId, router, tToast, locale])

  // Handle feedback
  const handleFeedback = async (helpful: boolean) => {
    try {
      await submitFeedback(articleId, helpful)
      setFeedbackSubmitted(true)
      toast.success(tToast('feedbackSuccess'))
    } catch (error) {
      console.error('Error submitting feedback:', error)
      toast.error(tToast('feedbackError'))
    }
  }

  if (isLoading) {
    return <Loading fullScreen text={t('loadingArticle')} />
  }
  
  if (!article) {
    return null
  }
  
  // Build breadcrumb items
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'FAQ', href: '/customer/faq' },
  ]

  if (article?.category_name) {
    const categoryHref = article.category_id
      ? `/customer/faq?categoryId=${article.category_id}`
      : undefined
    breadcrumbItems.push({ label: t(`categoryNames.${article.category_name}`, { defaultValue: article.category_name }), href: categoryHref })
  }

  if (article?.question) {
    breadcrumbItems.push({ label: article.question })
  }

  return (
    <div className="container max-w-4xl py-8">
      {/* Breadcrumbs */}
      <Breadcrumbs items={breadcrumbItems} />

      {/* Back button */}
      <Button
        variant="ghost"
        onClick={() => router.push('/customer/faq')}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        {t('backToHelpCenter')}
      </Button>
      
      {/* Article */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              {article.category_name && (
                <Badge variant="secondary" className="mb-2">
                  {t(`categoryNames.${article.category_name}`, { defaultValue: article.category_name })}
                </Badge>
              )}
              <CardTitle className="text-2xl">{article.question}</CardTitle>
            </div>
          </div>
          
          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {article.view_count !== undefined && (
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                <span>{article.view_count} {t('viewCount')}</span>
              </div>
            )}

            {article.helpful_count !== undefined && (
              <div className="flex items-center gap-1">
                <ThumbsUp className="h-4 w-4" />
                <span>{article.helpful_count} {t('helpfulCount')}</span>
              </div>
            )}
          </div>
        </CardHeader>
        
        <Separator />
        
        <CardContent className="pt-6">
          {/* Answer */}
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {article.answer}
            </ReactMarkdown>
          </div>
          
          {/* Feedback */}
          <Separator className="my-6" />

          <div className="text-center">
            <h3 className="font-semibold mb-4">{t('wasHelpful')}</h3>

            {feedbackSubmitted ? (
              <p className="text-muted-foreground">
                {t('thankYou')}
              </p>
            ) : (
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => handleFeedback(true)}
                  className="gap-2"
                >
                  <ThumbsUp className="h-4 w-4" />
                  {t('yes')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleFeedback(false)}
                  className="gap-2"
                >
                  <ThumbsDown className="h-4 w-4" />
                  {t('no')}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Related Articles */}
      {relatedArticles.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{t('relatedArticles')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {relatedArticles.map((relatedArticle) => (
              <ArticleCard
                key={relatedArticle.id}
                article={relatedArticle}
                onClick={() => router.push(`/customer/faq/${relatedArticle.id}`)}
                showCategory={false}
                showStats={true}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Contact support */}
      <Card className="mt-6">
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <h3 className="font-semibold mb-1">{t('stillNeedHelp')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('contactDescription')}
            </p>
          </div>
          <Button onClick={() => router.push('/customer/conversations')}>
            {t('contactSupport')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}


