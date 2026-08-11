// Helper "fire and forget" para eventos de ecommerce de Meta Pixel
// (ViewContent, AddToCart, InitiateCheckout, Purchase).
//
// Reglas duras, no negociables:
// - Nunca puede lanzar ni bloquear el flujo de compra. Si algo falla (fbq no
//   cargó porque el tenant no tiene Meta Pixel ID cargado, un adblocker lo
//   frenó, el script todavía no llegó, etc.) simplemente no hace nada.
// - No depende de que MetaPixel.tsx haya corrido: si fbq no existe en
//   `window`, es un no-op silencioso — así este helper se puede llamar desde
//   cualquier componente sin chequear antes si el tenant tiene el pixel
//   configurado.
//
// Uso:
//   import { trackMetaEvent } from '../../lib/meta-pixel-events'
//   trackMetaEvent('AddToCart', { content_ids: [product.id], value: 1000, currency: 'ARS' })

export type MetaEventName = 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase'

export interface MetaEventParams {
  content_ids?: string[]
  content_type?: 'product'
  content_name?: string
  value?: number
  currency?: string
  num_items?: number
}

export function trackMetaEvent(event: MetaEventName, params?: MetaEventParams): void {
  try {
    if (typeof window === 'undefined') return
    const fbq = (window as any).fbq
    if (typeof fbq !== 'function') return
    fbq('track', event, params ?? {})
  } catch {
    // Fire-and-forget a propósito: un error de tracking nunca debe afectar
    // el carrito, el checkout ni el pago.
  }
}
