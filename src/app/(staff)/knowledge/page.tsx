'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, BookOpen, Eye, ThumbsUp } from 'lucide-react'
import { useStaffFAQ, type FAQItem, type FAQCategory } from '@/lib/hooks/use-staff-faq'

export default function KnowledgePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'search' | 'browse'>('search')
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>()
  const [faqs, setFaqs] = useState<FAQItem[]>([])
  const [categories, setCategories] = useState<FAQCategory[]>([])
  
  const { searchFAQ, getCategories, getPopularFAQs, isLoading } = useStaffFAQ()

  useEffect(() => {
    loadCategories()
    loadPopularFAQs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadCategories = async () => {
    const data = await getCategories()
    setCategories(data)
  }

  const loadPopularFAQs = async () => {
    const data = await getPopularFAQs('en', 20)
    setFaqs(data)
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadPopularFAQs()
      return
    }

    const results = await searchFAQ(searchQuery, 'en', selectedCategory)
    setFaqs(results)
  }

  const handleCategorySelect = async (categoryId: string) => {
    setSelectedCategory(categoryId)
    const results = await searchFAQ(searchQuery || '*', 'en', categoryId)
    setFaqs(results)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Knowledge Base</h1>
        <p className="text-muted-foreground mt-2">
          Browse and search FAQ articles to help customers
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="search">
            <Search className="h-4 w-4 mr-2" />
            Search
          </TabsTrigger>
          <TabsTrigger value="browse">
            <BookOpen className="h-4 w-4 mr-2" />
            Browse by Category
          </TabsTrigger>
        </TabsList>

        {/* Search Tab */}
        <TabsContent value="search" className="space-y-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search FAQ articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch()
                  }
                }}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={isLoading}>
              Search
            </Button>
          </div>

          {/* Search Results */}
          <div className="space-y-4">
            {isLoading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3 mt-2" />
                    </CardContent>
                  </Card>
                ))}
              </>
            ) : faqs.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">No articles found</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Try a different search term
                  </p>
                </CardContent>
              </Card>
            ) : (
              faqs.map((faq) => (
                <Card key={faq.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">{faq.question}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {faq.answer}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        <span>{faq.view_count} views</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <ThumbsUp className="h-4 w-4" />
                        <span>{faq.helpful_count} helpful</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Browse Tab */}
        <TabsContent value="browse" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Categories Sidebar */}
            <div className="space-y-2">
              <h3 className="font-semibold mb-4">Categories</h3>
              {isLoading ? (
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </>
              ) : (
                <>
                  <Button
                    variant={!selectedCategory ? 'default' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => {
                      setSelectedCategory(undefined)
                      loadPopularFAQs()
                    }}
                  >
                    All Categories
                  </Button>
                  {categories.map((category) => (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.id ? 'default' : 'ghost'}
                      className="w-full justify-between"
                      onClick={() => handleCategorySelect(category.id)}
                    >
                      <span>{category.name}</span>
                      <Badge variant="secondary">{category.item_count}</Badge>
                    </Button>
                  ))}
                </>
              )}
            </div>

            {/* Articles List */}
            <div className="md:col-span-2 space-y-4">
              {isLoading ? (
                <>
                  {[1, 2, 3].map((i) => (
                    <Card key={i}>
                      <CardHeader>
                        <Skeleton className="h-6 w-3/4" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3 mt-2" />
                      </CardContent>
                    </Card>
                  ))}
                </>
              ) : faqs.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-muted-foreground">
                      No articles in this category
                    </p>
                  </CardContent>
                </Card>
              ) : (
                faqs.map((faq) => (
                  <Card key={faq.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg">{faq.question}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {faq.answer}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          <span>{faq.view_count} views</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ThumbsUp className="h-4 w-4" />
                          <span>{faq.helpful_count} helpful</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

