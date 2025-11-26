/**
 * Message Input Component
 * 
 * Input field for sending messages with file upload support
 */

'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Paperclip, X } from 'lucide-react'
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
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
      }
    }
  }
  
  const isDisabled = disabled || isSending || isUploading
  const canSend = (message.trim() || selectedFile) && !isDisabled
  
  return (
    <div className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-lg backdrop-blur-sm">
      {/* File preview */}
      {selectedFile && (
        <div className="mb-2 flex items-center gap-2 p-2 bg-muted rounded-xl border border-border/60">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
          <span className="text-xs text-muted-foreground">
            {(selectedFile.size / 1024).toFixed(1)} KB
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemoveFile}
            disabled={isDisabled}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {/* File upload button */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept="image/*,.pdf,.doc,.docx,.txt"
          disabled={isDisabled}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={isDisabled}
          title={t('attachFile')}
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        {/* Message input */}
        <div className="flex-1 rounded-xl border border-border/60 bg-background/80 shadow-inner px-3 py-2 transition focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={actualPlaceholder}
            disabled={isDisabled}
            className={cn(
              "min-h-[48px] max-h-36 w-full resize-none bg-transparent p-0 ring-0 focus-visible:ring-0 focus-visible:outline-none",
              "text-sm leading-6"
            )}
            rows={1}
          />
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                {t('enterToSend')}
              </span>
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                {t('shiftEnterNewLine')}
              </span>
            </div>
            {message.length > maxLength * 0.8 && (
              <span>
                {message.length} / {maxLength}
              </span>
            )}
          </div>
        </div>
      
        {/* Send button */}
        <div className="flex items-center justify-end sm:justify-center">
          <Button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            size="icon"
            className="h-11 w-11 rounded-full shadow-sm"
            title={t('sendMessage')}
          >
            {isUploading ? (
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
