# Attachment Inline Preview & Drag-Drop Upload — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable inline image/video preview in ticket articles and conversations, and add drag-and-drop file upload to all three input areas.

**Architecture:** Three new shared units (hook + 2 components) consumed by 5 existing pages/components. API routes get minor tweaks for inline disposition and MIME whitelist. No data model changes.

**Tech Stack:** React 19, Next.js 16, yet-another-react-lightbox, Tailwind CSS, next-intl

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `src/lib/constants/attachments.ts` (modify) | `isImageType()` / `isVideoType()` helpers |
| `src/lib/hooks/use-drag-drop.ts` | Drag-and-drop state + event handlers |
| `src/components/ui/image-lightbox.tsx` | Thin wrapper around yet-another-react-lightbox |
| `src/components/ui/media-renderer.tsx` | Renders image/video/file based on MIME type |

### Modified files
| File | Change |
|---|---|
| `src/app/api/tickets/[id]/articles/[articleId]/attachments/[attachmentId]/route.ts` | `?inline=true` support |
| `src/app/api/files/upload/route.ts` | Remove SVG, add video MIME types |
| `src/components/ticket/article-content.tsx` | Use media-renderer for attachments |
| `src/components/conversation/message-list.tsx` | Use media-renderer + lightbox |
| `src/components/conversation/message-input.tsx` | Drag-drop + image thumbnail preview |
| `src/app/customer/my-tickets/[id]/page.tsx` | Drag-drop in reply areas |
| `src/components/ticket/ticket-actions.tsx` | Drag-drop in staff reply |
| `messages/{en,zh-CN,fr,es,ru,pt}.json` | New i18n keys |

---

## Task 1: Install dependency + add MIME helper functions

**Files:**
- Modify: `src/lib/constants/attachments.ts`
- Modify: `src/app/api/files/upload/route.ts:63-80`
- Modify: `package.json`

- [ ] **Step 1: Install yet-another-react-lightbox**

```bash
npm install yet-another-react-lightbox
```

Expected: package added to `dependencies` in `package.json`.

- [ ] **Step 2: Add `isImageType` and `isVideoType` to `src/lib/constants/attachments.ts`**

Append after the `sanitizeFilename` function (after line 88):

```ts
/**
 * Check if a MIME type is an image type suitable for inline preview.
 * Excludes SVG due to XSS risk.
 */
export function isImageType(mimeType: string): boolean {
  return /^image\/(jpeg|png|gif|webp|bmp)$/.test(mimeType)
}

/**
 * Check if a MIME type is a video type suitable for inline playback.
 */
export function isVideoType(mimeType: string): boolean {
  return /^video\/(mp4|quicktime|x-msvideo|x-ms-wmv|x-matroska|webm)$/.test(mimeType)
}
```

- [ ] **Step 3: Fix MIME whitelist in `/api/files/upload/route.ts`**

In `src/app/api/files/upload/route.ts`, replace the `ALLOWED_MIME_TYPES` array (lines 63-80) with:

```ts
const ALLOWED_MIME_TYPES = [
  // Images (no SVG — XSS risk)
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  // Archives
  'application/zip',
  // Videos
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
]
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/constants/attachments.ts src/app/api/files/upload/route.ts
git commit -m "feat: add MIME helpers and install yet-another-react-lightbox"
```

---

## Task 2: Add `?inline=true` support to ticket attachment route

**Files:**
- Modify: `src/app/api/tickets/[id]/articles/[articleId]/attachments/[attachmentId]/route.ts`

- [ ] **Step 1: Modify the GET handler to support inline disposition**

In `src/app/api/tickets/[id]/articles/[articleId]/attachments/[attachmentId]/route.ts`, replace the response block (lines 57-68) with:

```ts
    // Encode filename for Content-Disposition header (handle non-ASCII characters)
    const encodedFilename = encodeURIComponent(filename).replace(/['()]/g, escape)

    // Support ?inline=true for image/video preview in browser
    const url = new URL(_request.url)
    const wantsInline = url.searchParams.get('inline') === 'true'
    const isInlineableType = contentType.startsWith('image/') || contentType.startsWith('video/')
    const disposition = (wantsInline && isInlineableType)
      ? `inline; filename*=UTF-8''${encodedFilename}`
      : `attachment; filename*=UTF-8''${encodedFilename}`

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': arrayBuffer.byteLength.toString(),
        'Content-Disposition': disposition,
        'Cache-Control': 'private, max-age=3600',
      },
    })
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/tickets/[id]/articles/[articleId]/attachments/[attachmentId]/route.ts
git commit -m "feat: support ?inline=true for ticket attachment preview"
```

---

## Task 3: Create `use-drag-drop` hook

**Files:**
- Create: `src/lib/hooks/use-drag-drop.ts`

- [ ] **Step 1: Create the hook file**

Create `src/lib/hooks/use-drag-drop.ts`:

```ts
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/hooks/use-drag-drop.ts
git commit -m "feat: add use-drag-drop hook for file drag-and-drop"
```

---

## Task 4: Create `image-lightbox` component

**Files:**
- Create: `src/components/ui/image-lightbox.tsx`

- [ ] **Step 1: Create the lightbox wrapper**

Create `src/components/ui/image-lightbox.tsx`:

```tsx
'use client'

import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import 'yet-another-react-lightbox/styles.css'

interface LightboxSlide {
  src: string
  alt?: string
}

interface ImageLightboxProps {
  open: boolean
  onClose: () => void
  slides: LightboxSlide[]
  index?: number
}

/**
 * Thin wrapper around yet-another-react-lightbox.
 * Supports multi-image navigation, zoom, keyboard nav (Esc, arrows).
 */
export function ImageLightbox({ open, onClose, slides, index = 0 }: ImageLightboxProps) {
  return (
    <Lightbox
      open={open}
      close={onClose}
      index={index}
      slides={slides}
      plugins={[Zoom]}
      animation={{ fade: 300 }}
      controller={{ closeOnBackdropClick: true }}
      zoom={{
        maxZoomPixelRatio: 3,
        scrollToZoom: true,
      }}
    />
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors. If `yet-another-react-lightbox` types are missing, check if `@types/yet-another-react-lightbox` is needed (usually included).

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/image-lightbox.tsx
git commit -m "feat: add image-lightbox component wrapping yet-another-react-lightbox"
```

---

## Task 5: Create `media-renderer` component

**Files:**
- Create: `src/components/ui/media-renderer.tsx`

- [ ] **Step 1: Create the media renderer**

Create `src/components/ui/media-renderer.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Paperclip, Download, Play } from 'lucide-react'
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/media-renderer.tsx
git commit -m "feat: add media-renderer component for inline image/video/file display"
```

---

## Task 6: Add i18n keys to all 6 language files

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/zh-CN.json`
- Modify: `messages/fr.json`
- Modify: `messages/es.json`
- Modify: `messages/ru.json`
- Modify: `messages/pt.json`

- [ ] **Step 1: Add keys to `messages/en.json`**

Inside the top-level `"components"` object (around line 2010), add a new `"dragDrop"` section after the existing `"conversation"` section:

```json
"dragDrop": {
  "hint": "Drop files here to upload",
  "hintImage": "Drop images here to upload",
  "release": "Release to upload"
}
```

- [ ] **Step 2: Add keys to `messages/zh-CN.json`**

```json
"dragDrop": {
  "hint": "拖拽文件到此处上传",
  "hintImage": "拖拽图片到此处上传",
  "release": "松开以上传"
}
```

- [ ] **Step 3: Add keys to `messages/fr.json`**

```json
"dragDrop": {
  "hint": "Déposez les fichiers ici pour les télécharger",
  "hintImage": "Déposez les images ici pour les télécharger",
  "release": "Relâchez pour télécharger"
}
```

- [ ] **Step 4: Add keys to `messages/es.json`**

```json
"dragDrop": {
  "hint": "Suelta los archivos aquí para subirlos",
  "hintImage": "Suelta las imágenes aquí para subirlas",
  "release": "Suelta para subir"
}
```

- [ ] **Step 5: Add keys to `messages/ru.json`**

```json
"dragDrop": {
  "hint": "Перетащите файлы сюда для загрузки",
  "hintImage": "Перетащите изображения сюда для загрузки",
  "release": "Отпустите для загрузки"
}
```

- [ ] **Step 6: Add keys to `messages/pt.json`**

```json
"dragDrop": {
  "hint": "Solte os arquivos aqui para enviar",
  "hintImage": "Solte as imagens aqui para enviar",
  "release": "Solte para enviar"
}
```

- [ ] **Step 7: Commit**

```bash
git add messages/en.json messages/zh-CN.json messages/fr.json messages/es.json messages/ru.json messages/pt.json
git commit -m "feat: add drag-drop i18n keys for 6 languages"
```

---

## Task 7: Integrate media-renderer into `article-content.tsx`

**Files:**
- Modify: `src/components/ticket/article-content.tsx`

- [ ] **Step 1: Add imports**

In `src/components/ticket/article-content.tsx`, replace the imports section (lines 1-15) with:

```tsx
'use client'

import { useMemo, useState } from 'react'
import DOMPurify from 'dompurify'
import { useTranslations, useLocale } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Paperclip, Download } from 'lucide-react'
import type { TicketArticle, TicketArticleAttachment } from '@/lib/hooks/use-ticket'
import { cn } from '@/lib/utils'
import { isImageType, isVideoType } from '@/lib/constants/attachments'
import { MediaRenderer } from '@/components/ui/media-renderer'
import { ImageLightbox } from '@/components/ui/image-lightbox'
```

- [ ] **Step 2: Replace the attachment rendering section**

In the `ArticleContent` component, replace the entire `{/* 附件列表 */}` block (lines 185-216) with:

```tsx
      {/* 附件列表 */}
      {showAttachments && displayAttachments.length > 0 && (() => {
        const getMimeType = (att: TicketArticleAttachment) =>
          att.preferences?.['Content-Type'] || att.preferences?.['Mime-Type'] || ''

        const mediaAtts = displayAttachments.filter(att => {
          const mime = getMimeType(att)
          return isImageType(mime) || isVideoType(mime)
        })
        const imageAtts = mediaAtts.filter(att => isImageType(getMimeType(att)))
        const otherAtts = displayAttachments.filter(att => {
          const mime = getMimeType(att)
          return !isImageType(mime) && !isVideoType(mime)
        })

        return (
          <>
            {/* Inline media preview */}
            {mediaAtts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {mediaAtts.map((att) => {
                  const src = `/api/tickets/${article.ticket_id}/articles/${article.id}/attachments/${att.id}?inline=true`
                  const mime = getMimeType(att)
                  const imageIndex = imageAtts.findIndex(a => a.id === att.id)

                  return (
                    <MediaRenderer
                      key={att.id}
                      mimeType={mime}
                      src={src}
                      filename={att.filename}
                      size={formatFileSize(att.size)}
                      onImageClick={imageIndex >= 0 ? () => setLightbox({
                        open: true,
                        index: imageIndex,
                      }) : undefined}
                    />
                  )
                })}
              </div>
            )}

            {/* Non-media download links */}
            {otherAtts.length > 0 && (
              <TooltipProvider>
                <div className="flex flex-wrap gap-2">
                  {otherAtts.map((att) => (
                    <Tooltip key={att.id}>
                      <TooltipTrigger asChild>
                        <a
                          href={`/api/tickets/${article.ticket_id}/articles/${article.id}/attachments/${att.id}`}
                          download={att.filename}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm
                            bg-gray-100 dark:bg-gray-800 rounded-md
                            hover:bg-gray-200 dark:hover:bg-gray-700
                            transition-colors group"
                        >
                          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="max-w-[200px] truncate text-foreground">{att.filename}</span>
                          <span className="text-xs text-muted-foreground">
                            ({formatFileSize(att.size)})
                          </span>
                          <Download className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[300px]">
                        <p className="break-all">{att.filename}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(att.size)}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
            )}

            {/* Lightbox for images */}
            <ImageLightbox
              open={lightbox.open}
              onClose={() => setLightbox({ open: false, index: 0 })}
              index={lightbox.index}
              slides={imageAtts.map(att => ({
                src: `/api/tickets/${article.ticket_id}/articles/${article.id}/attachments/${att.id}?inline=true`,
                alt: att.filename,
              }))}
            />
          </>
        )
      })()}
```

- [ ] **Step 3: Add lightbox state to the component**

Inside `ArticleContent`, right after `const senderStyle = ...` (line 140), add:

```tsx
  const [lightbox, setLightbox] = useState({ open: false, index: 0 })
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ticket/article-content.tsx
git commit -m "feat: inline image/video preview in ticket article attachments"
```

---

## Task 8: Integrate media-renderer into `message-list.tsx`

**Files:**
- Modify: `src/components/conversation/message-list.tsx`

- [ ] **Step 1: Add imports**

In `src/components/conversation/message-list.tsx`, add after the existing imports (after line 18):

```tsx
import { useState } from 'react'
import { isImageType, isVideoType } from '@/lib/constants/attachments'
import { MediaRenderer } from '@/components/ui/media-renderer'
import { ImageLightbox } from '@/components/ui/image-lightbox'
```

Also update the React import on line 9 — ensure `useState` is included (React already imported, but add `useState` to the named imports if using it directly):

Replace line 9:
```tsx
import React, { useEffect, useRef, useMemo, useState } from 'react'
```

- [ ] **Step 2: Add lightbox state**

Inside the `MessageList` component, after the `bottomRef` declaration (after line 38), add:

```tsx
  const [lightbox, setLightbox] = useState<{ open: boolean; src: string; alt: string }>({
    open: false, src: '', alt: '',
  })
```

- [ ] **Step 3: Replace `renderMessageContent` function**

Replace the entire `renderMessageContent` function (lines 102-206) with:

```tsx
  // Render message content based on type
  const renderMessageContent = (message: Message, isCustomer: boolean, isAI: boolean) => {
    if (message.message_type === 'text') {
      if (isAI) {
        return (
          <MarkdownMessage
            content={message.content}
            className="text-foreground"
          />
        )
      }
      return (
        <p className={cn(
          "text-[15px] leading-relaxed whitespace-pre-wrap break-words",
          isCustomer ? "text-white" : "text-foreground"
        )}>
          {message.content}
        </p>
      )
    }

    // Image message
    if (message.message_type === 'image' && message.metadata?.file_url) {
      return (
        <div className="space-y-2">
          <MediaRenderer
            mimeType={message.metadata.mime_type || 'image/jpeg'}
            src={message.metadata.file_url}
            filename={message.metadata.file_name || 'Image'}
            onImageClick={() => setLightbox({
              open: true,
              src: message.metadata!.file_url as string,
              alt: (message.metadata!.file_name as string) || 'Image',
            })}
          />
          {message.content && (
            <p className={cn(
              "text-[15px] leading-relaxed whitespace-pre-wrap break-words",
              isCustomer ? "text-white" : "text-foreground"
            )}>
              {message.content}
            </p>
          )}
        </div>
      )
    }

    // File message — check MIME for video/image fallback
    if (message.message_type === 'file' && message.metadata?.file_url) {
      const mime = (message.metadata.mime_type as string) || ''

      if (isVideoType(mime)) {
        return (
          <div className="space-y-2">
            <MediaRenderer
              mimeType={mime}
              src={message.metadata.file_url as string}
              filename={(message.metadata.file_name as string) || 'Video'}
            />
            {message.content && (
              <p className={cn(
                "text-[15px] leading-relaxed whitespace-pre-wrap break-words",
                isCustomer ? "text-white" : "text-foreground"
              )}>
                {message.content}
              </p>
            )}
          </div>
        )
      }

      if (isImageType(mime)) {
        return (
          <div className="space-y-2">
            <MediaRenderer
              mimeType={mime}
              src={message.metadata.file_url as string}
              filename={(message.metadata.file_name as string) || 'Image'}
              onImageClick={() => setLightbox({
                open: true,
                src: message.metadata!.file_url as string,
                alt: (message.metadata!.file_name as string) || 'Image',
              })}
            />
            {message.content && (
              <p className={cn(
                "text-[15px] leading-relaxed whitespace-pre-wrap break-words",
                isCustomer ? "text-white" : "text-foreground"
              )}>
                {message.content}
              </p>
            )}
          </div>
        )
      }

      // Non-media file: keep original download link
      return (
        <div className="space-y-2">
          <a
            href={message.metadata.file_url as string}
            download={message.metadata.file_name}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-colors",
              isCustomer
                ? "bg-white/10 hover:bg-white/20"
                : "bg-muted hover:bg-muted/80"
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              isCustomer ? "bg-white/20" : "bg-primary/10"
            )}>
              <FileText className={cn(
                "h-5 w-5",
                isCustomer ? "text-white" : "text-primary"
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-medium truncate",
                isCustomer ? "text-white" : "text-foreground"
              )}>
                {message.metadata.file_name || 'File'}
              </p>
              {message.metadata.file_size && (
                <p className={cn(
                  "text-xs",
                  isCustomer ? "text-white/70" : "text-muted-foreground"
                )}>
                  {((message.metadata.file_size as number) / 1024).toFixed(1)} KB
                </p>
              )}
            </div>
            <Download className={cn(
              "h-4 w-4 flex-shrink-0",
              isCustomer ? "text-white/70" : "text-muted-foreground"
            )} />
          </a>
          {message.content && (
            <p className={cn(
              "text-[15px] leading-relaxed whitespace-pre-wrap break-words",
              isCustomer ? "text-white" : "text-foreground"
            )}>
              {message.content}
            </p>
          )}
        </div>
      )
    }

    return (
      <p className={cn(
        "text-sm",
        isCustomer ? "text-white/70" : "text-muted-foreground"
      )}>
        {t('unsupportedType')}
      </p>
    )
  }
```

- [ ] **Step 4: Add lightbox component to the return JSX**

Right before the closing `</div>` of the component's return (before the line with `<div ref={bottomRef}` — line 380), add:

```tsx
      {/* Image lightbox */}
      <ImageLightbox
        open={lightbox.open}
        onClose={() => setLightbox({ open: false, src: '', alt: '' })}
        slides={[{ src: lightbox.src, alt: lightbox.alt }]}
        index={0}
      />
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/conversation/message-list.tsx
git commit -m "feat: inline image/video preview in conversation messages"
```

---

## Task 9: Add drag-drop + image preview to `message-input.tsx`

**Files:**
- Modify: `src/components/conversation/message-input.tsx`

- [ ] **Step 1: Add imports and update file accept**

Replace the imports section (lines 1-14) with:

```tsx
/**
 * Message Input Component
 *
 * Modern ChatGPT/Gemini-inspired design with drag-and-drop support
 */

'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { ArrowUp, Paperclip, X, FileText, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { useDragDrop } from '@/lib/hooks/use-drag-drop'
import { FILE_ACCEPT } from '@/lib/constants/attachments'
```

- [ ] **Step 2: Add drag-drop hook and image preview state**

Inside the component, after the `fileInputRef` declaration (after line 38), add:

```tsx
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const { isDragging, dragProps } = useDragDrop({
    onFiles: (files) => {
      const file = files[0]
      if (!file) return
      if (file.size > 10 * 1024 * 1024) {
        toast.error(tToast('fileSizeError'))
        return
      }
      setSelectedFile(file)
    },
    disabled: isDisabled,
  })

  // Generate/revoke preview URL for image files
  useEffect(() => {
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setPreviewUrl(null)
  }, [selectedFile])
```

Note: move the `isDisabled` const (line 159) to before the hook usage, or use `disabled || isSending || isUploading || isProcessing` directly in the hook.

- [ ] **Step 3: Replace the file preview section**

Replace the file preview block (lines 174-204) with:

```tsx
        {/* File preview - inside the input box */}
        {selectedFile && (
          <div className="px-4 pt-3">
            {previewUrl ? (
              <div className="relative inline-block">
                <img
                  src={previewUrl}
                  alt={selectedFile.name}
                  className="max-h-32 max-w-[200px] rounded-xl object-contain"
                />
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  disabled={isDisabled}
                  className="absolute -top-2 -right-2 p-1 rounded-full bg-background border shadow-sm
                    hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/80 border border-border/50 max-w-xs">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-blue-500/15">
                  <FileText className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  disabled={isDisabled}
                  className="p-1 rounded-full hover:bg-background/80 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
```

- [ ] **Step 4: Add drag-drop props and visual feedback to the container**

Replace the main container `<div>` (the one with `"relative flex flex-col w-full rounded-3xl..."` around line 167) to include `dragProps` and `isDragging` state:

```tsx
      <div
        {...dragProps}
        className={cn(
          "relative flex flex-col w-full rounded-3xl border bg-background/80 backdrop-blur-sm transition-all duration-300",
          isDragging
            ? "border-primary border-dashed shadow-lg ring-2 ring-primary/20"
            : isFocused
              ? "border-border shadow-lg ring-1 ring-border/50"
              : "border-border/50 shadow-md hover:border-border hover:shadow-lg"
        )}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-primary/5 backdrop-blur-[1px]">
            <div className="flex flex-col items-center gap-2 text-primary">
              <Upload className="h-8 w-8" />
              <p className="text-sm font-medium">{tDragDrop('release')}</p>
            </div>
          </div>
        )}
```

- [ ] **Step 5: Add the `tDragDrop` translation hook**

After the existing translation hooks (around line 32), add:

```tsx
  const tDragDrop = useTranslations('components.dragDrop')
```

- [ ] **Step 6: Update the file input accept attribute**

Replace the `accept` attribute on the hidden file input (line 214) to use the shared constant:

```tsx
            accept={FILE_ACCEPT}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/conversation/message-input.tsx
git commit -m "feat: add drag-drop and image thumbnail preview to message input"
```

---

## Task 10: Add drag-drop to customer ticket reply area

**Files:**
- Modify: `src/app/customer/my-tickets/[id]/page.tsx`

- [ ] **Step 1: Add imports**

Add to the imports section of the file:

```tsx
import { useDragDrop } from '@/lib/hooks/use-drag-drop'
import { useTranslations as useDragDropTranslations } from 'next-intl'
```

Note: `useTranslations` is likely already imported. Just add the `useDragDrop` import.

- [ ] **Step 2: Add drag-drop hook**

Inside the component, after the `useFileUpload` hook (around line 70), add:

```tsx
  const tDragDrop = useTranslations('components.dragDrop')

  const { isDragging, dragProps } = useDragDrop({
    onFiles: async (files) => {
      await addFiles(files)
    },
    disabled: submitting || isUploading,
  })
```

- [ ] **Step 3: Wrap the mobile reply area with drag props**

Find the mobile reply outer `<div>` (the one with `className="lg:hidden flex-shrink-0 border-t..."` around line 352). Wrap its inner content div with drag props:

Replace:
```tsx
                <div className="p-2">
                  <div className="relative flex flex-col gap-2 rounded-lg border bg-background p-2 focus-within:ring-1 focus-within:ring-ring transition-all duration-200">
```

With:
```tsx
                <div className="p-2">
                  <div
                    {...dragProps}
                    className={cn(
                      "relative flex flex-col gap-2 rounded-lg border bg-background p-2 focus-within:ring-1 focus-within:ring-ring transition-all duration-200",
                      isDragging && "border-primary border-dashed ring-2 ring-primary/20"
                    )}
                  >
                    {isDragging && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-primary/5">
                        <p className="text-sm font-medium text-primary">{tDragDrop('release')}</p>
                      </div>
                    )}
```

- [ ] **Step 4: Wrap the desktop reply area with drag props**

Find the desktop reply `<Textarea>` section (around line 526 in the sidebar). Wrap its container similarly:

Find the desktop reply container `<div className="flex flex-col relative w-full gap-2">` and wrap it:

```tsx
                  <div {...dragProps} className={cn(
                    "flex flex-col relative w-full gap-2",
                    isDragging && "ring-2 ring-primary/20 rounded-lg"
                  )}>
                    {isDragging && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-primary/5">
                        <p className="text-sm font-medium text-primary">{tDragDrop('release')}</p>
                      </div>
                    )}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add "src/app/customer/my-tickets/[id]/page.tsx"
git commit -m "feat: add drag-drop upload to customer ticket reply area"
```

---

## Task 11: Add drag-drop to `ticket-actions.tsx`

**Files:**
- Modify: `src/components/ticket/ticket-actions.tsx`

- [ ] **Step 1: Add imports**

Add after the existing imports:

```tsx
import { useDragDrop } from '@/lib/hooks/use-drag-drop'
```

- [ ] **Step 2: Add drag-drop hook**

Inside `TicketActions`, after the `useFileUpload` hook (after line 90), add:

```tsx
  const tDragDrop = useTranslations('components.dragDrop')

  const { isDragging, dragProps } = useDragDrop({
    onFiles: async (files) => {
      await addFiles(files)
    },
    disabled: isLoading || isUploading || uploadedFiles.length >= ATTACHMENT_LIMITS.MAX_COUNT,
  })
```

Note: `useTranslations` is already imported on line 24.

- [ ] **Step 3: Add drag props to the reply textarea area**

Find the `<Card>` containing the reply section (the second `<Card>` around line 317). Wrap the textarea's parent `<div className="flex-1 min-h-0 relative">` (line 366):

Replace:
```tsx
          <div className="flex-1 min-h-0 relative">
            <Textarea
```

With:
```tsx
          <div {...dragProps} className={cn("flex-1 min-h-0 relative", isDragging && "ring-2 ring-primary/20 rounded-lg")}>
            {isDragging && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-primary/5">
                <p className="text-sm font-medium text-primary">{tDragDrop('release')}</p>
              </div>
            )}
            <Textarea
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ticket/ticket-actions.tsx
git commit -m "feat: add drag-drop upload to staff ticket reply area"
```

---

## Task 12: Final verification

- [ ] **Step 1: Full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Run existing tests**

```bash
npm run test
```

Expected: All existing tests pass. No regressions.

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit any remaining changes**

If any fixes were needed, commit them:

```bash
git add -A
git commit -m "fix: address build/test issues from attachment preview feature"
```
