/**
 * Message Input Component
 *
 * Minimalist design with elegant interactions
 */

'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Paperclip, X, Image, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

interface MessageInputProps {
  onSend: (content: string, messageType?: 'text' | 'image' | 'file', metadata?: Record<string, unknown>) => Promise<void>
  isSending?: boolean
  disabled?: boolean
  placeholder?: string
  maxLength?: number
}

export function MessageInput({
  onSend,
  isSending = false,
  disabled = false,
  placeholder,
  maxLength = 2000,
}: MessageInputProps) {
  const t = useTranslations('components.conversation.messageInput')
  const tToast = useTranslations('toast.components.messageInput')
  const [message, setMessage] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const actualPlaceholder = placeholder || t('placeholder')

  // Handle send message
  const handleSend = async () => {
    if (!message.trim() && !selectedFile) return
    if (isSending || isUploading) return

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
        if (fileData.mime_type?.startsWith('image/')) {
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

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
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
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
      }
    }
  }

  const isDisabled = disabled || isSending || isUploading
  const canSend = (message.trim() || selectedFile) && !isDisabled
  const isImage = selectedFile?.type.startsWith('image/')

  return (
    <div className="space-y-2">
      {/* File preview */}
      {selectedFile && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-muted/50 animate-in fade-in-0 slide-in-from-bottom-2 duration-150">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
            isImage ? "bg-violet-500/10" : "bg-blue-500/10"
          )}>
            {isImage ? (
              <Image className="h-5 w-5 text-violet-500" />
            ) : (
              <FileText className="h-5 w-5 text-blue-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleRemoveFile}
            disabled={isDisabled}
            className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Input area */}
      <div
        className={cn(
          "relative flex items-end gap-2 rounded-2xl border bg-background transition-all duration-200",
          isFocused
            ? "border-primary/30 shadow-[0_0_0_3px_rgba(var(--primary),0.08)]"
            : "border-border/60 hover:border-border"
        )}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept="image/*,.pdf,.doc,.docx,.txt"
          disabled={isDisabled}
        />

        {/* File upload button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={isDisabled}
          title={t('attachFile')}
          className={cn(
            "h-10 w-10 rounded-xl ml-1 mb-1 flex-shrink-0",
            "text-muted-foreground hover:text-foreground",
            "hover:bg-muted/60 transition-colors"
          )}
        >
          <Paperclip className="h-5 w-5" />
        </Button>

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
            "flex-1 min-h-[44px] max-h-[120px] py-3 px-0 resize-none",
            "bg-transparent border-0 shadow-none",
            "ring-0 focus-visible:ring-0 focus-visible:outline-none",
            "text-[15px] leading-relaxed placeholder:text-muted-foreground/50"
          )}
          rows={1}
        />

        {/* Send button */}
        <Button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          size="icon"
          className={cn(
            "h-10 w-10 rounded-xl mr-1 mb-1 flex-shrink-0",
            "transition-all duration-200",
            canSend
              ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground"
          )}
          title={t('sendMessage')}
        >
          {isUploading ? (
            <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className={cn(
              "h-5 w-5 transition-transform duration-200",
              canSend && "group-hover:translate-x-0.5"
            )} />
          )}
        </Button>
      </div>

      {/* Character count - only show when approaching limit */}
      {message.length > maxLength * 0.8 && (
        <div className="flex justify-end px-2">
          <span className={cn(
            "text-xs tabular-nums",
            message.length > maxLength * 0.95
              ? "text-destructive"
              : "text-muted-foreground"
          )}>
            {message.length}/{maxLength}
          </span>
        </div>
      )}
    </div>
  )
}
