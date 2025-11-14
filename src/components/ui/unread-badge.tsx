/**
 * Unread Badge Component
 *
 * Displays unread message count as a red dot or number badge
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { Badge } from "./badge"

export interface UnreadBadgeProps {
  count: number
  className?: string
  /**
   * If true, shows a small red dot instead of the count
   * Used when space is limited or for minimal UI
   */
  dotOnly?: boolean
  /**
   * Maximum count to display before showing "99+"
   */
  maxCount?: number
}

export function UnreadBadge({
  count,
  className,
  dotOnly = false,
  maxCount = 99,
}: UnreadBadgeProps) {
  // Don't render anything if count is 0
  if (count === 0) {
    return null
  }

  // Show red dot only
  if (dotOnly) {
    return (
      <span
        className={cn(
          "absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-background",
          className
        )}
        aria-label={`${count} unread messages`}
      />
    )
  }

  // Show count badge
  const displayCount = count > maxCount ? `${maxCount}+` : count.toString()

  return (
    <Badge
      variant="destructive"
      className={cn(
        "min-w-[20px] h-5 flex items-center justify-center px-1.5 bg-red-500 hover:bg-red-600 text-white",
        className
      )}
    >
      {displayCount}
    </Badge>
  )
}
