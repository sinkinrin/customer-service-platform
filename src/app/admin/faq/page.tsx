'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Edit, Trash2, Plus, Loader2, Search, Eye, ThumbsUp } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { FAQFormDialog } from '@/components/admin/faq-form-dialog'

interface FAQItem {
  id: number
  title: string
  content: string
  category: string
  category_id: number
  state: string
  views: number
  likes: number
  created_at: string
  updated_at: string
}

export default function FAQManagementPage() {
  const [items, setItems] = useState<FAQItem[]>([])
  const [filteredItems, setFilteredItems] = useState<FAQItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stateFilter, setStateFilter] = useState('all')
  const [sortBy, setSortBy] = useState('updated_at')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<FAQItem | null>(null)
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editingItem, setEditingItem] = useState<FAQItem | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20
  const [_categories, _setCategories] = useState<Map<number, string>>(new Map())

  const fetchItems = async () => {
    setLoading(true)
    try {
      // Fetch categories first
      const categoriesResponse = await fetch('/api/faq/categories')
      const categoriesData = await categoriesResponse.json()
      const categoryMap = new Map<number, string>()

      if (categoriesData.data?.categories) {
        categoriesData.data.categories.forEach((cat: any) => {
          categoryMap.set(cat.id, cat.name || `Category ${cat.id}`)
        })
      }
      _setCategories(categoryMap)

      // Then fetch FAQ items
      const response = await fetch('/api/admin/faq?limit=1000&language=zh-CN')
      if (!response.ok) throw new Error('Failed to fetch FAQ items')

      const data = await response.json()
      const faqItems: FAQItem[] = (data.data?.items || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        content: item.content || '',
        category_id: item.category_id || 1,
        category: categoryMap.get(item.category_id) || `Category ${item.category_id}`,
        state: item.is_active ? 'published' : 'draft',
        views: item.views || 0,
        likes: item.helpful || 0,
        created_at: item.created_at || new Date().toISOString(),
        updated_at: item.updated_at || new Date().toISOString(),
      }))
      setItems(faqItems)
      setFilteredItems(faqItems)
    } catch (error) {
      toast.error('Failed to load FAQ items')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [])

  // Filter and sort items
  useEffect(() => {
    let filtered = [...items]

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((item) => item.category === categoryFilter)
    }

    // State filter
    if (stateFilter !== 'all') {
      filtered = filtered.filter((item) => item.state === stateFilter)
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title)
        case 'views':
          return b.views - a.views
        case 'likes':
          return b.likes - a.likes
        case 'created_at':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'updated_at':
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      }
    })

    setFilteredItems(filtered)
    setCurrentPage(1)
  }, [items, searchQuery, categoryFilter, stateFilter, sortBy])

  const handleCreate = () => {
    setFormMode('create')
    setEditingItem(null)
    setFormDialogOpen(true)
  }

  const handleEdit = (item: FAQItem) => {
    setFormMode('edit')
    setEditingItem(item)
    setFormDialogOpen(true)
  }

  const handleFormSuccess = () => {
    fetchItems()
  }

  const handleDelete = async () => {
    if (!itemToDelete) return

    try {
      const response = await fetch('/api/admin/faq/articles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemToDelete.id }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete FAQ item')
      }

      toast.success('FAQ item deleted successfully')
      fetchItems()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete FAQ item')
      console.error(error)
    } finally {
      setDeleteDialogOpen(false)
      setItemToDelete(null)
    }
  }

  const handleTogglePublish = async (item: FAQItem) => {
    try {
      const newIsActive = item.state !== 'published'
      const response = await fetch('/api/admin/faq/articles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          is_active: newIsActive,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update FAQ item')
      }

      toast.success(`FAQ item ${newIsActive ? 'published' : 'unpublished'} successfully`)
      fetchItems()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update FAQ item')
      console.error(error)
    }
  }

  // Get unique categories for filter dropdown
  const categoryOptions = Array.from(new Set(items.map((item) => item.category)))

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage)
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">FAQ Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage FAQ items from Zammad Knowledge Base
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create FAQ
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title or content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Category Filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categoryOptions.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* State Filter */}
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All States" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort By */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated_at">Last Updated</SelectItem>
                <SelectItem value="created_at">Created Date</SelectItem>
                <SelectItem value="title">Title (A-Z)</SelectItem>
                <SelectItem value="views">Most Viewed</SelectItem>
                <SelectItem value="likes">Most Liked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Results Count */}
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredItems.length} of {items.length} FAQ items
          </div>
        </CardContent>
      </Card>

      {/* FAQ Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>FAQ Items</CardTitle>
          <CardDescription>
            {filteredItems.length} items found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No FAQ items found
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead className="text-center">
                      <Eye className="h-4 w-4 inline mr-1" />
                      Views
                    </TableHead>
                    <TableHead className="text-center">
                      <ThumbsUp className="h-4 w-4 inline mr-1" />
                      Likes
                    </TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium max-w-md">
                        <div className="truncate">{item.title}</div>
                        <div className="text-xs text-muted-foreground truncate mt-1">
                          {item.content.substring(0, 100)}...
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.state === 'published'
                              ? 'default'
                              : item.state === 'archived'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {item.state}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{item.views}</TableCell>
                      <TableCell className="text-center">{item.likes}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(item.updated_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTogglePublish(item)}
                            title={item.state === 'published' ? 'Unpublish' : 'Publish'}
                          >
                            {item.state === 'published' ? 'Unpublish' : 'Publish'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(item)}
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setItemToDelete(item)
                              setDeleteDialogOpen(true)
                            }}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages} ({filteredItems.length} items)
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the FAQ item &quot;{itemToDelete?.title}&quot;.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* FAQ Form Dialog */}
      <FAQFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        mode={formMode}
        article={editingItem ? {
          id: editingItem.id,
          category_id: editingItem.category_id,
          slug: `article-${editingItem.id}`,
          is_active: editingItem.state === 'published',
          translations: [
            {
              locale: 'zh-CN',
              title: editingItem.title,
              content: editingItem.content,
              keywords: [],
            },
          ],
        } : undefined}
        onSuccess={handleFormSuccess}
      />
    </div>
  )
}

