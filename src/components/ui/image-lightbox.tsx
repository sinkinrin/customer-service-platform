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
