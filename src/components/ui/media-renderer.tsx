'use client'

import { useState } from 'react'
import { Paperclip, Download } from 'lucide-react'
import { isImageType, isVideoType } from '@/lib/constants/attachments'
import { cn } from '@/lib/utils'

interface MediaRendererProps {
  /** MIME type of the file */
  mimeType: string
  /** URL to the file */
  src: string
  /** Display filename */
  filename: string
  /** File size display string */
  size?: string
  /** Called when an image is clicked (for lightbox) */
  onImageClick?: () => void
  /** Additional className for the container */
  className?: string
}

/**
 * Renders media content based on MIME type:
 * - Images: lazy-loaded <img> with click handler for lightbox
 * - Videos: <video> with preload="metadata" and controls
 * - Other: download link with filename and icon
 *
 * All types have onError fallback to download link style.
 */
export function MediaRenderer({
  mimeType,
  src,
  filename,
  size,
  onImageClick,
  className,
}: MediaRendererProps) {
  const [hasError, setHasError] = useState(false)

  // Fallback: show download link on any media load error
  if (hasError) {
    return <DownloadLink src={src} filename={filename} size={size} className={className} />
  }

  if (isImageType(mimeType)) {
    return (
      <button
        type="button"
        onClick={onImageClick}
        className={cn(
          'block rounded-lg overflow-hidden cursor-zoom-in',
          'hover:opacity-90 transition-opacity',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className
        )}
      >
        <img
          src={src}
          alt={filename}
          loading="lazy"
          onError={() => setHasError(true)}
          className="max-w-[320px] max-h-[240px] object-contain rounded-lg"
        />
      </button>
    )
  }

  if (isVideoType(mimeType)) {
    return (
      <div className={cn('rounded-lg overflow-hidden', className)}>
        <video
          src={src}
          preload="metadata"
          controls
          onError={() => setHasError(true)}
          className="max-w-[400px] max-h-[300px] rounded-lg"
        >
          <track kind="captions" />
        </video>
      </div>
    )
  }

  return <DownloadLink src={src} filename={filename} size={size} className={className} />
}

/** Reusable download link for non-media files and error fallback */
function DownloadLink({
  src,
  filename,
  size,
  className,
}: {
  src: string
  filename: string
  size?: string
  className?: string
}) {
  return (
    <a
      href={src}
      download={filename}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm',
        'bg-gray-100 dark:bg-gray-800 rounded-md',
        'hover:bg-gray-200 dark:hover:bg-gray-700',
        'transition-colors group',
        className
      )}
    >
      <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="max-w-[200px] truncate text-foreground">{filename}</span>
      {size && (
        <span className="text-xs text-muted-foreground">({size})</span>
      )}
      <Download className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
    </a>
  )
}
