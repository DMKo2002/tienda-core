'use client'

import { useState } from 'react'
import { ImageOff, ChevronLeft, ChevronRight } from 'lucide-react'

interface Image {
  id: string
  url: string
  is_cover: boolean
}

interface ProductGalleryProps {
  images: Image[]
  productName: string
}

export default function ProductGallery({ images, productName }: ProductGalleryProps) {
  const coverIndex = images.findIndex(i => i.is_cover)
  const [activeIdx, setActiveIdx] = useState(coverIndex >= 0 ? coverIndex : 0)
  const [mainHover, setMainHover] = useState(false)
  const activeImg = images[activeIdx]

  if (images.length === 0) {
    return (
      <div className="aspect-[3/4] bg-[#F2EEE9] flex items-center justify-center">
        <ImageOff size={40} className="text-[var(--color-border)]" />
      </div>
    )
  }

  function goPrev() {
    setActiveIdx(i => (i - 1 + images.length) % images.length)
  }
  function goNext() {
    setActiveIdx(i => (i + 1) % images.length)
  }

  return (
    <div className="space-y-3">
      {/* Imagen principal */}
      <div
        className="aspect-[3/4] bg-[#F2EEE9] overflow-hidden relative"
        onMouseEnter={() => setMainHover(true)}
        onMouseLeave={() => setMainHover(false)}
      >
        <img
          src={activeImg?.url}
          alt={productName}
          className="w-full h-full object-cover transition-opacity duration-200"
        />

        {/* Flechas de carousel — mismo comportamiento que ProductCard: visibles al hoverear */}
        {mainHover && images.length > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Imagen anterior"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 hover:bg-white flex items-center justify-center text-[var(--color-charcoal)] transition-colors"
            >
              <ChevronLeft size={18} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Imagen siguiente"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 hover:bg-white flex items-center justify-center text-[var(--color-charcoal)] transition-colors"
            >
              <ChevronRight size={18} strokeWidth={2} />
            </button>
          </>
        )}
      </div>

      {/* Miniaturas — cambian la imagen principal al hoverear (click queda como respaldo para touch) */}
      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveIdx(i)}
              onMouseEnter={() => setActiveIdx(i)}
              className={`aspect-square bg-[#F2EEE9] overflow-hidden transition-all ${
                activeIdx === i
                  ? 'ring-2 ring-[var(--color-charcoal)] ring-offset-1'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              <img src={img.url} alt={`${productName} ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
