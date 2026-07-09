'use client'

import { useCart } from './CartContext'

export interface CartValidation {
  /** Cuántos items fueron descartados al cargar desde localStorage (sin stock / sin precio) */
  removedCount: number
  /** true si el carrito tiene items con precio válido y cumple el monto mínimo */
  canCheckout: boolean
  /** true si el tenant tiene monto mínimo configurado */
  hasMin: boolean
  /** true si el total supera el mínimo (o no hay mínimo) */
  meetsMin: boolean
  /** cuánto falta para el mínimo */
  remaining: number
  /** progreso hacia el mínimo, 0–100 */
  progress: number
}

export function useCartValidation(minOrder: number | null): CartValidation {
  const { total, removedOnLoad } = useCart()

  const hasMin = (minOrder ?? 0) > 0
  const meetsMin = !hasMin || total >= minOrder!
  const canCheckout = total > 0 && meetsMin
  const remaining = hasMin ? Math.max(0, minOrder! - total) : 0
  const progress = hasMin ? Math.min(100, (total / minOrder!) * 100) : 100

  return { removedCount: removedOnLoad, canCheckout, hasMin, meetsMin, remaining, progress }
}
