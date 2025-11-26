import * as React from "react"
import { cn } from "@/lib/utils"

type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  shimmer?: boolean
}

function Skeleton({
  className,
  shimmer = true,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted animate-pulse motion-reduce:animate-none",
        shimmer && "skeleton-shimmer",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
