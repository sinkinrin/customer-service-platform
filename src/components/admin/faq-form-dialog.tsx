'use client'

/**
 * FAQ Form Dialog Component
 *
 * Dialog for creating and editing FAQ articles with multi-language support
 */

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

interface FAQFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  article?: {
    id: number
    category_id: number
    slug: string
    is_active: boolean
    translations: {
      locale: string
      title: string
      content: string
      keywords?: string[]
    }[]
  }
  onSuccess: () => void
}

const LANGUAGES = ['en', 'zh-CN', 'fr', 'es', 'ru', 'pt'] as const

interface Category {
  id: number
  name: string
}

export function FAQFormDialog({ open, onOpenChange, mode, article, onSuccess }: FAQFormDialogProps) {
  const t = useTranslations('admin.faq')
  const tToast = useTranslations('toast.admin.faq')
  const tCommon = useTranslations('common')
  const tLocale = useTranslations('common.localeNames')
  const tFaq = useTranslations('faq')
  const [loading, setLoading] = useState(false)
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState<number>(1)
  const [slug, setSlug] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [activeLanguage, setActiveLanguage] = useState('en')

  // Translation data for each language
  const emptyTranslations = () =>
    Object.fromEntries(LANGUAGES.map(l => [l, { title: '', content: '', keywords: '' }]))
  const [translations, setTranslations] = useState<Record<string, { title: string; content: string; keywords: string }>>(emptyTranslations())

  // Fetch categories from API
  useEffect(() => {
    const fetchCategories = async () => {
      setLoadingCategories(true)
      try {
        const response = await fetch('/api/faq/categories')
        if (!response.ok) throw new Error('Failed to fetch categories')

        const data = await response.json()
        const categoryList = (data.data?.categories || []).map((cat: any) => ({
          id: cat.id,
          name: cat.name || `Category ${cat.id}`,
        }))

        setCategories(categoryList)

        // Set default category if no category is selected yet
        if (categoryList.length > 0 && !article) {
          setCategoryId(categoryList[0].id)
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error)
        // Fallback to default categories if API fails
        setCategories([
          { id: 1, name: 'device-startup' },
          { id: 2, name: 'gps-location' },
          { id: 3, name: 'network-platform' },
          { id: 4, name: 'video-storage' },
          { id: 5, name: 'alarm-upload' },
          { id: 6, name: 'general-troubleshooting' },
        ])
      } finally {
        setLoadingCategories(false)
      }
    }

    if (open) {
      fetchCategories()
    }
  }, [open, article])

  // Initialize form data when editing
  useEffect(() => {
    if (mode === 'edit' && article) {
      setCategoryId(article.category_id)
      setSlug(article.slug)
      setIsActive(article.is_active)
      
      // Populate translations
      const newTranslations = emptyTranslations()
      
      article.translations.forEach((t) => {
        newTranslations[t.locale] = {
          title: t.title,
          content: t.content,
          keywords: t.keywords?.join(', ') || '',
        }
      })
      
      setTranslations(newTranslations)
    } else {
      // Reset form for create mode
      setCategoryId(1)
      setSlug('')
      setIsActive(true)
      setTranslations(emptyTranslations())
    }
  }, [mode, article, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validate that at least one language has content
      const hasContent = Object.values(translations).some(t => t.title.trim() && t.content.trim())
      if (!hasContent) {
        toast.error(t('form.validationError'))
        setLoading(false)
        return
      }

      // Prepare translations array
      const translationsArray = Object.entries(translations)
        .filter(([_, t]) => t.title.trim() && t.content.trim())
        .map(([locale, t]) => ({
          locale,
          title: t.title,
          content: t.content,
          keywords: t.keywords.split(',').map(k => k.trim()).filter(k => k),
        }))

      const payload = {
        ...(mode === 'edit' && { id: article?.id }),
        category_id: categoryId,
        slug: slug || `article-${Date.now()}`,
        is_active: isActive,
        translations: translationsArray,
      }

      const url = '/api/admin/faq/articles'
      const method = mode === 'create' ? 'POST' : 'PUT'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${mode} article`)
      }

      toast.success(mode === 'create' ? tToast('createSuccess') : tToast('updateSuccess'))
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error(`Failed to ${mode} article:`, error)
      toast.error(error.message || (mode === 'create' ? tToast('createError') : tToast('updateError')))
    } finally {
      setLoading(false)
    }
  }

  const updateTranslation = (locale: string, field: 'title' | 'content' | 'keywords', value: string) => {
    setTranslations(prev => ({
      ...prev,
      [locale]: {
        ...prev[locale],
        [field]: value,
      },
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? t('dialog.createTitle') : t('dialog.editTitle')}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? t('dialog.createDescription')
              : t('dialog.editDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">{t('form.category')}</Label>
                <Select
                  value={categoryId.toString()}
                  onValueChange={(v) => setCategoryId(parseInt(v))}
                  disabled={loadingCategories}
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingCategories ? (
                      <SelectItem value="0" disabled>
                        {t('form.loadingCategories')}
                      </SelectItem>
                    ) : categories.length === 0 ? (
                      <SelectItem value="0" disabled>
                        {t('form.noCategories')}
                      </SelectItem>
                    ) : (
                      categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {tFaq(`categoryNames.${cat.name}`, { defaultValue: cat.name })}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">{t('form.slugLabel')}</Label>
                <Input
                  id="slug"
                  placeholder={t('form.slugPlaceholder')}
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                {t('form.publishImmediately')}
              </Label>
            </div>
          </div>

          {/* Multi-language Translations */}
          <div className="space-y-4">
            <Label>{t('form.translations')}</Label>
            <Tabs value={activeLanguage} onValueChange={setActiveLanguage}>
              <TabsList className="grid w-full grid-cols-6">
                {LANGUAGES.map((lang) => (
                  <TabsTrigger key={lang} value={lang}>
                    {tLocale(lang)}
                  </TabsTrigger>
                ))}
              </TabsList>

              {LANGUAGES.map((lang) => (
                <TabsContent key={lang} value={lang} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`title-${lang}`}>{t('form.title')}</Label>
                    <Input
                      id={`title-${lang}`}
                      placeholder={t('form.titlePlaceholder')}
                      value={translations[lang].title}
                      onChange={(e) => updateTranslation(lang, 'title', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`content-${lang}`}>{t('form.content')}</Label>
                    <Textarea
                      id={`content-${lang}`}
                      placeholder={t('form.contentPlaceholderMarkdown')}
                      value={translations[lang].content}
                      onChange={(e) => updateTranslation(lang, 'content', e.target.value)}
                      rows={10}
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`keywords-${lang}`}>{t('form.keywordsLabel')}</Label>
                    <Input
                      id={`keywords-${lang}`}
                      placeholder={t('form.keywordsPlaceholder')}
                      value={translations[lang].keywords}
                      onChange={(e) => updateTranslation(lang, 'keywords', e.target.value)}
                    />
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'create' ? t('form.create') : t('form.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

