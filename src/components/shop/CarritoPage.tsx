'use client'

import { useCart } from './CartContext'
import { useCartValidation } from './useCartValidation'
import Link from 'next/link'
import { Trash2, ArrowLeft, ImageOff } from 'lucide-react'
import { useEffect, useState, ComponentType } from 'react'
import { createClient, TENANT_ID } from '../../lib/supabase'

const formatPrice = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

interface Branding {
  storeName: string
  logoUrl?: string
  whatsapp?: string
  email?: string
  instagramUrl?: string
  facebookUrl?: string
  tiktokUrl?: string
  branches?: any[]
}

export interface CarritoPageProps {
  /** Navbar propio del template (mismo diseño que usa el resto del sitio) */
  Navbar: ComponentType<any>
  /** Footer propio del template */
  Footer: ComponentType<any>
  shopHref?: string
  checkoutHref?: string
}

/**
 * Página de Carrito compartida entre todos los templates.
 * Navbar/Footer se inyectan como props para preservar el diseño de cada
 * template — pero toda la lógica (carga del carrito, monto mínimo, datos
 * del tenant para el footer) vive acá, centralizada.
 */
export default function CarritoPage({ Navbar, Footer, shopHref = '/tienda', checkoutHref = '/checkout' }: CarritoPageProps) {
  const { items, total, removeItem, updateQuantity, count } = useCart()
  const [minOrder, setMinOrder] = useState<number | null>(null)
  const [branding, setBranding] = useState<Branding>({ storeName: 'Tienda' })

  useEffect(() => {
    const supabase = createClient()
    const tenantId = TENANT_ID()

    supabase
      .from('store_config')
      .select('min_order_amount, logo_url, whatsapp_number, notification_email, instagram_url, facebook_url, tiktok_url, branches')
      .eq('tenant_id', tenantId)
      .single()
      .then(({ data }) => {
        const conf = data as any
        setMinOrder(conf?.min_order_amount ?? null)
        setBranding(b => ({
          ...b,
          logoUrl: conf?.logo_url ?? undefined,
          whatsapp: conf?.whatsapp_number ?? '',
          email: conf?.notification_email ?? '',
          instagramUrl: conf?.instagram_url ?? undefined,
          facebookUrl: conf?.facebook_url ?? undefined,
          tiktokUrl: conf?.tiktok_url ?? undefined,
          branches: conf?.branches ?? [],
        }))
      })

    supabase
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .single()
      .then(({ data }) => {
        if (data?.name) setBranding(b => ({ ...b, storeName: data.name }))
      })
  }, [])

  const { removedCount, canCheckout, hasMin, meetsMin, remaining, progress } = useCartValidation(minOrder)

  return (
    <>
      <Navbar
        storeName={branding.storeName}
        logoUrl={branding.logoUrl}
        instagramUrl={branding.instagramUrl}
        facebookUrl={branding.facebookUrl}
        tiktokUrl={branding.tiktokUrl}
      />

      <main className="pt-28 min-h-screen">
        <div className="max-w-5xl mx-auto px-6 py-12">

          {/* Header */}
          <div className="flex items-center gap-4 mb-12">
            <Link href={shopHref} className="text-[var(--color-stone)] hover:text-[var(--color-charcoal)] transition-colors">
              <ArrowLeft size={20} strokeWidth={1.5} />
            </Link>
            <div>
              <h1 className="font-display text-4xl font-light text-[var(--color-charcoal)]">Carrito</h1>
              <p className="text-sm text-[var(--color-stone)] mt-0.5 font-light">
                {count} {count === 1 ? 'producto' : 'productos'}
              </p>
            </div>
          </div>

          {removedCount > 0 && (
            <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
              {removedCount === 1
                ? 'Se eliminó 1 producto sin stock del carrito.'
                : `Se eliminaron ${removedCount} productos sin stock del carrito.`}
            </div>
          )}

          {items.length === 0 ? (
            <div className="py-24 text-center">
              <p className="font-display text-3xl font-light text-[var(--color-stone)] mb-6">Tu carrito está vacío</p>
              <Link
                href={shopHref}
                className="inline-flex items-center gap-2 text-xs tracking-[0.2em] uppercase border-b border-[var(--color-charcoal)] pb-1 text-[var(--color-charcoal)] hover:text-[var(--color-stone)] hover:border-[var(--color-stone)] transition-colors"
              >
                Ir a la tienda
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

              {/* Items */}
              <div className="lg:col-span-2 space-y-6">
                {items.map(item => (
                  <div key={item.variantId} className="flex gap-5 pb-6 border-b border-[var(--color-border)]">

                    {/* Imagen */}
                    <div className="w-24 h-32 bg-[#F2EEE9] flex-shrink-0 overflow-hidden">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageOff size={20} className="text-[var(--color-border)]" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-light text-[var(--color-charcoal)] truncate">{item.productName}</p>
                      {item.colorHex !== undefined ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {item.color && (
                            <span
                              style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: item.colorHex, border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0, display: 'inline-block' }}
                              title={item.color}
                            />
                          )}
                          {item.size && <span className="text-xs text-[var(--color-stone)]">{item.size}</span>}
                        </div>
                      ) : item.variantDesc ? (
                        <p className="text-xs text-[var(--color-stone)] mt-0.5">{item.variantDesc}</p>
                      ) : null}
                      {item.priceType === 'wholesale' && (
                        <span className="inline-block mt-1 text-[10px] tracking-wider uppercase bg-[#F2EEE9] text-[var(--color-stone)] px-2 py-0.5">
                          Precio mayorista
                        </span>
                      )}

                      <div className="flex items-center justify-between mt-4">
                        {/* Cantidad */}
                        <div className="flex items-center border border-[var(--color-border)]">
                          <button
                            onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                            className="w-8 h-8 flex items-center justify-center text-[var(--color-charcoal)] hover:bg-[var(--color-border)] transition-colors text-sm"
                          >
                            −
                          </button>
                          <span className="w-8 text-center text-sm font-light">{item.quantity}</span>
                          <button
                            onClick={() => {
                              if (item.quantity < (item.stock ?? Infinity)) {
                                updateQuantity(item.variantId, item.quantity + 1)
                              }
                            }}
                            disabled={item.quantity >= (item.stock ?? Infinity)}
                            className="w-8 h-8 flex items-center justify-center text-[var(--color-charcoal)] hover:bg-[var(--color-border)] transition-colors text-sm disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>

                        <div className="flex items-center gap-4">
                          <p className="text-sm font-light text-[var(--color-charcoal)]">
                            {formatPrice(item.price * item.quantity)}
                          </p>
                          <button
                            onClick={() => removeItem(item.variantId)}
                            className="text-[var(--color-border)] hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={15} strokeWidth={1.5} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Resumen */}
              <div className="lg:col-span-1">
                <div className="bg-[#F2EEE9] p-6 sticky top-28">
                  <p className="text-xs tracking-[0.2em] uppercase text-[var(--color-stone)] mb-6">
                    Resumen del pedido
                  </p>

                  <div className="space-y-3 mb-6">
                    {items.map(item => (
                      <div key={item.variantId} className="flex justify-between text-sm font-light">
                        <span className="text-[var(--color-stone)] truncate mr-2">
                          {item.productName} ×{item.quantity}
                        </span>
                        <span className="text-[var(--color-charcoal)] flex-shrink-0">
                          {formatPrice(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-[var(--color-border)] pt-4 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs tracking-[0.15em] uppercase text-[var(--color-charcoal)]">Total</span>
                      <span className="font-display text-2xl font-light text-[var(--color-charcoal)]">
                        {formatPrice(total)}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-stone)] mt-1">Envío calculado al finalizar</p>
                  </div>

                  {/* Barra de progreso hacia el mínimo */}
                  {hasMin && (
                    <div className="mb-5">
                      <div className="w-full h-0.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--color-charcoal)] transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-[var(--color-stone)] mt-2">
                        {meetsMin
                          ? '✓ Pedido mínimo alcanzado'
                          : `Agregá ${formatPrice(remaining)} más para continuar`
                        }
                      </p>
                    </div>
                  )}

                  {canCheckout ? (
                    <Link
                      href={checkoutHref}
                      className="block w-full py-4 bg-[var(--color-charcoal)] text-white text-xs tracking-[0.2em] uppercase text-center hover:bg-[var(--color-stone)] transition-colors"
                    >
                      Finalizar compra
                    </Link>
                  ) : (
                    <div>
                      <div className="w-full py-4 bg-[var(--color-border)] text-[var(--color-stone)] text-xs tracking-[0.2em] uppercase text-center cursor-not-allowed">
                        Finalizar compra
                      </div>
                      {hasMin && !meetsMin && (
                        <p className="text-[10px] text-[var(--color-stone)] text-center mt-2">
                          Mínimo de compra: {formatPrice(minOrder!)}
                        </p>
                      )}
                    </div>
                  )}

                  <Link
                    href={shopHref}
                    className="block w-full py-3 text-center text-xs tracking-[0.15em] uppercase text-[var(--color-stone)] hover:text-[var(--color-charcoal)] transition-colors mt-3"
                  >
                    Seguir comprando
                  </Link>
                </div>
              </div>

            </div>
          )}
        </div>
      </main>

      <Footer
        storeName={branding.storeName}
        logoUrl={branding.logoUrl}
        whatsapp={branding.whatsapp}
        email={branding.email}
        instagramUrl={branding.instagramUrl}
        facebookUrl={branding.facebookUrl}
        tiktokUrl={branding.tiktokUrl}
        branches={branding.branches}
      />
    </>
  )
}
