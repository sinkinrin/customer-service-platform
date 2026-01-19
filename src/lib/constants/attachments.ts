/**
 * Attachment Configuration Constants
 *
 * Centralized configuration for file upload limits, allowed types,
 * and accept patterns used throughout the application.
 */

// File size limits
export const ATTACHMENT_LIMITS = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB per file
  MAX_COUNT: 5, // Maximum files per upload
  UPLOAD_TIMEOUT: 120000, // 120 seconds for upload timeout
}

// Allowed MIME types for server-side validation
export const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  // Archives
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'application/x-7z-compressed',
  // Videos
  'video/mp4',
  'video/x-ms-wmv',
  'video/x-msvideo',
  'video/quicktime',
  'video/x-matroska',
]

// File accept pattern for HTML input elements
export const FILE_ACCEPT =
  'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.mp4,.wmv,.avi,.mov,.mkv'

// Validate if a MIME type is allowed
export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType)
}

// Get human-readable file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/**
 * Sanitize filename to prevent path traversal and XSS attacks
 * Removes dangerous characters and limits length
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return 'unnamed_file'

  return filename
    // Remove path separators (prevent path traversal)
    .replace(/[/\\]/g, '')
    // Remove path traversal attempts
    .replace(/\.\./g, '')
    // Remove control characters
    .replace(/[\x00-\x1f\x80-\x9f]/g, '')
    // Remove potentially dangerous characters for HTML/URLs
    .replace(/[<>:"|?*]/g, '')
    // Trim whitespace
    .trim()
    // Limit length to 255 characters
    .slice(0, 255)
    // Ensure we have a valid filename
    || 'unnamed_file'
}
