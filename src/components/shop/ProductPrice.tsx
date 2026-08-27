'use client'

import { useVariantSelection, findVariantFor } from './VariantSelectionContext'

// Precio de la ficha de producto. Sigue a la variante que el cliente tiene
// elegida (via VariantSelectionProvider) en vez de quedarse clavado en la
// primera variante del producto, que es lo que pasaba cuando este bloque se
// renderizaba en el servidor.

interface Variant {
  size: string | null
  color: string | null
  price_rules: { type: string; price: number; compare_at_price?: number; min_qty: number; active: boolean }[]
}

interface Props {
  variants: Variant[]
  sizes: string[]
  colors: string[]
  showPrices: boolean
  isWholesaleUser: boolean
  isRetailUser: boolean
  priceVisibility?: string
}

const formatPrice = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

export default function ProductPrice({
  variants, sizes, colors, showPrices, isWholesaleUser, isRetailUser, priceVisibility,
}: Props) {
  const selection = useVariantSelection()

  // Sin provider (o antes de que el cliente toque nada) cae en la primera
  // variante, que es exactamente el comportamiento anterior.
  const selected = selection
    ? findVariantFor(variants, sizes, colors, selection.selectedSize, selection.selectedColor) ?? variants[0]
    : variants[0]

  const retailRule = selected?.price_rules?.find(p => p.type === 'retail' && p.active)
  const wholesaleRule = selected?.price_rules?.find(p => p.type === 'wholesale' && p.active)

  const retailRegular = retailRule?.price
  const retailRebajado =
    (retailRule?.compare_at_price ?? 0) > 0 && (retailRule?.compare_at_price ?? 0) < (retailRegular ?? Infinity)
      ? retailRule?.compare_at_price
      : undefined
  const retailPrice = retailRebajado ?? retailRegular
  const retailCompareAt = retailRebajado ? retailRegular : undefined

  return (
    <div className="mb-8">
      {showPrices ? (
        <>
          {retailPrice ? (
            <div>
              <p className="text-2xl font-light text-[var(--color-charcoal)]">
                {formatPrice(retailPrice)}
              </p>
              {retailCompareAt && (
                <p className="text-sm text-[var(--color-stone)] line-through mt-0.5">
                  {formatPrice(retailCompareAt)}
                </p>
              )}
            </div>
          ) : !(isWholesaleUser && wholesaleRule) ? (
            <p className="text-sm text-[var(--color-stone)]">
              Producto solo por mayor
            </p>
          ) : null}
          {isWholesaleUser && wholesaleRule && (
            <p className="text-sm text-[var(--color-stone)] mt-1">
              Precio mayorista: {formatPrice(wholesaleRule.price)}
            </p>
          )}
        </>
      ) : isRetailUser ? (
        <p className="text-sm text-[var(--color-stone)]">
          Necesitás una cuenta mayorista para ver el precio
        </p>
      ) : (
        <a
          href="/cuenta/login"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-stone)] hover:text-[var(--color-charcoal)] transition-colors underline"
        >
          {priceVisibility === 'wholesale_only'
            ? 'Precio disponible solo para mayoristas'
            : 'Iniciá sesión para ver el precio'}
        </a>
      )}
    </div>
  )
}
