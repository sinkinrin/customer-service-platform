'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Send, FileText, Upload, X, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/hooks/use-auth'
import { PRODUCT_CATEGORIES } from '@/lib/constants/products'
import { ATTACHMENT_LIMITS, FILE_ACCEPT, formatFileSize } from '@/lib/constants/attachments'
import { useFileUpload } from '@/lib/hooks/use-file-upload'

export default function CreateTicketPage() {
  const router = useRouter()
  const { user } = useAuth()
  const t = useTranslations('customer.myTickets')
  const tCreate = useTranslations('customer.myTickets.create')
  const tTemplate = useTranslations('customer.myTickets.create.template')
  const tToast = useTranslations('toast.customer.tickets')

  // Define schema with translations
  const formSchema = z.object({
    category: z.string().min(1, { message: tCreate('validation.required') }),
    model: z.string().min(1, { message: tCreate('validation.required') }),
    version: z.string().optional(),
    snImei: z.string().optional(),
    platform: z.string().min(1, { message: tCreate('validation.required') }),
    priority: z.string(),
    title: z.string().min(1, { message: tCreate('validation.required') }).max(200),
    issueDescription: z.string().min(1, { message: tCreate('validation.required') }).max(1000),
    testEnvironment: z.string().min(1, { message: tCreate('validation.required') }).max(500),
    quantityAndProbability: z.string().min(1, { message: tCreate('validation.required') }).max(300),
    reproductionSteps: z.string().max(1000), // Optional
    expectedResult: z.string().max(500),     // Optional
    actualResult: z.string().max(500),       // Optional
  })

  type FormValues = z.infer<typeof formSchema>

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: '',
      model: '',
      version: '',
      snImei: '',
      platform: '',
      priority: '2', // Medium
      title: '',
      issueDescription: '',
      testEnvironment: '',
      quantityAndProbability: '',
      reproductionSteps: '',
      expectedResult: '',
      actualResult: '',
    },
  })

  // Watch category to filter models
  const selectedCategoryName = form.watch('category')
  const selectedCategory = PRODUCT_CATEGORIES.find(c => c.name === selectedCategoryName)

  // Reset model when category changes
  useEffect(() => {
    const currentModel = form.getValues('model')
    if (selectedCategoryName && currentModel) {
      // Check if current model belongs to new category.
      const validModels = selectedCategory?.models || []
      if (!validModels.includes(currentModel)) {
        form.setValue('model', '')
      }
    }
  }, [selectedCategoryName, selectedCategory, form])

  // Use shared file upload hook
  const {
    uploadedFiles,
    isUploading,
    addFiles,
    removeFile,
    getFormId,
  } = useFileUpload({
    onError: (msg) => toast.error(msg),
  })

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await addFiles(e.target.files)
    }
    // Reset input
    e.target.value = ''
  }

  const onSubmit = async (values: FormValues) => {
    if (!user?.email) {
      toast.error(tToast('loginRequired'))
      return
    }

    try {
      // Build structured ticket body from template fields
      const ticketBody = `【${tTemplate('productInfo')}】
${tTemplate('model')}: ${values.category} - ${values.model}
${tTemplate('version')}: ${values.version || 'N/A'}
${tTemplate('snImei')}: ${values.snImei || 'N/A'}
${tTemplate('platform')}: ${values.platform}

【${tTemplate('issueDescription')}】
${values.issueDescription}

【${tTemplate('testEnvironment')}】
${values.testEnvironment}

【${tTemplate('quantityAndProbability')}】
${values.quantityAndProbability}

【${tTemplate('reproductionSteps')}】
${values.reproductionSteps || 'N/A'}

【${tTemplate('expectedResult')}】
${values.expectedResult || 'N/A'}

【${tTemplate('actualResult')}】
${values.actualResult || 'N/A'}`

      // Get form_id from successfully uploaded files
      // Note: Only form_id is needed - Zammad retrieves attachments from UploadCache by form_id
      const formId = getFormId()

      // Create ticket data (matching API schema)
      const ticketData = {
        title: values.title,
        group: 'Support',
        priority_id: parseInt(values.priority),
        article: {
          subject: values.title,
          body: ticketBody,
          type: 'web' as const,
          internal: false,
          // Use form_id for pre-uploaded files (Zammad UploadCache API)
          ...(formId && { form_id: formId }),
        },
      }

      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketData),
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

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">{tCreate('formTitle')}</CardTitle>
          <CardDescription className="text-sm">
            {tCreate('formDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              {/* Product Info Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tCreate('categoryLabel')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={tCreate('categoryPlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PRODUCT_CATEGORIES.map(cat => (
                            <SelectItem key={cat.name} value={cat.name}>
                              {cat.name === 'Other' ? tCreate('categoryOther') : cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tCreate('modelLabel')}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                        disabled={!selectedCategoryName}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={tCreate('modelPlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {selectedCategory?.models.map(model => (
                            <SelectItem key={model} value={model}>
                              {model === 'N/A' ? tCreate('modelNotApplicable') : model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tCreate('priorityLabel')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">{getPriorityLabel('1')}</SelectItem>
                          <SelectItem value="2">{getPriorityLabel('2')}</SelectItem>
                          <SelectItem value="3">{getPriorityLabel('3')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="version"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tCreate('versionLabel')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={tCreate('versionPlaceholder')}
                          className="placeholder:text-muted-foreground/40"
                          maxLength={50}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="snImei"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tCreate('snImeiLabel')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={tCreate('snImeiPlaceholder')}
                          className="placeholder:text-muted-foreground/40"
                          maxLength={50}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="platform"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tCreate('platformLabel')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={tCreate('platformPlaceholder')}
                          className="placeholder:text-muted-foreground/40"
                          maxLength={100}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tCreate('titleLabel')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={tCreate('titlePlaceholder')}
                        className="placeholder:text-muted-foreground/40"
                        maxLength={200}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Full Width Text Areas */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="issueDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tCreate('issueDescriptionLabel')}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={tCreate('issueDescriptionPlaceholder')}
                          className="min-h-[100px] placeholder:text-muted-foreground/40"
                          maxLength={1000}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="testEnvironment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tCreate('testEnvironmentLabel')}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={tCreate('testEnvironmentPlaceholder')}
                          className="min-h-[80px] placeholder:text-muted-foreground/40"
                          maxLength={500}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quantityAndProbability"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tCreate('quantityAndProbabilityLabel')}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={tCreate('quantityAndProbabilityPlaceholder')}
                          className="min-h-[60px] placeholder:text-muted-foreground/40"
                          maxLength={300}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reproductionSteps"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tCreate('reproductionStepsLabel')}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={tCreate('reproductionStepsPlaceholder')}
                          className="min-h-[100px] placeholder:text-muted-foreground/40"
                          maxLength={1000}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="expectedResult"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{tCreate('expectedResultLabel')}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={tCreate('expectedResultPlaceholder')}
                            className="min-h-[80px] placeholder:text-muted-foreground/40"
                            maxLength={500}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="actualResult"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{tCreate('actualResultLabel')}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={tCreate('actualResultPlaceholder')}
                            className="min-h-[80px] placeholder:text-muted-foreground/40"
                            maxLength={500}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* File Upload Section - Kept similar but styled nicely */}
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{tCreate('attachmentsLabel')}</label>
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    type="file"
                    onChange={handleFileChange}
                    multiple
                    accept={FILE_ACCEPT}
                    className="hidden"
                    id="file-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('file-upload')?.click()}
                    disabled={uploadedFiles.length >= ATTACHMENT_LIMITS.MAX_COUNT}
                  >
                    <Upload className="mr-1 h-3 w-3" />
                    {tCreate('selectFiles')}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {tCreate('fileSizeLimit')}
                  </span>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {uploadedFiles.map((uploadedFile, index) => (
                      <div key={index} className={`flex items-center gap-1 px-2 py-1 border rounded text-xs ${uploadedFile.error ? 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800' :
                          uploadedFile.uploading ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800' :
                            'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                        }`}>
                        {uploadedFile.uploading ? (
                          <Loader2 className="h-3 w-3 animate-spin text-yellow-600" />
                        ) : uploadedFile.error ? (
                          <X className="h-3 w-3 text-red-600" />
                        ) : (
                          <CheckCircle className="h-3 w-3 text-green-600" />
                        )}
                        <span className="truncate max-w-[150px]">{uploadedFile.file.name}</span>
                        <span className="text-muted-foreground">
                          ({formatFileSize(uploadedFile.file.size)})
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

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => router.back()}
                  disabled={form.formState.isSubmitting}
                >
                  {tCreate('actions.cancel')}
                </Button>
                <Button type="submit" size="sm" disabled={form.formState.isSubmitting || isUploading}>
                  {form.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      {tCreate('actions.submitting')}
                    </>
                  ) : isUploading ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      {tCreate('uploadingFiles')}
                    </>
                  ) : (
                    <>
                      <Send className="mr-1 h-3 w-3" />
                      {tCreate('actions.submit')}
                    </>
                  )}
                </Button>
              </div>

            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Tips */}
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
