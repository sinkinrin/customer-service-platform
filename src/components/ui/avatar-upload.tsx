'use client'

import { useState, useRef } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Camera, Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

interface AvatarUploadProps {
  currentAvatarUrl?: string | null
  fallbackText?: string
  onUploadSuccess?: (url: string) => void
  onRemove?: () => void
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-16 w-16',
  md: 'h-24 w-24',
  lg: 'h-32 w-32',
}

export function AvatarUpload({
  currentAvatarUrl,
  fallbackText = 'U',
  onUploadSuccess,
  onRemove,
  size = 'lg',
  className,
}: AvatarUploadProps) {
  const t = useTranslations('staff.settings.personalInfo')
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const displayUrl = previewUrl || currentAvatarUrl

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('avatarInvalidType'))
      return
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('avatarTooLarge'))
      return
    }

    // Create preview
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)

    // Upload file
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)

      const response = await fetch('/api/user/avatar', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success && data.data?.avatarUrl) {
        toast.success(t('avatarUpdated'))
        // Update preview to use server URL (persists after page refresh)
        setPreviewUrl(data.data.avatarUrl)
        onUploadSuccess?.(data.data.avatarUrl)
      } else {
        toast.error(data.error?.message || t('avatarUploadError'))
        setPreviewUrl(null)
      }
    } catch (error) {
      console.error('Avatar upload error:', error)
      toast.error(t('avatarUploadError'))
      setPreviewUrl(null)
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async () => {
    try {
      const response = await fetch('/api/user/avatar', {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        setPreviewUrl(null)
        toast.success(t('avatarRemoved'))
        onRemove?.()
      } else {
        toast.error(t('avatarRemoveError'))
      }
    } catch (error) {
      toast.error(t('avatarRemoveError'))
    }
  }

  return (
    <div className={cn('flex items-center gap-4', className)}>
      {/* Avatar Display */}
      <div className="relative group">
        <Avatar className={cn(sizeClasses[size], 'border-2 border-muted')}>
          <AvatarImage src={displayUrl || undefined} alt="Avatar" />
          <AvatarFallback className="text-lg font-medium">
            {fallbackText}
          </AvatarFallback>
        </Avatar>
        
        {/* Upload overlay on hover */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={cn(
            'absolute inset-0 flex items-center justify-center rounded-full',
            'bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity',
            'cursor-pointer disabled:cursor-not-allowed'
          )}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          ) : (
            <Camera className="h-6 w-6 text-white" />
          )}
        </button>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium">{t('avatarLabel')}</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('avatarUploading')}
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                {t('avatarUpload')}
              </>
            )}
          </Button>
          {displayUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={uploading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('avatarRemove')}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {t('avatarHint')}
        </p>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}
