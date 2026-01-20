"use client"

import * as React from 'react'

export type GapMode = 'padding' | 'margin'

export interface GapOffset {
  left: number
  top: number
  right: number
  gap: number
}

export interface BodyScroll {
  noRelative?: boolean
  noImportant?: boolean
  gapMode?: GapMode
}

export const lockAttribute = 'data-scroll-locked'
export const zeroRightClassName = 'right-scroll-bar-position'
export const fullWidthClassName = 'width-before-scroll-bar'
export const noScrollbarsClassName = 'with-scroll-bars-hidden'
export const removedBarSizeVariable = '--removed-body-scroll-bar-size'

export const getGapWidth = (): GapOffset => ({ left: 0, top: 0, right: 0, gap: 0 })

const getCurrentUseCounter = () => {
  if (typeof document === 'undefined') return 0
  const counter = parseInt(document.body.getAttribute(lockAttribute) || '0', 10)
  return Number.isFinite(counter) ? counter : 0
}

export const useLockAttribute = () => {
  React.useEffect(() => {
    if (typeof document === 'undefined') return

    document.body.setAttribute(lockAttribute, String(getCurrentUseCounter() + 1))
    return () => {
      if (typeof document === 'undefined') return

      const newCounter = getCurrentUseCounter() - 1
      if (newCounter <= 0) {
        document.body.removeAttribute(lockAttribute)
        return
      }

      document.body.setAttribute(lockAttribute, String(newCounter))
    }
  }, [])
}

export const RemoveScrollBar: React.FC<BodyScroll> = () => {
  useLockAttribute()
  return null
}
