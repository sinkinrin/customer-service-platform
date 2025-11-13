/**
 * useFAQ Hook
 * 
 * Custom hook for FAQ operations
 */

import { useState, useCallback } from 'react'

export interface FAQCategory {
  id: string
  name: string
  description?: string
  display_order: number
  is_active: boolean
}

export interface FAQItem {
  id: string
  question: string
  answer: string
  category_id: string
  category_name: string
  language: string
  view_count?: number
  helpful_count?: number
  not_helpful_count?: number
  relevance_score?: number
}

export function useFAQ() {
  const [categories, setCategories] = useState<FAQCategory[]>([])
  const [items, setItems] = useState<FAQItem[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(false)
  const [isLoadingItems, setIsLoadingItems] = useState(false)
  
  /**
   * Fetch FAQ categories
   */
  const fetchCategories = useCallback(async (language = 'en') => {
    setIsLoadingCategories(true)
    
    try {
      const response = await fetch(`/api/faq/categories?language=${language}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch categories')
      }
      
      const data = await response.json()
      setCategories(data.data.categories || [])
    } catch (err) {
      const error = err as Error
      console.error('Error fetching categories:', error)
      throw error
    } finally {
      setIsLoadingCategories(false)
    }
  }, [])
  
  /**
   * Search FAQ items
   */
  const searchFAQ = useCallback(async (
    query: string,
    language = 'en',
    categoryId?: string,
    limit = 10
  ) => {
    setIsLoadingItems(true)
    
    try {
      const params = new URLSearchParams()
      if (query) params.append('query', query)
      params.append('language', language)
      if (categoryId) params.append('categoryId', categoryId)
      params.append('limit', limit.toString())
      
      const response = await fetch(`/api/faq?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error('Failed to search FAQ')
      }
      
      const data = await response.json()
      setItems(data.data.items || [])
      
      return data.data.items || []
    } catch (err) {
      const error = err as Error
      console.error('Error searching FAQ:', error)
      throw error
    } finally {
      setIsLoadingItems(false)
    }
  }, [])
  
  /**
   * Get popular FAQ items
   */
  const getPopularFAQ = useCallback(async (language = 'en', limit = 10) => {
    setIsLoadingItems(true)
    
    try {
      const params = new URLSearchParams()
      params.append('language', language)
      params.append('limit', limit.toString())
      
      const response = await fetch(`/api/faq?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch popular FAQ')
      }
      
      const data = await response.json()
      setItems(data.data.items || [])
      
      return data.data.items || []
    } catch (err) {
      const error = err as Error
      console.error('Error fetching popular FAQ:', error)
      throw error
    } finally {
      setIsLoadingItems(false)
    }
  }, [])
  
  /**
   * Get FAQ items by category
   */
  const getFAQByCategory = useCallback(async (
    categoryId: string,
    language = 'en'
  ) => {
    setIsLoadingItems(true)
    
    try {
      const params = new URLSearchParams()
      params.append('categoryId', categoryId)
      params.append('language', language)
      params.append('limit', '50')
      
      const response = await fetch(`/api/faq?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch FAQ by category')
      }
      
      const data = await response.json()
      setItems(data.data.items || [])
      
      return data.data.items || []
    } catch (err) {
      const error = err as Error
      console.error('Error fetching FAQ by category:', error)
      throw error
    } finally {
      setIsLoadingItems(false)
    }
  }, [])
  
  /**
   * Submit feedback for FAQ item
   */
  const submitFeedback = useCallback(async (
    itemId: string,
    helpful: boolean
  ) => {
    try {
      const response = await fetch(`/api/faq/${itemId}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_helpful: helpful }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to submit feedback')
      }
      
      return true
    } catch (err) {
      const error = err as Error
      console.error('Error submitting feedback:', error)
      throw error
    }
  }, [])
  
  return {
    // State
    categories,
    items,
    isLoadingCategories,
    isLoadingItems,
    
    // Actions
    fetchCategories,
    searchFAQ,
    getPopularFAQ,
    getFAQByCategory,
    submitFeedback,
  }
}

