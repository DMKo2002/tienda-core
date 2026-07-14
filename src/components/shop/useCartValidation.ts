'use client'

import { useCart } from './CartContext'

export interface UnmetProduct {
  productId: string
  productName: string
  have: number
  need: number
}

export interface CartValidation {
  /** Cuántos items fueron descartados al cargar desde localStorage (sin stock / sin precio) */
  removedCount: number
  /** true si el carrito tiene items con precio válido y cumple el monto mínimo y los mínimos por artículo */
  canCheckout: boolean
  /** true si el tenant tiene monto mínimo configurado */
  hasMin: boolean
  /** true si el total supera el mínimo (o no hay mínimo) */
  meetsMin: boolean
  /** cuánto falta para el mínimo */
  remaining: number
  /** progreso hacia el mínimo, 0–100 */
  progress: number
  /** true si todos los productos cumplen su mínimo por artículo (sumando talles/colores) */
  meetsProductMinimums: boolean
  /** productos que todavía no llegan a su mínimo por artículo */
  unmetProducts: UnmetProduct[]
}

export function useCartValidation(minOrder: number | null): CartValidation {
  const { items, total, removedOnLoad } = useCart()

  const hasMin = (minOrder ?? 0) > 0
  const meetsMin = !hasMin || total >= minOrder!

  // El mínimo de unidades por producto se exige por ARTÍCULO, sumando todas
  // las variantes (talle/color) de un mismo producto presentes en el
  // carrito — no por variante individual.
  const byProduct = new Map<string, { qty: number; minQty: number; productName: string }>()
  for (const item of items) {
    const entry = byProduct.get(item.productId) ?? { qty: 0, minQty: item.minQty ?? 1, productName: item.productName }
    entry.qty += item.quantity
    entry.minQty = Math.max(entry.minQty, item.minQty ?? 1)
    byProduct.set(item.productId, entry)
  }
  const unmetProducts: UnmetProduct[] = Array.from(byProduct.entries())
    .filter(([, v]) => v.minQty > 1 && v.qty < v.minQty)
    .map(([productId, v]) => ({ productId, productName: v.productName, have: v.qty, need: v.minQty - v.qty }))
  const meetsProductMinimums = unmetProducts.length === 0

  const canCheckout = total > 0 && meetsMin && meetsProductMinimums
  const remaining = hasMin ? Math.max(0, minOrder! - total) : 0
  const progress = hasMin ? Math.min(100, (total / minOrder!) * 100) : 100

  return { removedCount: removedOnLoad, canCheckout, hasMin, meetsMin, remaining, progress, meetsProductMinimums, unmetProducts }
}
