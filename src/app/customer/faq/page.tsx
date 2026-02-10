/**
 * FAQ Page
 *
 * Main FAQ page with search and categories
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { useFAQ } from '@/lib/hooks/use-faq'
import { SearchBar } from '@/components/faq/search-bar'
import { CategoryList } from '@/components/faq/category-list'
import { ArticleCard } from '@/components/faq/article-card'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { HelpCircle, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'

export default function FAQPage() {
  const router = useRouter()
  const t = useTranslations('faq')
  const tToast = useTranslations('toast.customer.faq')
  const locale = useLocale()

  const {
    categories,
    items,
    isLoadingCategories,
    isLoadingItems,
    fetchCategories,
    searchFAQ,
    getPopularFAQ,
    getFAQByCategory,
  } = useFAQ()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'search' | 'browse'>('search')

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories(locale).catch((error) => {
      console.error('Error fetching categories:', error)
      toast.error(tToast('categoriesError'))
    })
  }, [fetchCategories, tToast, locale])

  // Fetch popular FAQ on mount
  useEffect(() => {
    if (activeTab === 'search' && !searchQuery) {
      getPopularFAQ(locale, 10).catch((error) => {
        console.error('Error fetching popular FAQ:', error)
        toast.error(tToast('popularError'))
      })
    }
  }, [activeTab, searchQuery, getPopularFAQ, tToast, locale])

  // Handle search
  const handleSearch = async (query: string) => {
    setSearchQuery(query)

    if (!query.trim()) {
      // Show popular FAQ when search is cleared
      try {
        await getPopularFAQ(locale, 10)
      } catch (error) {
        console.error('Error fetching popular FAQ:', error)
        toast.error(tToast('popularError'))
      }
      return
    }

    try {
      await searchFAQ(query, locale, undefined, 20)
    } catch (error) {
      console.error('Error searching FAQ:', error)
      toast.error(tToast('searchError'))
    }
  }

  // Handle category selection
  const handleCategorySelect = async (categoryId: string | null) => {
    setSelectedCategory(categoryId)

    if (!categoryId) {
      // Show popular FAQ when "All Categories" is selected
      try {
        await getPopularFAQ(locale, 20)
      } catch (error) {
        console.error('Error fetching popular FAQ:', error)
        toast.error(tToast('loadError'))
      }
      return
    }

    try {
      await getFAQByCategory(categoryId, locale)
    } catch (error) {
      console.error('Error fetching FAQ by category:', error)
      toast.error(tToast('loadError'))
    }
  }
  
  // Handle article click
  const handleArticleClick = (articleId: string) => {
    router.push(`/customer/faq/${articleId}`)
  }
  
  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('helpCenter')}</h1>
        <p className="text-muted-foreground">
          {t('helpDescription')}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'search' | 'browse')}>
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="search">{t('searchTab')}</TabsTrigger>
          <TabsTrigger value="browse">{t('browseTab')}</TabsTrigger>
        </TabsList>

        {/* Search Tab */}
        <TabsContent value="search" className="space-y-6">
          <SearchBar
            onSearch={handleSearch}
            defaultValue={searchQuery}
            isLoading={isLoadingItems}
            placeholder={t('searchArticlesPlaceholder')}
          />
          
          <div>
            <div className="flex items-center gap-2 mb-4">
              {searchQuery ? (
                <HelpCircle className="h-5 w-5 text-muted-foreground" />
              ) : (
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              )}
              <h2 className="text-xl font-semibold">
                {searchQuery ? t('searchResults') : t('popularArticles')}
              </h2>
              {searchQuery && (
                <span className="text-sm text-muted-foreground">
                  for &ldquo;{searchQuery}&rdquo;
                </span>
              )}
            </div>

            {isLoadingItems ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-2/3 mt-1" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : items.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <HelpCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {searchQuery ? t('noResults') : t('noArticlesAvailable')}
                  </h3>
                  <p className="text-muted-foreground text-center">
                    {searchQuery
                      ? t('tryDifferentKeywords')
                      : t('checkBackLater')}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {items.map((article) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    onClick={() => handleArticleClick(article.id)}
                    showCategory
                    showStats
                    searchQuery={searchQuery}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>
        
        {/* Browse Tab */}
        <TabsContent value="browse" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Categories sidebar */}
            <div className="md:col-span-1">
              <h2 className="text-xl font-semibold mb-4">{t('categories')}</h2>
              <CategoryList
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={handleCategorySelect}
                isLoading={isLoadingCategories}
              />
            </div>

            {/* Articles list */}
            <div className="md:col-span-2">
              <h2 className="text-xl font-semibold mb-4">
                {selectedCategory
                  ? (() => {
                      const cat = categories.find((c) => c.id === selectedCategory)
                      return cat ? t(`categoryNames.${cat.name}`, { defaultValue: cat.name }) : t('articles')
                    })()
                  : t('allArticles')}
              </h2>

              {isLoadingItems ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i}>
                      <CardContent className="p-6">
                        <Skeleton className="h-4 w-3/4 mb-2" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-2/3 mt-1" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : items.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <HelpCircle className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">{t('noArticlesFound')}</h3>
                    <p className="text-muted-foreground text-center">
                      {t('noCategoryArticles')}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {items.map((article) => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      onClick={() => handleArticleClick(article.id)}
                      showCategory={false}
                      showStats
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}


