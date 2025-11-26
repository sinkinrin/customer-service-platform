/**
 * FAQ Search Bar Component
 *
 * Search input for FAQ items with debounce optimization
 */

'use client'

import { useState, KeyboardEvent, useEffect, useRef, memo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { useTranslations } from 'next-intl'

interface SearchBarProps {
  onSearch: (query: string) => void
  placeholder?: string
  defaultValue?: string
  isLoading?: boolean
  debounceDelay?: number
}

export const SearchBar = memo(function SearchBar({
  onSearch,
  placeholder,
  defaultValue = '',
  isLoading = false,
  debounceDelay = 300,
}: SearchBarProps) {
  const t = useTranslations('faq')
  const [query, setQuery] = useState(defaultValue)
  const debouncedQuery = useDebounce(query, debounceDelay)
  const previousQueryRef = useRef<string>(debouncedQuery)

  // Use translation if no placeholder provided
  const effectivePlaceholder = placeholder || t('searchHelpPlaceholder')

  // PERFORMANCE: Auto-search with debounce (reduces API calls)
  // FIX: Only trigger onSearch when debouncedQuery actually changes
  // Using useRef to track previous value prevents infinite loop from onSearch recreation
  useEffect(() => {
    const trimmedQuery = debouncedQuery.trim()
    const previousQuery = previousQueryRef.current.trim()

    if (trimmedQuery !== previousQuery) {
      onSearch(trimmedQuery)
      previousQueryRef.current = debouncedQuery
    }
  }, [debouncedQuery, onSearch])

  const handleSearch = () => {
    onSearch(query.trim())
  }
  
  const handleClear = () => {
    setQuery('')
    onSearch('')
  }
  
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }
  
  return (
    <div className="relative flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={effectivePlaceholder}
          className="pl-10 pr-10"
          disabled={isLoading}
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            disabled={isLoading}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Button onClick={handleSearch} disabled={isLoading || !query.trim()}>
        {isLoading ? (
          <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />
        ) : (
          <>
            <Search className="h-4 w-4 mr-2" />
            {t('searchTab')}
          </>
        )}
      </Button>
    </div>
  )
})

