'use client'

import { useState, useCallback, useRef, type DragEvent } from 'react'

interface UseDragDropOptions {
  /** Callback when files are dropped */
  onFiles: (files: File[]) => void
  /** Disable drag-drop */
  disabled?: boolean
  /** Accepted MIME type prefixes (e.g., ['image/', 'video/']) — if empty, accept all */
  accept?: string[]
}

interface UseDragDropReturn {
  /** Whether user is currently dragging over the drop zone */
  isDragging: boolean
  /** Props to spread on the drop zone container */
  dragProps: {
    onDragEnter: (e: DragEvent) => void
    onDragOver: (e: DragEvent) => void
    onDragLeave: (e: DragEvent) => void
    onDrop: (e: DragEvent) => void
  }
}

/**
 * Hook for drag-and-drop file upload.
 *
 * Uses a counter to correctly handle nested element drag events —
 * dragEnter/dragLeave fire for every child element, so we track
 * depth instead of toggling a boolean.
 */
export function useDragDrop({ onFiles, disabled = false, accept }: UseDragDropOptions): UseDragDropReturn {
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)

  const onDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return
    dragCounter.current += 1
    if (dragCounter.current === 1) {
      setIsDragging(true)
    }
  }, [disabled])

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return
    dragCounter.current -= 1
    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }, [disabled])

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = 0
    setIsDragging(false)
    if (disabled) return

    const droppedFiles = Array.from(e.dataTransfer.files)
    if (droppedFiles.length === 0) return

    // Filter by accepted MIME prefixes if specified
    const filtered = accept && accept.length > 0
      ? droppedFiles.filter(f => accept.some(prefix => f.type.startsWith(prefix)))
      : droppedFiles

    if (filtered.length > 0) {
      onFiles(filtered)
    }
  }, [disabled, accept, onFiles])

  return {
    isDragging,
    dragProps: { onDragEnter, onDragOver, onDragLeave, onDrop },
  }
}
