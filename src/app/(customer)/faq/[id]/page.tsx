/**
 * FAQ Article Detail Page
 * 
 * Displays a single FAQ article with feedback
 */

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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

export default function FAQArticlePage() {
  const params = useParams()
  const router = useRouter()
  const articleId = params.id as string
  
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
        const response = await fetch(`/api/faq/${articleId}`)

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
              `/api/faq?categoryId=${fetchedArticle.category_id}&limit=3&language=zh-CN`
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
        toast.error('Failed to load article')
        router.push('/faq')
      } finally {
        setIsLoading(false)
      }
    }

    if (articleId) {
      fetchArticle()
    }
  }, [articleId, router])
  
  // Handle feedback
  const handleFeedback = async (helpful: boolean) => {
    try {
      await submitFeedback(articleId, helpful)
      setFeedbackSubmitted(true)
      toast.success('Thank you for your feedback!')
    } catch (error) {
      console.error('Error submitting feedback:', error)
      toast.error('Failed to submit feedback')
    }
  }
  
  if (isLoading) {
    return <Loading fullScreen text="Loading article..." />
  }
  
  if (!article) {
    return null
  }
  
  // Build breadcrumb items
  const breadcrumbItems = [
    { label: 'FAQ', href: '/faq' },
  ]

  if (article?.category_name) {
    breadcrumbItems.push({ label: article.category_name })
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
        onClick={() => router.push('/faq')}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Help Center
      </Button>
      
      {/* Article */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              {article.category_name && (
                <Badge variant="secondary" className="mb-2">
                  {article.category_name}
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
                <span>{article.view_count} views</span>
              </div>
            )}
            
            {article.helpful_count !== undefined && (
              <div className="flex items-center gap-1">
                <ThumbsUp className="h-4 w-4" />
                <span>{article.helpful_count} helpful</span>
              </div>
            )}
          </div>
        </CardHeader>
        
        <Separator />
        
        <CardContent className="pt-6">
          {/* Answer */}
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <div
              dangerouslySetInnerHTML={{ __html: article.answer }}
              className="whitespace-pre-wrap"
            />
          </div>
          
          {/* Feedback */}
          <Separator className="my-6" />
          
          <div className="text-center">
            <h3 className="font-semibold mb-4">Was this article helpful?</h3>
            
            {feedbackSubmitted ? (
              <p className="text-muted-foreground">
                Thank you for your feedback!
              </p>
            ) : (
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => handleFeedback(true)}
                  className="gap-2"
                >
                  <ThumbsUp className="h-4 w-4" />
                  Yes
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleFeedback(false)}
                  className="gap-2"
                >
                  <ThumbsDown className="h-4 w-4" />
                  No
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
            <CardTitle>Related Articles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {relatedArticles.map((relatedArticle) => (
              <ArticleCard
                key={relatedArticle.id}
                article={relatedArticle}
                onClick={() => router.push(`/faq/${relatedArticle.id}`)}
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
            <h3 className="font-semibold mb-1">Still need help?</h3>
            <p className="text-sm text-muted-foreground">
              Contact our support team for personalized assistance
            </p>
          </div>
          <Button onClick={() => router.push('/conversations')}>
            Contact Support
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}


