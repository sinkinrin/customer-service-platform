# Attachment Inline Preview & Drag-Drop Upload

> Design spec for inline media preview and drag-and-drop upload across the customer service platform.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Video scope | Lightweight: 10MB limit, short clips only | Customer service scenarios (screen recordings, bug repros) |
| Drag-drop scope | All 3 input areas (conversation, customer ticket, staff ticket) | Shared hook minimizes duplication |
| Lightbox | `yet-another-react-lightbox` library | Zoom, keyboard nav, mobile pinch, a11y — ~15KB gzip |
| Ticket image src | Existing proxy route + `?inline=true` + browser cache | Zero new dependencies, `Cache-Control: private, max-age=3600` |
| Video message type | No new type — detect video MIME within `file` branch | Avoids data model changes |
| SVG | Removed from upload whitelist | XSS risk via embedded scripts |

## 1. Network Performance Strategy

| Strategy | Implementation | Effect |
|---|---|---|
| Lazy loading | `<img loading="lazy">`, `<video preload="metadata">` | Only load visible media |
| Browser cache | `Cache-Control: private, max-age=3600` (already exists) | No repeat requests within 1 hour |
| Size constraints | Images `max-width: 320px`, videos `max-width: 400px`, `object-fit: contain` | Prevent layout blowout |
| Skeleton placeholder | Known aspect ratio placeholder before load | Avoid CLS |
| Click-to-fullsize | Thumbnail click → lightbox loads original | Reduce unnecessary large downloads |
| Video no-autoload | `preload="metadata"` loads only metadata (~KB), play on user click | Video doesn't consume initial bandwidth |

**GIF policy:** Animated GIFs render via `<img>` and autoplay as browsers natively do. The 10MB upload limit already constrains GIF file size. No special freeze-frame treatment — the bandwidth impact is acceptable given the size cap and lazy loading.

**Not doing:** Server-side thumbnails (sharp dependency), image CDN, base64 inline.

## 2. Shared Components

### 2.1 `src/lib/hooks/use-drag-drop.ts`

```
Input:  { onFiles, disabled?, accept? }
Output: { isDragging, dragProps }

dragProps binds to container:
  onDragEnter → isDragging=true
  onDragOver  → preventDefault
  onDragLeave → isDragging=false (only on container boundary exit)
  onDrop      → extract files → filter by accept → call onFiles(files)
```

Consumed by: `message-input.tsx`, `customer/my-tickets/[id]`, `ticket-actions.tsx`.

Visual feedback when `isDragging`: blue dashed border + overlay with hint text.

### 2.2 `src/components/ui/media-renderer.tsx`

```
Props: { mimeType, src, filename, size, onImageClick? }

Rendering:
  isImage(mime) → <img loading="lazy"> + click triggers onImageClick
  isVideo(mime) → <video preload="metadata" controls>
  other         → existing download link style (Paperclip + filename + Download)

Error handling:
  <img onError> / <video onError> → fallback to download link style (filename + download icon)
  Prevents broken image icons and unplayable video placeholders.
```

Consumed by: `article-content.tsx`, `message-list.tsx`.

### 2.3 `src/components/ui/image-lightbox.tsx`

```
Props: { open, onClose, slides: { src, alt }[], index }

Thin wrapper around yet-another-react-lightbox.
Features: fullscreen, zoom, Esc close, keyboard nav, left/right arrow between images.
Single-image case: pass slides array with one element.
```

Triggered by `media-renderer`'s `onImageClick`.

### 2.4 Helper functions in `src/lib/constants/attachments.ts`

```ts
isImageType(mime: string): boolean
// Matches: image/jpeg, image/png, image/gif, image/webp, image/bmp
// Excludes: image/svg+xml

isVideoType(mime: string): boolean
// Matches: video/mp4, video/quicktime, video/x-msvideo, video/x-ms-wmv, video/x-matroska
```

## 3. Consumer Changes

### 3.1 `article-content.tsx` — Ticket attachment inline preview

Split `displayAttachments` into:
- `mediaAttachments` (isImage || isVideo) → `<media-renderer>` grid (flex-wrap, gap-2)
  - `src="/api/tickets/{tid}/articles/{aid}/attachments/{attId}?inline=true"`
  - Image click → open lightbox
- `otherAttachments` → keep existing download link style

Component maintains `lightboxState: { open, slides[], index }`.
Clicking any image opens lightbox at that index; user can arrow between all images in the article.

### 3.2 `message-list.tsx` — Conversation message rendering

- `message_type === 'image'` → `<media-renderer>` + lightbox (replaces bare `<img>`)
- `message_type === 'file'` + `isVideoType(mime)` → `<media-renderer>` as `<video>`
- `message_type === 'file'` + `isImageType(mime)` → `<media-renderer>` as `<img>` (fallback)
- Other `file` → keep download link

No new `video` message_type — MIME detection within `file` branch.

### 3.3 `message-input.tsx` — Drag-drop + image preview

- Integrate `use-drag-drop` hook on the main container
- `isDragging` → blue dashed border + overlay hint
- Selected image → `URL.createObjectURL()` thumbnail preview (`max-h-32 rounded-xl`)
- Selected non-image → keep existing icon + filename style
- On send/remove → `URL.revokeObjectURL()` to release memory
- On component unmount → cleanup any remaining object URLs

### 3.4 Customer ticket reply (`my-tickets/[id]/page.tsx`)

- Both mobile and desktop reply areas bind `dragProps` on outer `<div>`
- `isDragging` → overlay hint
- `onFiles` → call existing `addFiles()`
- Uploaded image files show thumbnail in file list instead of plain filename
- `URL.revokeObjectURL()` on file remove, send success, and component unmount

### 3.5 Staff ticket actions (`ticket-actions.tsx`)

- Reply textarea area binds `dragProps`
- Same logic as 3.4 (including `revokeObjectURL` cleanup)
- Admin ticket page (`admin/tickets/[id]`) reuses `TicketActions` component — automatically covered

## 4. API Changes

### 4.1 Attachment download route — dual mode

`src/app/api/tickets/[id]/articles/[articleId]/attachments/[attachmentId]/route.ts`

```
Read ?inline query param:
  ?inline=true AND mimeType is image/* or video/*
    → Content-Disposition: inline
  Otherwise
    → Content-Disposition: attachment (existing behavior preserved)
```

Backward compatible: no `?inline` param = same behavior as today.

### 4.2 `/api/files/upload/route.ts` — MIME whitelist fix

- **Remove** `image/svg+xml` (XSS risk)
- **Add** `video/mp4`, `video/quicktime`, `video/x-msvideo` (align with `attachments.ts`)

### 4.3 `/api/files/[id]/download/route.ts` — No changes needed

Already uses `Content-Disposition: inline` and `Cache-Control: private, max-age=3600`.

### 4.4 Security constraints

| Risk | Mitigation |
|---|---|
| SVG XSS | Removed from upload whitelist; `media-renderer` only uses `<img>` tag (sandboxes scripts) |
| MIME spoofing | Existing magic byte detection (`fileTypeFromBuffer`) unchanged |
| Large file DoS | 10MB limit unchanged; `<video preload="metadata">` no auto-download |
| Path traversal | Existing `sanitizeFilename()` unchanged |
| `?inline=true` abuse | Only effective for `image/*` and `video/*`; other MIME types forced to `attachment` |

## 5. Email Attachment Flow — Unaffected

```
Staff drags image → use-file-upload → /api/attachments/upload → Zammad upload_caches (form_id)
                                                                        ↓
Staff submits reply (type: 'email') → /api/tickets/[id]/articles → Zammad createArticle(form_id)
                                                                        ↓
                                                            ┌───────────┴───────────┐
                                                            ↓                       ↓
                                                  Zammad sends email          Web UI renders article
                                                  (attachments included)      (now with inline preview)
```

Upload path, article creation, and email sending are completely unchanged. Only the web rendering layer is modified.

## 6. i18n

5 new keys across 6 language files (en, zh-CN, fr, es, ru, pt):

```
components.dragDrop.hint        — "Drop files here to upload"
components.dragDrop.hintImage   — "Drop images here to upload"
components.dragDrop.release     — "Release to upload"
components.mediaRenderer.play   — "Play video"
components.mediaRenderer.load   — "Loading..."
```

## 7. New Dependencies

| Package | Purpose | Size |
|---|---|---|
| `yet-another-react-lightbox` | Image lightbox | ~15KB gzip |

## 8. File Manifest

### New files (3)

| File | Type |
|---|---|
| `src/lib/hooks/use-drag-drop.ts` | Hook |
| `src/components/ui/media-renderer.tsx` | Component |
| `src/components/ui/image-lightbox.tsx` | Component |

### Modified files (12)

| File | Change |
|---|---|
| `src/components/ticket/article-content.tsx` | Attachment area uses media-renderer instead of download links |
| `src/components/conversation/message-list.tsx` | Use media-renderer for image/video/file messages |
| `src/components/conversation/message-input.tsx` | Integrate drag-drop + image thumbnail preview |
| `src/app/customer/my-tickets/[id]/page.tsx` | Integrate drag-drop |
| `src/components/ticket/ticket-actions.tsx` | Integrate drag-drop |
| `src/app/api/tickets/.../attachments/[id]/route.ts` | Add `?inline=true` support |
| `src/app/api/files/upload/route.ts` | Remove SVG, add video MIME types |
| `src/lib/constants/attachments.ts` | Add isImageType / isVideoType helpers |
| `messages/en.json` | Drag-drop and media translation keys |
| `messages/zh-CN.json` | Same |
| `messages/fr.json` | Same |
| `messages/es.json` | Same |
| `messages/ru.json` | Same |
| `messages/pt.json` | Same |

## 9. Explicitly Excluded

- Prisma schema / database changes
- New `video` message_type in conversation store
- Zammad upload flow changes
- Email sending flow changes
- File size limit changes (stays 10MB)
- Server-side thumbnail generation
- Existing download behavior (backward compatible)
