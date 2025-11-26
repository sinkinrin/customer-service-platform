'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Send, Lightbulb } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/hooks/use-auth'

export default function FeedbackPage() {
  const router = useRouter()
  const { user } = useAuth()
  const t = useTranslations('customer.feedback')
  const tToast = useTranslations('toast.customer.feedback')
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    category: 'feature',
    title: '',
    description: '',
    contact: user?.email || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user?.email) {
      toast.error(tToast('loginRequired'))
      return
    }

    setLoading(true)

    try {
      // Create a ticket with "Feedback" tag
      const ticketData = {
        conversationId: crypto.randomUUID(),
        title: `[Feedback] ${formData.title}`,
        group: 'Support',
        customer: user.email,
        priority_id: 1, // Low priority for feedback
        article: {
          subject: formData.title,
          body: `Category: ${getCategoryLabel(formData.category)}\n\n${formData.description}\n\nContact: ${formData.contact}`,
          type: 'web' as const,
          internal: false,
        },
      }

      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit feedback')
      }

      toast.success(tToast('submitSuccess'))
      router.push('/customer/my-tickets')
    } catch (error: any) {
      console.error('Failed to submit feedback:', error)
      toast.error(error.message || tToast('submitError'))
    } finally {
      setLoading(false)
    }
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      feature: t('categories.feature'),
      improvement: t('categories.improvement'),
      ui: t('categories.ui'),
      other: t('categories.other'),
    }
    return labels[category] || category
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Lightbulb className="h-8 w-8 text-yellow-500" />
          <h1 className="text-3xl font-bold">{t('pageTitle')}</h1>
        </div>
        <p className="text-muted-foreground">
          {t('pageDescription')}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>{t('formTitle')}</CardTitle>
            <CardDescription>
              {t('formDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">{t('categoryLabel')}</Label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              >
                <option value="feature">{t('categories.feature')}</option>
                <option value="improvement">{t('categories.improvement')}</option>
                <option value="ui">{t('categories.ui')}</option>
                <option value="other">{t('categories.other')}</option>
              </select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">{t('titleLabel')}</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={t('titlePlaceholder')}
                required
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">
                {t('characterCount', { count: formData.title.length, max: 200 })}
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">{t('descriptionLabel')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('descriptionPlaceholder')}
                rows={8}
                required
                maxLength={1200}
              />
              <p className="text-xs text-muted-foreground">
                {t('characterCount', { count: formData.description.length, max: 1200 })}
              </p>
            </div>

            {/* Contact */}
            <div className="space-y-2">
              <Label htmlFor="contact">{t('contactLabel')}</Label>
              <Input
                id="contact"
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                placeholder={t('contactPlaceholder')}
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                {t('contactHelp')}
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
              >
                {t('actions.cancel')}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('actions.submitting')}
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    {t('actions.submit')}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Tips */}
      <Card className="mt-6 border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
        <CardHeader>
          <CardTitle className="text-blue-900 dark:text-blue-100">{t('tips.title')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
          <p>{t('tips.tip1')}</p>
          <p>{t('tips.tip2')}</p>
          <p>{t('tips.tip3')}</p>
          <p>{t('tips.tip4')}</p>
        </CardContent>
      </Card>
    </div>
  )
}

