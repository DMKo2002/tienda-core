'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

// Estado compartido de "qué variante está mirando el cliente" dentro de la
// ficha de producto.
//
// Hace falta porque el precio y el botón de compra son dos bloques separados
// del layout (el precio va arriba del título/separador, el botón abajo) pero
// tienen que hablar de la MISMA variante: antes el precio se renderizaba en
// el servidor con la primera variante del producto y se quedaba clavado ahí,
// así que elegir "Pack x5" cambiaba el precio del botón pero no el precio
// grande de arriba.

interface VariantSelection {
  selectedSize: string | null
  setSelectedSize: (s: string | null) => void
  selectedColor: string | null
  setSelectedColor: (c: string | null) => void
}

const VariantSelectionContext = createContext<VariantSelection | null>(null)

interface ProviderProps {
  sizes?: string[]
  colors?: string[]
  children: ReactNode
}

export function VariantSelectionProvider({ sizes = [], colors = [], children }: ProviderProps) {
  const [selectedSize, setSelectedSize] = useState<string | null>(sizes[0] ?? null)
  const [selectedColor, setSelectedColor] = useState<string | null>(colors[0] ?? null)

  return (
    <VariantSelectionContext.Provider
      value={{ selectedSize, setSelectedSize, selectedColor, setSelectedColor }}>
      {children}
    </VariantSelectionContext.Provider>
  )
}

// Devuelve null si no hay provider — así AddToCartButton puede seguir usándose
// suelto (con su propio estado interno) sin romperse.
export function useVariantSelection(): VariantSelection | null {
  return useContext(VariantSelectionContext)
}

// Criterio único para resolver qué variante corresponde a una selección.
// Lo comparten el precio y el botón de compra, así no pueden desincronizarse
// por tener cada uno su propia versión del matcheo.
export function findVariantFor<T extends { size: string | null; color: string | null }>(
  variants: T[],
  sizes: string[],
  colors: string[],
  size: string | null,
  color: string | null,
): T | undefined {
  return variants.find(v => {
    const sizeMatch = sizes.length === 0 || v.size === size
    const colorMatch = colors.length === 0 || v.color === color
    return sizeMatch && colorMatch
  })
}
