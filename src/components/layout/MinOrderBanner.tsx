'use client'

// Cartel sutil de pedido mínimo — SOLO para la página /tienda (catálogo),
// se monta ahí explícitamente en vez de vivir en el layout raíz (así no
// aparece en checkout, cuenta, políticas, etc.). Se oculta apenas se
// scrollea (igual que "aparece arriba del buscador, desaparece al bajar"),
// y mientras está visible corre el navbar hacia abajo publicando su altura
// en --announcement-h (que Navbar.tsx lee en su propio `top`, ver
// tienda-core/../Navbar — cambiaron top-0 por top-[var(--announcement-h,0px)]).
// Con el cartel oculto la variable vuelve a 0px y el navbar recupera el
// top-0 original.
import { useEffect, useRef, useState } from 'react'
import { createClient, TENANT_ID } from '../../lib/supabase'

const formatPrice = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

export default function MinOrderBanner() {
  const [amount, setAmount] = useState<number | null>(null)
  const [scrolled, setScrolled] = useState(false)
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
    const onScroll = () => setScrolled(window.scrollY > 10)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const visible = !!amount && !scrolled

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--announcement-h', visible && ref.current ? `${ref.current.offsetHeight}px` : '0px')
    return () => { root.style.setProperty('--announcement-h', '0px') }
  }, [visible])

  if (!amount) return null

  return (
    <div
      ref={ref}
      className={`fixed top-0 left-0 right-0 z-[60] w-full bg-[var(--color-charcoal)] text-white text-center text-[10px] tracking-[0.05em] py-1 px-4 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
      }`}
    >
      Pedido mínimo: {formatPrice(amount)}
    </div>
  )
}
