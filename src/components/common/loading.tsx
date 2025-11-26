/**
 * Loading Component
 * 
 * Reusable loading spinner with optional text
 */

import { cn } from '@/lib/utils'

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  className?: string
  fullScreen?: boolean
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-4',
  lg: 'h-12 w-12 border-4',
}

export function Loading({ 
  size = 'md', 
  text, 
  className,
  fullScreen = false 
}: LoadingProps) {
  const spinner = (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <div
        className={cn(
          'animate-spin motion-reduce:animate-none rounded-full border-solid border-current border-r-transparent',
          sizeClasses[size]
        )}
        role="status"
        aria-label={text || "Loading"}
      />
      {text && (
        <p className="text-sm text-muted-foreground">{text}</p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {spinner}
      </div>
    )
  }

  return spinner
}

