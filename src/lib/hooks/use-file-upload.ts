import { useState, useCallback, useMemo, useRef } from 'react'
import { ATTACHMENT_LIMITS } from '@/lib/constants/attachments'

/**
 * Represents a file being uploaded or already uploaded
 */
export interface UploadedFile {
  file: File
  attachmentId: number | null
  uploading: boolean
  error?: string
}

/**
 * Options for the useFileUpload hook
 */
export interface UseFileUploadOptions {
  maxCount?: number
  maxSize?: number
  onError?: (message: string) => void
}

/**
 * Return type for the useFileUpload hook
 */
export interface UseFileUploadReturn {
  uploadedFiles: UploadedFile[]
  isUploading: boolean
  addFiles: (files: FileList | File[]) => Promise<void>
  removeFile: (index: number) => void
  clearFiles: () => void
  getAttachmentIds: () => number[]
  getFormId: () => string | null
}

/**
 * Upload a single file to Zammad via the API
 * Returns both the attachment ID and the form_id for later reference
 */
async function uploadFileToServer(
  file: File,
  formId?: string
): Promise<{ id: number; form_id: string }> {
  const formData = new FormData()
  formData.append('file', file)
  // Pass form_id to group multiple uploads together
  if (formId) {
    formData.append('form_id', formId)
  }

  const response = await fetch('/api/attachments/upload', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    let errorMessage = 'Upload failed'
    try {
      const error = await response.json()
      errorMessage = error.error?.message || errorMessage
    } catch {
      // Response is not JSON, use default message
    }
    throw new Error(errorMessage)
  }

  const result = await response.json()
  return { id: result.data.id, form_id: result.data.form_id }
}

/**
 * Custom hook for managing file uploads to Zammad
 *
 * Features:
 * - Immediate upload on file selection
 * - Upload status tracking per file
 * - File count and size validation
 * - Returns attachment IDs for form submission
 *
 * @example
 * ```tsx
 * const { uploadedFiles, isUploading, addFiles, removeFile, getAttachmentIds } = useFileUpload({
 *   maxCount: 5,
 *   onError: (msg) => toast.error(msg)
 * })
 *
 * // In file input handler
 * const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 *   if (e.target.files) {
 *     addFiles(e.target.files)
 *   }
 * }
 *
 * // When submitting form
 * const attachmentIds = getAttachmentIds()
 * ```
 */
export function useFileUpload(options: UseFileUploadOptions = {}): UseFileUploadReturn {
  const {
    maxCount = ATTACHMENT_LIMITS.MAX_COUNT,
    maxSize = ATTACHMENT_LIMITS.MAX_SIZE,
    onError,
  } = options

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  // Track the form_id for this upload session (all files share the same form_id)
  const formIdRef = useRef<string | null>(null)

  // Check if any files are still uploading
  const isUploading = useMemo(
    () => uploadedFiles.some(f => f.uploading),
    [uploadedFiles]
  )

  // Add and upload files
  const addFiles = useCallback(async (files: FileList | File[]) => {
    const selectedFiles = Array.from(files)

    // Validate file count
    if (uploadedFiles.length + selectedFiles.length > maxCount) {
      onError?.(`Maximum ${maxCount} files allowed`)
      return
    }

    // Validate file sizes
    const oversizedFiles = selectedFiles.filter(f => f.size > maxSize)
    if (oversizedFiles.length > 0) {
      onError?.(`File size exceeds limit`)
      return
    }

    // Get starting index for the new files
    const startIndex = uploadedFiles.length

    // Add files with uploading state
    const newFiles: UploadedFile[] = selectedFiles.map(file => ({
      file,
      attachmentId: null,
      uploading: true,
    }))

    setUploadedFiles(prev => [...prev, ...newFiles])

    // Upload files immediately, using shared form_id
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i]
      const fileIndex = startIndex + i

      try {
        // Pass existing form_id to group uploads together
        const result = await uploadFileToServer(file, formIdRef.current || undefined)

        // Store the form_id from the first successful upload
        if (!formIdRef.current) {
          formIdRef.current = result.form_id
        }

        setUploadedFiles(prev => prev.map((f, idx) =>
          idx === fileIndex
            ? { ...f, attachmentId: result.id, uploading: false }
            : f
        ))
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed'
        setUploadedFiles(prev => prev.map((f, idx) =>
          idx === fileIndex
            ? { ...f, uploading: false, error: errorMessage }
            : f
        ))
      }
    }
  }, [uploadedFiles.length, maxCount, maxSize, onError])

  // Remove a file by index
  const removeFile = useCallback((index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  // Clear all files and reset form_id
  const clearFiles = useCallback(() => {
    setUploadedFiles([])
    formIdRef.current = null
  }, [])

  // Get successfully uploaded attachment IDs
  const getAttachmentIds = useCallback(() => {
    return uploadedFiles
      .filter(f => f.attachmentId !== null && !f.error)
      .map(f => f.attachmentId as number)
  }, [uploadedFiles])

  // Get the form_id for this upload session
  const getFormId = useCallback(() => {
    return formIdRef.current
  }, [])

  return {
    uploadedFiles,
    isUploading,
    addFiles,
    removeFile,
    clearFiles,
    getAttachmentIds,
    getFormId,
  }
}
