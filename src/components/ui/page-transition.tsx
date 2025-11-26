import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type PageTransitionProps = {
  children: ReactNode
  className?: string
  delay?: number
}

export function PageTransition({
  children,
  className,
  delay = 0,
}: PageTransitionProps) {
  return (
    <div
      className={cn("animate-fade-in motion-reduce:animate-none", className)}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}
