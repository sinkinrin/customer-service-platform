/**
 * Message Input Component
 *
 * Modern ChatGPT/Gemini-inspired design with drag-and-drop support
 */

'use client'

import { useState, useRef, useEffect, KeyboardEvent, ReactNode } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { ArrowUp, Paperclip, X, FileText, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { useDragDrop } from '@/lib/hooks/use-drag-drop'
import { FILE_ACCEPT, ATTACHMENT_LIMITS, formatFileSize, isImageType } from '@/lib/constants/attachments'

interface MessageInputProps {
  onSend: (content: string, messageType?: 'text' | 'image' | 'file', metadata?: Record<string, unknown>) => Promise<void>
  isSending?: boolean
  disabled?: boolean
  placeholder?: string
  maxLength?: number
  sendLeadingControl?: ReactNode
}

export function MessageInput({
  onSend,
  isSending = false,
  disabled = false,
  placeholder,
  maxLength = 2000,
  sendLeadingControl,
}: MessageInputProps) {
  const t = useTranslations('components.conversation.messageInput')
  const tToast = useTranslations('toast.components.messageInput')
  const [message, setMessage] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  // Track if currently processing to prevent double submission
  const [isProcessing, setIsProcessing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const isDisabled = disabled || isSending || isUploading || isProcessing

  const tDragDrop = useTranslations('components.dragDrop')

  const { isDragging, dragProps } = useDragDrop({
    onFiles: (files) => {
      const file = files[0]
      if (!file) return
      if (file.size > ATTACHMENT_LIMITS.MAX_SIZE) {
        toast.error(tToast('fileSizeError'))
        return
      }
      setSelectedFile(file)
    },
    disabled: isDisabled,
  })

  useEffect(() => {
    if (selectedFile && isImageType(selectedFile.type)) {
      const url = URL.createObjectURL(selectedFile)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setPreviewUrl(null)
  }, [selectedFile])

  const actualPlaceholder = placeholder || t('placeholder')

  // Handle send message
  const handleSend = async () => {
    if (!message.trim() && !selectedFile) return
    if (isSending || isUploading || isProcessing) return

    // Prevent double submission
    setIsProcessing(true)

    try {
      let messageType: 'text' | 'image' | 'file' = 'text'
      let metadata: Record<string, unknown> | undefined

      // Upload file if selected
      if (selectedFile) {
        setIsUploading(true)

        const formData = new FormData()
        formData.append('file', selectedFile)
        formData.append('reference_type', 'message')

        const uploadResponse = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        })

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload file')
        }

        const uploadData = await uploadResponse.json()
        const fileData = uploadData.data

        // Determine message type based on MIME type
        if (fileData.mime_type && isImageType(fileData.mime_type)) {
          messageType = 'image'
        } else {
          messageType = 'file'
        }

        metadata = {
          file_name: fileData.file_name,
          file_size: fileData.file_size,
          file_url: fileData.file_url,
          mime_type: fileData.mime_type,
        }

        setIsUploading(false)
      }

      // Send message
      await onSend(message.trim(), messageType, metadata)

      // Clear input
      setMessage('')
      setSelectedFile(null)

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch (err) {
      const error = err as Error
      console.error('Error sending message:', error)
      toast.error(tToast('sendError'))
      setIsUploading(false)
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle Enter key
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > ATTACHMENT_LIMITS.MAX_SIZE) {
      toast.error(tToast('fileSizeError'))
      return
    }

    setSelectedFile(file)
  }

  // Remove selected file
  const handleRemoveFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    if (value.length <= maxLength) {
      setMessage(value)

      // Auto-resize
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
      }
    }
  }

  const canSend = (message.trim() || selectedFile) && !isDisabled

  return (
    <div className="w-full">
      {/* Main input container - ChatGPT/Gemini style */}
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
                    {formatFileSize(selectedFile.size)}
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

        {/* Input row */}
        <div className="flex items-end gap-2 p-3">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            accept={FILE_ACCEPT}
            disabled={isDisabled}
          />

          {/* File upload button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isDisabled}
            title={t('attachFile')}
            className={cn(
              "flex items-center justify-center h-11 w-11 rounded-full flex-shrink-0",
              "text-muted-foreground/70 hover:text-foreground hover:bg-muted/60",
              "transition-all duration-200",
              isDisabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <Paperclip className="h-5 w-5" />
          </button>

          {/* Message input */}
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={actualPlaceholder}
            disabled={isDisabled}
            className={cn(
              "flex-1 min-h-[52px] max-h-[200px] py-3.5 px-3 resize-none",
              "bg-transparent border-0 shadow-none",
              "ring-0 focus-visible:ring-0 focus-visible:outline-none",
              "text-base leading-relaxed placeholder:text-muted-foreground/60",
              "scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
            )}
            rows={1}
          />

          {sendLeadingControl && (
            <div className="flex-shrink-0">
              {sendLeadingControl}
            </div>
          )}

          {/* Send button - circular like ChatGPT */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            title={t('sendMessage')}
            className={cn(
              "flex items-center justify-center h-11 w-11 rounded-full flex-shrink-0",
              "transition-all duration-200",
              canSend
                ? "bg-foreground text-background hover:bg-foreground/90 shadow-sm hover:shadow-md active:scale-95"
                : "bg-muted text-muted-foreground/50 cursor-not-allowed"
            )}
          >
            {isUploading || isSending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
            )}
          </button>
        </div>

        {/* Character count - subtle, only when approaching limit */}
        {message.length > maxLength * 0.8 && (
          <div className="flex justify-end px-4 pb-2">
            <span className={cn(
              "text-xs tabular-nums",
              message.length > maxLength * 0.95
                ? "text-destructive"
                : "text-muted-foreground/60"
            )}>
              {message.length}/{maxLength}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
