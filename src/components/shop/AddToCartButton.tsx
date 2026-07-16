'use client'

import { useState } from 'react'
import { useCart } from './CartContext'
import { ShoppingBag, Check } from 'lucide-react'

interface Variant {
  id: string
  size: string | null
  color: string | null
  // Hex real elegido en Panel Admin (cuentagotas/selector) — independiente del
  // nombre. Si no está seteado (variantes viejas), se deriva del nombre.
  color_hex?: string | null
  stock: number
  price_rules: { type: string; price: number; compare_at_price?: number; min_qty: number; active: boolean }[]
}

interface AddToCartButtonProps {
  showPrices?: boolean
  ignoreStock?: boolean
  isWholesale?: boolean
  minQty?: number
  product: {
    id: string
    name: string
    variants: Variant[]
    coverUrl: string | null
  }
  sizes: string[]
  colors: string[]
}

const formatPrice = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

// Stock "infinito" para productos con ignoreStock activo (el tenant no controla
// stock por unidad — ej: mayoristas que fabrican a pedido). Se usa un número
// grande en vez de Infinity porque Infinity no sobrevive JSON.stringify
// (se convierte en null) y el carrito persiste en localStorage.
const UNLIMITED_STOCK = 999999

const COLOR_MAP: Record<string, string> = {
  negro: '#1C1C1C', blanco: '#F5F5F0', crema: '#F0EBE1', beige: '#D4C5A9',
  marfil: '#FFFFF0', gris: '#9E9E9E', 'gris claro': '#D0D0D0', 'gris oscuro': '#555555',
  rojo: '#C0392B', bordo: '#7B2D42', vino: '#6B2737', rosa: '#E8A0B0',
  coral: '#E8714A', naranja: '#E8813A', mostaza: '#C8A84B', amarillo: '#F0CC4A',
  azul: '#3A7BC8', 'azul marino': '#1B3A6B', 'azul claro': '#7EB8E0', celeste: '#87CEEB',
  verde: '#4A9B6F', 'verde oscuro': '#2D6A4F', esmeralda: '#2E8B6E', turquesa: '#3AADA8',
  lila: '#B09BC8', violeta: '#8E44AD', morado: '#6C3483',
  camel: '#C19A6B', tabaco: '#8B6355', chocolate: '#5C3A1E', tiza: '#E8E4DC',
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

export default function AddToCartButton({ product, sizes, colors, showPrices = true, ignoreStock = false, isWholesale = false, minQty = 1 }: AddToCartButtonProps) {
  const { addItem, items: cartItems } = useCart()
  const [selectedSize, setSelectedSize] = useState<string | null>(sizes[0] ?? null)
  const [selectedColor, setSelectedColor] = useState<string | null>(colors[0] ?? null)
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const [stockError, setStockError] = useState<string | null>(null)

  function getVariantStock(size: string | null, color: string | null): number {
    const v = product.variants.find(v => {
      const sm = sizes.length === 0 || v.size === size
      const cm = colors.length === 0 || v.color === color
      return sm && cm
    })
    return v?.stock ?? 0
  }

  function isSizeAvailable(size: string): boolean {
    if (ignoreStock) return true
    if (colors.length === 0) return getVariantStock(size, null) > 0
    if (selectedColor) return getVariantStock(size, selectedColor) > 0
    return colors.some(c => getVariantStock(size, c) > 0)
  }

  function isColorAvailable(color: string): boolean {
    if (ignoreStock) return true
    if (sizes.length === 0) return getVariantStock(null, color) > 0
    if (selectedSize) return getVariantStock(selectedSize, color) > 0
    return sizes.some(s => getVariantStock(s, color) > 0)
  }

  const selectedVariant = product.variants.find(v => {
    const sizeMatch = sizes.length === 0 || v.size === selectedSize
    const colorMatch = colors.length === 0 || v.color === selectedColor
    return sizeMatch && colorMatch
  })

  // Hex real guardado para un color — busca cualquier variante con ese nombre
  // que tenga color_hex seteado; si no hay ninguna (variante vieja, previa a
  // esta funcionalidad), se deriva del nombre por fuzzy-match como antes.
  function getVariantColorHex(colorName: string): string {
    const withHex = product.variants.find(v => v.color === colorName && v.color_hex)
    return withHex?.color_hex || getColorHex(colorName)
  }

  const retailRule = selectedVariant?.price_rules?.find(p => p.type === 'retail' && p.active)
  const retailRegular = retailRule?.price
  const retailRebajado = (retailRule?.compare_at_price ?? 0) > 0 && (retailRule?.compare_at_price ?? 0) < (retailRegular ?? Infinity)
    ? retailRule!.compare_at_price! : undefined
  const retailPrice = retailRebajado ?? retailRegular
  const wholesalePrice = isWholesale
    ? selectedVariant?.price_rules?.find(p => p.type === 'wholesale' && p.active)
    : undefined
  const inStock = ignoreStock || (selectedVariant?.stock ?? 0) > 0

  // El mínimo (tanto para precio mayorista como para el piso de compra) se
  // exige por ARTÍCULO, sumando todas las variantes (talle/color) de este
  // mismo producto que ya están en el carrito — no por variante exacta.
  const sameProductQtyInCart = cartItems
    .filter(i => i.productId === product.id)
    .reduce((sum, i) => sum + i.quantity, 0)
  const projectedQty = sameProductQtyInCart + quantity

  const effectivePrice = wholesalePrice && projectedQty >= wholesalePrice.min_qty
    ? wholesalePrice.price
    : (retailPrice ?? (isWholesale ? wholesalePrice?.price : undefined) ?? 0)

  const priceType: 'retail' | 'wholesale' = wholesalePrice && projectedQty >= wholesalePrice.min_qty
    ? 'wholesale' : 'retail'

  function handleAddToCart() {
    if (!selectedVariant || !effectivePrice) return
    const maxStock = selectedVariant.stock ?? 0
    if (!ignoreStock) {
      if (maxStock === 0) return
      if (quantity > maxStock) {
        setStockError(maxStock === 1 ? 'Solo queda 1 unidad disponible' : `Solo quedan ${maxStock} unidades disponibles`)
        return
      }
    }
    const composedVariantId = `${selectedVariant.id}__${selectedSize ?? ''}__${selectedColor ?? ''}`
    // El mínimo por artículo NO bloquea el agregado individual — se permite
    // sumar de a poco distintos talles/colores del mismo producto. El total
    // se valida más adelante, en el carrito / checkout (ver useCartValidation).
    // Si el tenant ignora stock, el carrito no debe heredar el stock real
    // (puede ser 0 para productos hechos a pedido) — CartContext descarta
    // silenciosamente cualquier ítem con stock <= 0, lo que hacía que
    // "Agregar al carrito" no hiciera nada para estos productos.
    const cartStock = ignoreStock ? UNLIMITED_STOCK : maxStock
    addItem({
      // Clave compuesta para que distintos color/talle sean items separados en el carrito
      // incluso si comparten el mismo ID de variante en la DB (ej: productos WooCommerce)
      variantId: composedVariantId,
      productId: product.id,
      productName: product.name,
      variantDesc: [selectedSize, selectedColor].filter(Boolean).join(' / '),
      size: selectedSize ?? '',
      color: selectedColor ?? '',
      colorHex: selectedColor ? getVariantColorHex(selectedColor) : undefined,
      price: effectivePrice,
      priceType,
      imageUrl: product.coverUrl,
      quantity,
      stock: cartStock,
      minQty,
    })
    setAdded(true)
    setStockError(null)
    setTimeout(() => setAdded(false), 2000)
  }

  return (
    <div className="space-y-6">

      {colors.length > 0 && (
        <div>
          <p className="text-xs tracking-[0.15em] uppercase text-[var(--color-stone)] mb-3">
            Color:{' '}
            <span className="normal-case font-light text-[var(--color-charcoal)]">
              {selectedColor}
            </span>
          </p>
          <div className="flex gap-2.5 flex-wrap">
            {colors.map(color => {
              const hex = getVariantColorHex(color)
              const light = isLight(hex)
              const selected = selectedColor === color
              const available = isColorAvailable(color)
              return (
                <button
                  key={color}
                  onClick={() => { if (available) { setSelectedColor(color); setStockError(null) } }}
                  title={available ? color : `${color} - sin stock`}
                  disabled={!available}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', backgroundColor: hex,
                    border: selected ? '2px solid var(--color-charcoal)' : light ? '1px solid #D0CBC3' : '1px solid transparent',
                    outline: selected ? '2px solid white' : 'none',
                    outlineOffset: -4,
                    cursor: available ? 'pointer' : 'not-allowed',
                    opacity: available ? 1 : 0.35,
                    transition: 'transform 0.15s',
                    transform: selected ? 'scale(1.15)' : 'scale(1)',
                    flexShrink: 0,
                    position: 'relative',
                  }}
                >
                  {!available && (
                    <span style={{
                      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, color: light ? '#666' : '#fff', fontWeight: 300,
                    }}>x</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {sizes.length > 0 && (
        <div>
          <p className="text-xs tracking-[0.15em] uppercase text-[var(--color-stone)] mb-3">Talle</p>
          <div className="flex gap-2 flex-wrap">
            {sizes.map(size => {
              const available = isSizeAvailable(size)
              return (
                <button
                  key={size}
                  onClick={() => { if (available) { setSelectedSize(size); setStockError(null) } }}
                  disabled={!available}
                  className={`h-9 px-3 text-xs font-light border transition-colors rounded-sm relative ${
                    selectedSize === size
                      ? 'border-[var(--color-charcoal)] bg-[var(--color-charcoal)] text-white'
                      : available
                      ? 'border-[var(--color-border)] text-[var(--color-charcoal)] hover:border-[var(--color-charcoal)]'
                      : 'border-[var(--color-border)] text-[var(--color-stone)]/40 cursor-not-allowed line-through'
                  }`}
                >
                  {size}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs tracking-[0.15em] uppercase text-[var(--color-stone)] mb-3">
          Cantidad
          {minQty > 1 && (
            <span className="normal-case font-light text-[var(--color-stone)]">
              {' '}· mínimo {minQty} por artículo (combinando talles/colores)
              {sameProductQtyInCart > 0 ? ` — ya tenés ${sameProductQtyInCart} en el carrito` : ''}
            </span>
          )}
        </p>
        <div className="flex items-center border border-[var(--color-border)] w-fit">
          <button
            onClick={() => { setQuantity(q => Math.max(1, q - 1)); setStockError(null) }}
            className="w-10 h-10 flex items-center justify-center text-[var(--color-charcoal)] hover:bg-[var(--color-border)] transition-colors"
          >
            -
          </button>
          <span className="w-12 text-center text-sm font-light">{quantity}</span>
          <button
            onClick={() => {
              const maxStock = selectedVariant?.stock ?? 0
              if (!ignoreStock && quantity >= maxStock) {
                setStockError(maxStock === 1 ? 'Solo queda 1 unidad disponible' : `Solo quedan ${maxStock} unidades disponibles`)
              } else {
                setQuantity(q => q + 1)
                setStockError(null)
              }
            }}
            className="w-10 h-10 flex items-center justify-center text-[var(--color-charcoal)] hover:bg-[var(--color-border)] transition-colors"
          >
            +
          </button>
        </div>
        {stockError && (
          <p className="mt-2 text-xs text-amber-600">{stockError}</p>
        )}
      </div>

      {!inStock && !ignoreStock && (
        <p className="text-xs text-[var(--color-stone)] tracking-wide">Sin stock disponible</p>
      )}

      <button
        onClick={handleAddToCart}
        disabled={!selectedVariant || !inStock || !effectivePrice}
        className={`w-full py-4 text-xs tracking-[0.2em] uppercase font-medium transition-all duration-300 flex items-center justify-center gap-3 ${
          added
            ? 'bg-[var(--color-stone)] text-white cursor-default'
            : (!inStock && !ignoreStock)
            ? 'bg-[var(--color-border)] text-[var(--color-stone)] cursor-not-allowed opacity-60'
            : 'bg-[var(--color-charcoal)] text-white hover:bg-[var(--color-stone)] disabled:opacity-40 disabled:cursor-not-allowed'
        }`}
      >
        {added ? (
          <>
            <Check size={16} strokeWidth={1.5} />
            Agregado al carrito
          </>
        ) : (!inStock && !ignoreStock) ? (
          'Sin stock'
        ) : (
          <>
            <ShoppingBag size={16} strokeWidth={1.5} />
            {showPrices && effectivePrice ? `Agregar al carrito - ${formatPrice(effectivePrice * quantity)}` : 'Agregar al carrito'}
          </>
        )}
      </button>

    </div>
  )
}
