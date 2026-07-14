'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

export interface CartItem {
  variantId: string
  productId: string
  productName: string
  variantDesc: string
  size: string
  color: string
  colorHex?: string
  price: number
  priceType: 'retail' | 'wholesale'
  imageUrl: string | null
  quantity: number
  stock: number
  minQty?: number
}

interface CartContextType {
  items: CartItem[]
  count: number
  total: number
  removedOnLoad: number
  addItem: (item: CartItem) => void
  removeItem: (variantId: string) => void
  updateQuantity: (variantId: string, qty: number) => void
  clearCart: () => void
}

const CartContext = createContext<CartContextType | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [removedOnLoad, setRemovedOnLoad] = useState(0)

  // Cargar desde localStorage al iniciar
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cart')
      if (saved) {
        const parsed = JSON.parse(saved) as CartItem[]
        // Filtrar items inválidos (sin precio, sin stock, o sin cantidad)
        const valid = parsed.filter(i => i.price > 0 && i.quantity > 0 && i.stock > 0)
        setRemovedOnLoad(parsed.length - valid.length)
        setItems(valid)
      }
    } catch {}
  }, [])

  // Guardar en localStorage cuando cambia
  useEffect(() => {
    try {
      localStorage.setItem('cart', JSON.stringify(items))
    } catch {}
  }, [items])

  const addItem = useCallback((newItem: CartItem) => {
    // Nunca agregar items sin precio o sin stock
    if (newItem.price <= 0 || newItem.stock <= 0) return
    setItems(prev => {
      const existing = prev.find(i => i.variantId === newItem.variantId)
      if (existing) {
        const newQty = Math.min(existing.quantity + newItem.quantity, newItem.stock)
        return prev.map(i =>
          i.variantId === newItem.variantId
            ? { ...i, quantity: newQty, minQty: newItem.minQty ?? i.minQty }
            : i
        )
      }
      return [...prev, { ...newItem, quantity: Math.min(newItem.quantity, newItem.stock) }]
    })
  }, [])

  const removeItem = useCallback((variantId: string) => {
    setItems(prev => prev.filter(i => i.variantId !== variantId))
  }, [])

  // El mínimo se exige por PRODUCTO (sumando todas las variantes de
  // talle/color de ese mismo artículo en el carrito), no por variante
  // individual — si otras variantes del mismo producto ya cubren el mínimo,
  // esta puede bajar hasta 1. O se saca el ítem del carrito por completo
  // (qty <= 0), o se respeta ese piso calculado.
  const updateQuantity = useCallback((variantId: string, qty: number) => {
    setItems(prev => {
      const target = prev.find(i => i.variantId === variantId)
      if (!target) return prev
      if (qty <= 0) {
        return prev.filter(i => i.variantId !== variantId)
      }
      const minQty = target.minQty ?? 1
      const otherSameProductQty = prev
        .filter(i => i.productId === target.productId && i.variantId !== variantId)
        .reduce((sum, i) => sum + i.quantity, 0)
      const floor = minQty > 1 ? Math.max(1, minQty - otherSameProductQty) : 1
      return prev.map(i => i.variantId === variantId ? { ...i, quantity: Math.max(qty, floor) } : i)
    })
  }, [])

  const clearCart = useCallback(() => setItems([]), [])

  const count = items.reduce((acc, i) => acc + i.quantity, 0)
  const total = items.reduce((acc, i) => acc + i.price * i.quantity, 0)

  return (
    <CartContext.Provider value={{ items, count, total, removedOnLoad, addItem, removeItem, updateQuantity, clearCart }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart debe usarse dentro de CartProvider')
  return ctx
}
