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
  placeholder = 'Type a message...',
  maxLength = 2000,
}: MessageInputProps) {
  const [message, setMessage] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
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
      toast.error('Failed to send message')
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
      toast.error('File size must be less than 10MB')
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
    <div className="p-4">
      {/* File preview */}
      {selectedFile && (
        <div className="mb-2 flex items-center gap-2 p-2 bg-muted rounded-lg">
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
      
      <div className="flex gap-2">
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
          title="Attach file"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        
        {/* Message input */}
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isDisabled}
          className="min-h-[44px] max-h-32 resize-none"
          rows={1}
        />
        
        {/* Send button */}
        <Button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          size="icon"
          title="Send message"
        >
          {isUploading ? (
            <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      {/* Character count */}
      {message.length > maxLength * 0.8 && (
        <div className="mt-1 text-xs text-right text-muted-foreground">
          {message.length} / {maxLength}
        </div>
      )}
    </div>
  )
}

