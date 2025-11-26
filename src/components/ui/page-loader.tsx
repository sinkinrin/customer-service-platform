import { cn } from "@/lib/utils"

type PageLoaderProps = {
  message?: string
  hint?: string
  compact?: boolean
  className?: string
}

export function PageLoader({
  message = "Loading...",
  hint,
  compact = false,
  className,
}: PageLoaderProps) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-center",
        compact ? "py-6" : "min-h-[260px] py-12",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="space-y-4 text-center animate-fade-in motion-reduce:animate-none">
        <div className="loader-dots justify-center" aria-hidden="true">
          <span className="loader-dot" />
          <span className="loader-dot" />
          <span className="loader-dot" />
        </div>
        <div className="space-y-1 text-muted-foreground">
          <p className="text-sm font-medium text-foreground">{message}</p>
          {hint && <p className="text-xs">{hint}</p>}
        </div>
      </div>
    </div>
  )
}
