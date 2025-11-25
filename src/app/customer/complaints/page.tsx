'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Send, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/hooks/use-auth'
import { useTranslations } from 'next-intl'

export default function ComplaintsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const t = useTranslations('complaints')
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    category: 'service',
    severity: '2', // Medium
    title: '',
    description: '',
    contact: user?.email || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user?.email) {
      toast.error(t('loginRequired'))
      return
    }

    setLoading(true)

    try {
      // Create a ticket with "Complaint" tag and higher priority
      const ticketData = {
        conversationId: crypto.randomUUID(),
        title: `${t('ticketPrefix')} ${formData.title}`,
        group: 'Support',
        customer: user.email,
        priority_id: parseInt(formData.severity), // Use severity as priority
        article: {
          subject: formData.title,
          body: `${t('category.label')}: ${t(`category.options.${formData.category}`)}\n${t('severity.label')}: ${t(`severity.options.${formData.severity}`)}\n\n${formData.description}\n\n${t('contactField.label')}: ${formData.contact}`,
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
        throw new Error(error.error || 'Failed to submit complaint')
      }

      toast.success(t('success'))
      router.push('/customer/my-tickets')
    } catch (error: any) {
      console.error('Failed to submit complaint:', error)
      toast.error(error.message || 'Failed to submit complaint')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <h1 className="text-3xl font-bold">{t('title')}</h1>
        </div>
        <p className="text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>{t('detailsTitle')}</CardTitle>
            <CardDescription>
              {t('detailsDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">{t('category.label')}</Label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              >
                <option value="service">{t('category.options.service')}</option>
                <option value="product">{t('category.options.product')}</option>
                <option value="delivery">{t('category.options.delivery')}</option>
                <option value="billing">{t('category.options.billing')}</option>
                <option value="other">{t('category.options.other')}</option>
              </select>
            </div>

            {/* Severity */}
            <div className="space-y-2">
              <Label htmlFor="severity">{t('severity.label')}</Label>
              <select
                id="severity"
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              >
                <option value="1">{t('severity.options.1')}</option>
                <option value="2">{t('severity.options.2')}</option>
                <option value="3">{t('severity.options.3')}</option>
                <option value="4">{t('severity.options.4')}</option>
              </select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">{t('titleField.label')}</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={t('titleField.placeholder')}
                required
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">
                {t('titleField.help', { count: formData.title.length })}
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">{t('descriptionField.label')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('descriptionField.placeholder')}
                rows={8}
                required
                maxLength={1200}
              />
              <p className="text-xs text-muted-foreground">
                {t('descriptionField.help', { count: formData.description.length })}
              </p>
            </div>

            {/* Contact */}
            <div className="space-y-2">
              <Label htmlFor="contact">{t('contactField.label')}</Label>
              <Input
                id="contact"
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                placeholder={t('contactField.placeholder')}
                required
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                {t('contactField.help')}
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
              <Button type="submit" disabled={loading} variant="destructive">
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

      {/* Warning */}
      <Card className="mt-6 border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
        <CardHeader>
          <CardTitle className="text-red-900 dark:text-red-100">{t('warningsTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-red-800 dark:text-red-200 space-y-2">
          {[0, 1, 2, 3, 4].map((idx) => (
            <p key={`warning-${idx}`}>- {t(`warnings.${idx}`)}</p>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

