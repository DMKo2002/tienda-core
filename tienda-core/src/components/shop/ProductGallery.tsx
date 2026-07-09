'use client'

import { useState } from 'react'
import { ImageOff } from 'lucide-react'

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
  const activeImg = images[activeIdx]

  if (images.length === 0) {
    return (
      <div className="aspect-[3/4] bg-[#F2EEE9] flex items-center justify-center">
        <ImageOff size={40} className="text-[var(--color-border)]" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Imagen principal */}
      <div className="aspect-[3/4] bg-[#F2EEE9] overflow-hidden">
        <img
          src={activeImg?.url}
          alt={productName}
          className="w-full h-full object-cover transition-opacity duration-200"
        />
      </div>

      {/* Miniaturas clickeables */}
      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveIdx(i)}
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
