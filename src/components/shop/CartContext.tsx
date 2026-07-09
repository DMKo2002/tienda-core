'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

export interface CartItem {
  variantId: string
  productId: string
  productName: string
  variantDesc: string
  size: string
  color: string
  price: number
  priceType: 'retail' | 'wholesale'
  imageUrl: string | null
  quantity: number
  stock: number
}

interface CartContextType {
  items: CartItem[]
  count: number
  total: number
  addItem: (item: CartItem) => void
  removeItem: (variantId: string) => void
  updateQuantity: (variantId: string, qty: number) => void
  clearCart: () => void
}

const CartContext = createContext<CartContextType | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])

  // Cargar desde localStorage al iniciar
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cart')
      if (saved) {
        const parsed = JSON.parse(saved) as CartItem[]
        // Filtrar items inválidos (sin precio, sin stock, o sin cantidad)
        const valid = parsed.filter(i => i.price > 0 && i.quantity > 0 && i.stock > 0)
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
            ? { ...i, quantity: newQty }
            : i
        )
      }
      return [...prev, { ...newItem, quantity: Math.min(newItem.quantity, newItem.stock) }]
    })
  }, [])

  const removeItem = useCallback((variantId: string) => {
    setItems(prev => prev.filter(i => i.variantId !== variantId))
  }, [])

  const updateQuantity = useCallback((variantId: string, qty: number) => {
    if (qty <= 0) {
      setItems(prev => prev.filter(i => i.variantId !== variantId))
    } else {
      setItems(prev => prev.map(i => i.variantId === variantId ? { ...i, quantity: qty } : i))
    }
  }, [])

  const clearCart = useCallback(() => setItems([]), [])

  const count = items.reduce((acc, i) => acc + i.quantity, 0)
  const total = items.reduce((acc, i) => acc + i.price * i.quantity, 0)
