'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

interface DragOverlayProps {
  className?: string
}

export function DragOverlay({ className }: DragOverlayProps) {
  const t = useTranslations('components.dragDrop')
  return (
    <div className={cn(
      "absolute inset-0 z-10 flex items-center justify-center bg-primary/5",
      className
    )}>
      <p className="text-sm font-medium text-primary">{t('release')}</p>
    </div>
  )
}
