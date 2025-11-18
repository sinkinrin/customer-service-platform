/**
 * FAQ Search Bar Component
 *
 * Search input for FAQ items with debounce optimization
 */

'use client'

import { useState, KeyboardEvent, useEffect, memo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'
import { useDebounce } from '@/lib/hooks/use-debounce'

interface SearchBarProps {
  onSearch: (query: string) => void
  placeholder?: string
  defaultValue?: string
  isLoading?: boolean
  debounceDelay?: number
}

export const SearchBar = memo(function SearchBar({
  onSearch,
  placeholder = 'Search for help...',
  defaultValue = '',
  isLoading = false,
  debounceDelay = 300,
}: SearchBarProps) {
  const [query, setQuery] = useState(defaultValue)
  const debouncedQuery = useDebounce(query, debounceDelay)

  // PERFORMANCE: Auto-search with debounce (reduces API calls)
  useEffect(() => {
    if (debouncedQuery !== defaultValue) {
      onSearch(debouncedQuery.trim())
    }
  }, [debouncedQuery, onSearch, defaultValue])

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
          placeholder={placeholder}
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
          <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <Search className="h-4 w-4 mr-2" />
            Search
          </>
        )}
      </Button>
    </div>
  )
})

