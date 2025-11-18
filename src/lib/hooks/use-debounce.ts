/**
 * Debounce Hook
 *
 * Delays updating a value until after a specified delay
 */

import { useEffect, useState } from 'react'

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    // Set up a timer to update the debounced value
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    // Clean up the timer if value changes before delay
    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}
