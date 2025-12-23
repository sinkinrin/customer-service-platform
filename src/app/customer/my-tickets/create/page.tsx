'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Send, FileText, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/hooks/use-auth'
import { PRODUCT_CATEGORIES } from '@/lib/constants/products'

export default function CreateTicketPage() {
  const router = useRouter()
  const { user } = useAuth()
  const t = useTranslations('customer.myTickets')
  const tCreate = useTranslations('customer.myTickets.create')
  const tToast = useTranslations('toast.customer.tickets')
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    category: '',
    model: '',
    priority: '2', // Medium
    title: '',
    description: '',
  })

  const [files, setFiles] = useState<File[]>([])

  const selectedCategory = PRODUCT_CATEGORIES.find(c => c.name === formData.category)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])

    // Validate file count
    if (files.length + selectedFiles.length > 5) {
      toast.error(tToast('maxFilesExceeded'))
      return
    }

    // Validate file size (512MB each)
    const maxSize = 512 * 1024 * 1024
    const invalidFiles = selectedFiles.filter(f => f.size > maxSize)
    if (invalidFiles.length > 0) {
      toast.error(tToast('fileSizeExceeded'))
      return
    }

    setFiles([...files, ...selectedFiles])
  }

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  // Convert File to base64 for Zammad API
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        // Remove data URL prefix (e.g., "data:image/png;base64,")
        const base64 = (reader.result as string).split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user?.email) {
      toast.error(tToast('loginRequired'))
      return
    }

    if (!formData.category || !formData.model) {
      toast.error(tToast('selectProduct'))
      return
    }

    setLoading(true)

    try {
      // Create ticket data (matching API schema)
      const ticketData = {
        title: formData.title,
        group: 'Support',
        priority_id: parseInt(formData.priority),
        article: {
          subject: formData.title,
          body: `Product category: ${formData.category}\nProduct model: ${formData.model}\n\n${formData.description}`,
          type: 'web' as const,
          internal: false,
        },
      }

      // Convert files to base64 attachments for Zammad API
      let attachments: { filename: string; data: string; 'mime-type': string }[] = []
      if (files.length > 0) {
        attachments = await Promise.all(
          files.map(async (file) => ({
            filename: file.name,
            data: await fileToBase64(file),
            'mime-type': file.type || 'application/octet-stream',
          }))
        )
      }

      // Add attachments to ticket data if any
      const ticketDataWithAttachments = {
        ...ticketData,
        article: {
          ...ticketData.article,
          ...(attachments.length > 0 && { attachments }),
        },
      }

      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketDataWithAttachments),
      })

      if (!response.ok) {
        const errorData = await response.json()
        // API returns { success: false, error: { code, message } }
        const errorMessage = errorData.error?.message || errorData.error || 'Failed to create ticket'
        throw new Error(errorMessage)
      }

      const result = await response.json()
      toast.success(tToast('createSuccess'))
      router.push(`/customer/my-tickets/${result.data.ticket.id}`)
    } catch (error: any) {
      console.error('Failed to create ticket:', error)
      toast.error(error.message || tToast('createError'))
    } finally {
      setLoading(false)
    }
  }

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      '1': tCreate('priorities.1'),
      '2': tCreate('priorities.2'),
      '3': tCreate('priorities.3'),
    }
    return labels[priority] || priority
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="h-8 w-8 text-blue-500" />
          <h1 className="text-3xl font-bold">{t('createPageTitle')}</h1>
        </div>
        <p className="text-muted-foreground">{t('createPageDescription')}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>{tCreate('formTitle')}</CardTitle>
            <CardDescription>
              {tCreate('formDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Product Category */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">{tCreate('categoryLabel')}</Label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value, model: '' })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                >
                  <option value="">{tCreate('categoryPlaceholder')}</option>
                  {PRODUCT_CATEGORIES.map(cat => (
                    <option key={cat.name} value={cat.name}>
                      {cat.name === 'Other' ? tCreate('categoryOther') : cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">{tCreate('modelLabel')}</Label>
                <select
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                  disabled={!formData.category}
                >
                  <option value="">{tCreate('modelPlaceholder')}</option>
                  {selectedCategory?.models.map(model => (
                    <option key={model} value={model}>
                      {model === 'N/A' ? tCreate('modelNotApplicable') : model}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority">{tCreate('priorityLabel')}</Label>
              <select
                id="priority"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              >
                <option value="1">{getPriorityLabel('1')}</option>
                <option value="2">{getPriorityLabel('2')}</option>
                <option value="3">{getPriorityLabel('3')}</option>
              </select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">{tCreate('titleLabel')}</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={tCreate('titlePlaceholder')}
                required
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">
                {tCreate('characterCount', { count: formData.title.length, max: 200 })}
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">{tCreate('descriptionLabel')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={tCreate('descriptionPlaceholder')}
                rows={8}
                required
                maxLength={1200}
              />
              <p className="text-xs text-muted-foreground">
                {tCreate('characterCount', { count: formData.description.length, max: 1200 })}
              </p>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label htmlFor="files">{tCreate('attachmentsLabel')}</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    id="files"
                    type="file"
                    onChange={handleFileChange}
                    multiple
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('files')?.click()}
                    disabled={files.length >= 5}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {tCreate('selectFiles')}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {tCreate('fileSizeLimit')}
                  </span>
                </div>

                {files.length > 0 && (
                  <div className="space-y-2">
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <span className="text-sm truncate flex-1">{file.name}</span>
                        <span className="text-xs text-muted-foreground mx-2">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
              >
                {tCreate('actions.cancel')}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {tCreate('actions.submitting')}
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    {tCreate('actions.submit')}
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
          <CardTitle className="text-blue-900 dark:text-blue-100">{tCreate('tips.title')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
          <p>{tCreate('tips.tip1')}</p>
          <p>{tCreate('tips.tip2')}</p>
          <p>{tCreate('tips.tip3')}</p>
          <p>{tCreate('tips.tip4')}</p>
        </CardContent>
      </Card>
    </div>
  )
}

