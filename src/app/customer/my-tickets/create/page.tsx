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
  const tTemplate = useTranslations('customer.myTickets.create.template')
  const tToast = useTranslations('toast.customer.tickets')
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    category: '',
    model: '',
    version: '',
    snImei: '', // Optional
    platform: '',
    priority: '2', // Medium
    title: '',
    issueDescription: '', // 问题描述与现象
    testEnvironment: '', // 测试环境（测试版本号与MCU版本号、设备组合）
    quantityAndProbability: '', // 出现数量与概率（设备总数与出现问题设备）
    reproductionSteps: '', // 复现步骤
    expectedResult: '', // 预期结果
    actualResult: '', // 实际结果
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
      // Build structured ticket body from template fields
      const ticketBody = `【${tTemplate('productInfo')}】
${tTemplate('model')}: ${formData.category} - ${formData.model}
${tTemplate('version')}: ${formData.version || 'N/A'}
${tTemplate('snImei')}: ${formData.snImei || 'N/A'}
${tTemplate('platform')}: ${formData.platform}

【${tTemplate('issueDescription')}】
${formData.issueDescription}

【${tTemplate('testEnvironment')}】
${formData.testEnvironment}

【${tTemplate('quantityAndProbability')}】
${formData.quantityAndProbability}

【${tTemplate('reproductionSteps')}】
${formData.reproductionSteps}

【${tTemplate('expectedResult')}】
${formData.expectedResult}

【${tTemplate('actualResult')}】
${formData.actualResult}`

      // Create ticket data (matching API schema)
      const ticketData = {
        title: formData.title,
        group: 'Support',
        priority_id: parseInt(formData.priority),
        article: {
          subject: formData.title,
          body: ticketBody,
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
    <div className="container mx-auto py-4 max-w-4xl">
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-6 w-6 text-blue-500" />
          <h1 className="text-2xl font-bold">{t('createPageTitle')}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t('createPageDescription')}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">{tCreate('formTitle')}</CardTitle>
            <CardDescription className="text-sm">
              {tCreate('formDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Product Category & Model & Priority */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="category" className="text-sm">{tCreate('categoryLabel')}</Label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value, model: '' })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

              <div className="space-y-1">
                <Label htmlFor="model" className="text-sm">{tCreate('modelLabel')}</Label>
                <select
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

              <div className="space-y-1">
                <Label htmlFor="priority" className="text-sm">{tCreate('priorityLabel')}</Label>
                <select
                  id="priority"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                >
                  <option value="1">{getPriorityLabel('1')}</option>
                  <option value="2">{getPriorityLabel('2')}</option>
                  <option value="3">{getPriorityLabel('3')}</option>
                </select>
              </div>
            </div>

            {/* Version, SN/IMEI, Platform */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="version" className="text-sm">{tCreate('versionLabel')}</Label>
                <Input
                  id="version"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  placeholder={tCreate('versionPlaceholder')}
                  maxLength={50}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="snImei" className="text-sm">{tCreate('snImeiLabel')}</Label>
                <Input
                  id="snImei"
                  value={formData.snImei}
                  onChange={(e) => setFormData({ ...formData, snImei: e.target.value })}
                  placeholder={tCreate('snImeiPlaceholder')}
                  maxLength={50}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="platform" className="text-sm">{tCreate('platformLabel')}</Label>
                <Input
                  id="platform"
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                  placeholder={tCreate('platformPlaceholder')}
                  required
                  maxLength={100}
                  className="h-9"
                />
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1">
              <Label htmlFor="title" className="text-sm">{tCreate('titleLabel')}</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={tCreate('titlePlaceholder')}
                required
                maxLength={200}
                className="h-9"
              />
            </div>

            {/* Issue Description & Test Environment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="issueDescription" className="text-sm">{tCreate('issueDescriptionLabel')}</Label>
                <Textarea
                  id="issueDescription"
                  value={formData.issueDescription}
                  onChange={(e) => setFormData({ ...formData, issueDescription: e.target.value })}
                  placeholder={tCreate('issueDescriptionPlaceholder')}
                  rows={3}
                  required
                  maxLength={1000}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="testEnvironment" className="text-sm">{tCreate('testEnvironmentLabel')}</Label>
                <Textarea
                  id="testEnvironment"
                  value={formData.testEnvironment}
                  onChange={(e) => setFormData({ ...formData, testEnvironment: e.target.value })}
                  placeholder={tCreate('testEnvironmentPlaceholder')}
                  rows={3}
                  required
                  maxLength={500}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Quantity/Probability & Reproduction Steps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="quantityAndProbability" className="text-sm">{tCreate('quantityAndProbabilityLabel')}</Label>
                <Textarea
                  id="quantityAndProbability"
                  value={formData.quantityAndProbability}
                  onChange={(e) => setFormData({ ...formData, quantityAndProbability: e.target.value })}
                  placeholder={tCreate('quantityAndProbabilityPlaceholder')}
                  rows={2}
                  required
                  maxLength={300}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="reproductionSteps" className="text-sm">{tCreate('reproductionStepsLabel')}</Label>
                <Textarea
                  id="reproductionSteps"
                  value={formData.reproductionSteps}
                  onChange={(e) => setFormData({ ...formData, reproductionSteps: e.target.value })}
                  placeholder={tCreate('reproductionStepsPlaceholder')}
                  rows={2}
                  required
                  maxLength={1000}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Expected vs Actual Results */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="expectedResult" className="text-sm">{tCreate('expectedResultLabel')}</Label>
                <Textarea
                  id="expectedResult"
                  value={formData.expectedResult}
                  onChange={(e) => setFormData({ ...formData, expectedResult: e.target.value })}
                  placeholder={tCreate('expectedResultPlaceholder')}
                  rows={2}
                  required
                  maxLength={500}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="actualResult" className="text-sm">{tCreate('actualResultLabel')}</Label>
                <Textarea
                  id="actualResult"
                  value={formData.actualResult}
                  onChange={(e) => setFormData({ ...formData, actualResult: e.target.value })}
                  placeholder={tCreate('actualResultPlaceholder')}
                  rows={2}
                  required
                  maxLength={500}
                  className="text-sm"
                />
              </div>
            </div>

            {/* File Upload */}
            <div className="space-y-1">
              <Label htmlFor="files" className="text-sm">{tCreate('attachmentsLabel')}</Label>
              <div className="flex items-center gap-2 flex-wrap">
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
                  size="sm"
                  onClick={() => document.getElementById('files')?.click()}
                  disabled={files.length >= 5}
                >
                  <Upload className="mr-1 h-3 w-3" />
                  {tCreate('selectFiles')}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {tCreate('fileSizeLimit')}
                </span>
              </div>

              {files.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center gap-1 px-2 py-1 border rounded text-xs bg-muted">
                      <span className="truncate max-w-[150px]">{file.name}</span>
                      <span className="text-muted-foreground">
                        ({(file.size / 1024 / 1024).toFixed(1)}MB)
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.back()}
                disabled={loading}
              >
                {tCreate('actions.cancel')}
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    {tCreate('actions.submitting')}
                  </>
                ) : (
                  <>
                    <Send className="mr-1 h-3 w-3" />
                    {tCreate('actions.submit')}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Tips - more compact */}
      <Card className="mt-4 border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
        <CardContent className="py-3 px-4">
          <p className="font-medium text-sm text-blue-900 dark:text-blue-100 mb-1">{tCreate('tips.title')}</p>
          <div className="text-xs text-blue-800 dark:text-blue-200 space-y-0.5">
            <p>{tCreate('tips.tip1')}</p>
            <p>{tCreate('tips.tip2')}</p>
            <p>{tCreate('tips.tip3')}</p>
            <p>{tCreate('tips.tip4')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

