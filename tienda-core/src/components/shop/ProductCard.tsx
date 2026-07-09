'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ImageOff } from 'lucide-react'

interface ProductCardProps {
  id: string
  name: string
  slug: string
  coverUrl?: string | null
  retailPrice?: number | null
  retailCompareAt?: number | null
  wholesalePrice?: number | null
  showWholesale?: boolean
  showPrices?: boolean
  priceVisibility?: 'all' | 'logged_in' | 'wholesale_only'
  isRetailUser?: boolean
  index?: number
  colors?: string[]
  sizes?: string[]
}

const formatPrice = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

// Mapa de nombres de color en español → hex
const COLOR_MAP: Record<string, string> = {
  negro: '#1C1C1C', blanco: '#F5F5F0', crema: '#F0EBE1', beige: '#D4C5A9',
  marfil: '#FFFFF0', gris: '#9E9E9E', 'gris claro': '#D0D0D0', 'gris oscuro': '#555555',
  rojo: '#C0392B', bordo: '#7B2D42', vino: '#6B2737', rosa: '#E8A0B0',
  coral: '#E8714A', naranja: '#E8813A', mostaza: '#C8A84B', amarillo: '#F0CC4A',
  azul: '#3A7BC8', 'azul marino': '#1B3A6B', 'azul claro': '#7EB8E0', celeste: '#87CEEB',
  verde: '#4A9B6F', 'verde oscuro': '#2D6A4F', esmeralda: '#2E8B6E', turquesa: '#3AADA8',
  lila: '#B09BC8', violeta: '#8E44AD', morado: '#6C3483',
  camel: '#C19A6B', tabaco: '#8B6355', chocolate: '#5C3A1E', tiza: '#E8E4DC', off: '#F5F2EC',
}

function getColorHex(name: string): string {
  if (/^#[0-9A-Fa-f]{3,6}$/.test(name.trim())) return name.trim()
  return COLOR_MAP[name.toLowerCase().trim()] ?? '#CCCCCC'
}

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 180
}

export default function ProductCard({
  id, name, slug, coverUrl, retailPrice, retailCompareAt, wholesalePrice,
  showWholesale = false, showPrices = true, priceVisibility = 'all', isRetailUser = false, index = 0, colors = [], sizes = []
}: ProductCardProps) {

  // Props pre-procesadas desde tienda/page.tsx:
  //   retailPrice     = precio efectivo (lo que paga el cliente, ej: 18000)
  //   retailCompareAt = precio regular tachado (el más alto, ej: 20000)
  const hasDiscount = !!(retailCompareAt && retailCompareAt > (retailPrice ?? 0))
  const salePrice   = retailPrice
  const discountPct = hasDiscount
    ? Math.round((1 - retailPrice! / retailCompareAt!) * 100)
    : null

  return (
    <Link
      href={`/tienda/${slug}`}
      className="group block opacity-0 animate-fade-up"
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'forwards' }}
    >
      {/* Imagen */}
      <div className="product-img-wrap bg-[#F2EEE9] aspect-[3/4] w-full mb-3 relative overflow-hidden">
        {coverUrl ? (
          <Image
            src={coverUrl.split('?')[0]}
            alt={name}
            fill
            className="object-cover transition-opacity duration-300"
            sizes="(max-width: 768px) 50vw, 25vw"
            priority={index < 6}
            loading={index < 6 ? 'eager' : 'lazy'}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff size={32} className="text-[var(--color-border)]" />
          </div>
        )}

        {/* Badge descuento */}
        {discountPct && (
          <div className="absolute top-2 left-2 bg-[var(--color-charcoal)] text-white text-[10px] tracking-[0.1em] uppercase px-2 py-1">
            -{discountPct}%
          </div>
        )}
      </div>

      {/* Info */}
      <div>
        <p className="text-sm font-light text-[var(--color-charcoal)] leading-snug group-hover:text-[var(--color-stone)] transition-colors mb-1.5">
          {name}
        </p>

        {/* Precio */}
        <div className="flex items-center gap-2 mb-2.5">
          {showPrices ? (
            <>
              {salePrice ? (
                <>
                  <span className={`text-sm ${hasDiscount ? 'text-[var(--color-charcoal)] font-medium' : 'text-[var(--color-charcoal)]'}`}>
                    {formatPrice(salePrice)}
                  </span>
                  {hasDiscount && (
                    <span className="text-xs text-[var(--color-stone)] line-through">
                      {formatPrice(retailCompareAt!)}
                    </span>
                  )}
                  {showWholesale && wholesalePrice && (
                    <span className="text-xs text-[var(--color-stone)]">
                      Mayor: {formatPrice(wholesalePrice)}
                    </span>
                  )}
                </>
              ) : showWholesale && wholesalePrice ? (
                <span className="text-sm text-[var(--color-charcoal)]">
                  {formatPrice(wholesalePrice)}
                </span>
              ) : null}
            </>
          ) : isRetailUser ? (
            <span className="text-xs text-[var(--color-stone)]">
              Solo para cuentas mayoristas
            </span>
          ) : (
            <a
              href="/cuenta/login"
              onClick={e => e.stopPropagation()}
              className="text-xs text-[var(--color-stone)] hover:text-[var(--color-charcoal)] transition-colors underline"
            >
              {priceVisibility === 'wholesale_only' ? 'Iniciá sesión para ver precio' : 'Iniciá sesión para ver precio'}
            </a>
          )}
        </div>

        {/* Colores */}
        {colors.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-2">
            {colors.map(color => {
              const hex = getColorHex(color)
              const light = isLight(hex)
              return (
                <span
                  key={color}
                  title={color}
                  style={{
                    backgroundColor: hex,
                    width: 16, height: 16, borderRadius: '50%', display: 'inline-block',
                    border: light ? '1px solid #D0CBC3' : '1px solid transparent', flexShrink: 0,
                  }}
                />
              )
            })}
          </div>
        )}

        {/* Talles */}
        {sizes.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {sizes.map(size => (
              <span
                key={size}
                style={{
                  fontSize: 10, letterSpacing: '0.05em', color: 'var(--color-stone)',
                  border: '1px solid var(--color-border)', borderRadius: 3,
                  padding: '1px 5px', lineHeight: 1.6,
                }}
              >
                {size}
              </span>
            ))}
          </div>
        )}
      </div>
        </Link>
  )
}
