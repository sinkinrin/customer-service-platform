import { useState, useCallback } from 'react'
import { toast } from 'sonner'

export interface FAQCategory {
  id: string
  name: string
  description?: string
  parent_id?: string
  item_count: number
}

export interface FAQItem {
  id: string
  category_id: string
  question: string
  answer: string
  view_count: number
  helpful_count: number
  created_at: string
  updated_at: string
}

export function useStaffFAQ() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const searchFAQ = useCallback(async (
    query: string,
    language: string = 'en',
    categoryId?: string,
    limit: number = 20
  ): Promise<FAQItem[]> => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        query,
        language,
        limit: limit.toString(),
      })

      if (categoryId) {
        params.append('categoryId', categoryId)
      }

      const response = await fetch(`/api/faq?${params}`)

      if (!response.ok) {
        throw new Error('Failed to search FAQ')
      }

      const data = await response.json()
      return data.data.items || []
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to search FAQ'
      setError(message)
      toast.error(message)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getCategories = useCallback(async (
    language: string = 'en'
  ): Promise<FAQCategory[]> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/faq/categories?language=${language}`)

      if (!response.ok) {
        throw new Error('Failed to fetch categories')
      }

      const data = await response.json()
      return data.data.categories || []
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch categories'
      setError(message)
      toast.error(message)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getPopularFAQs = useCallback(async (
    language: string = 'en',
    limit: number = 10
  ): Promise<FAQItem[]> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/faq?language=${language}&limit=${limit}`)

      if (!response.ok) {
        throw new Error('Failed to fetch popular FAQs')
      }

      const data = await response.json()
      return data.data.items || []
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch popular FAQs'
      setError(message)
      toast.error(message)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    isLoading,
    error,
    searchFAQ,
    getCategories,
    getPopularFAQs,
  }
}

