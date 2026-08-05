'use client'

// Cartel global y sutil con el pedido mínimo de la tienda, cuando el tenant
// lo activa desde Panel Admin > General (toggle debajo del campo "Pedido
// mínimo"). A diferencia de CookieBanner (fixed, overlay, se cierra), este
// va en el flujo normal del documento arriba de {children} en el layout —
// no tapa nada, no hace falta cerrarlo, y no compite con el navbar sticky
// de cada template (que vive dentro de {children}, no acá).
import { useEffect, useState } from 'react'
import { createClient, TENANT_ID } from '../../lib/supabase'

const formatPrice = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

export default function MinOrderBanner() {
  const [amount, setAmount] = useState<number | null>(null)

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

  if (!amount) return null

  return (
    <div className="w-full bg-[var(--color-charcoal)] text-white text-center text-[11px] tracking-[0.05em] py-1.5 px-4">
      Pedido mínimo: {formatPrice(amount)}
    </div>
  )
}
