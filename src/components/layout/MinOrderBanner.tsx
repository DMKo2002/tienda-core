'use client'

// Cartel global y sutil con el pedido mínimo de la tienda, cuando el tenant
// lo activa desde Panel Admin > General (toggle debajo del campo "Pedido
// mínimo"). Va FIJO arriba de todo (por encima del navbar, que en los 6
// templates es <header className="fixed top-0 ..."> y por lo tanto no
// respeta el flujo normal del documento — ponerlo en el flujo antes de
// {children} lo dejaba tapado/superpuesto por el navbar en vez de empujarlo
// hacia abajo, que era el bug reportado el 2026-08-04).
//
// Para que el navbar se corra hacia abajo sin tener que tocar el Navbar.tsx
// particular de cada template, este componente mide su propia altura y la
// publica en la variable CSS --announcement-h del <html>; el navbar de cada
// template lee esa variable en su propio `top` (ver Navbar.tsx: cambiaron
// top-0 por top-[var(--announcement-h,0px)]). Con el cartel oculto la
// variable queda en 0px y el navbar se comporta exactamente igual que antes.
import { useEffect, useRef, useState } from 'react'
import { createClient, TENANT_ID } from '../../lib/supabase'

const formatPrice = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

export default function MinOrderBanner() {
  const [amount, setAmount] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('store_config')
      .select('min_order_amount, show_min_order_banner')
      .eq('tenant_id', TENANT_ID())
      .single()
      .then(({ data }) => {
        const conf = data as any
        if (conf?.show_min_order_banner && conf?.min_order_amount) {
          setAmount(conf.min_order_amount)
        }
      })
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (amount && ref.current) {
      root.style.setProperty('--announcement-h', `${ref.current.offsetHeight}px`)
    } else {
      root.style.setProperty('--announcement-h', '0px')
    }
    return () => { root.style.setProperty('--announcement-h', '0px') }
  }, [amount])

  if (!amount) return null

  return (
    <div
      ref={ref}
      className="fixed top-0 left-0 right-0 z-[60] w-full bg-[var(--color-charcoal)] text-white text-center text-[10px] tracking-[0.05em] py-1 px-4"
    >
      Pedido mínimo: {formatPrice(amount)}
    </div>
  )
}
