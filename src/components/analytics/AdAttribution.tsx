'use client'

// Captura utm_source/utm_medium/utm_campaign de la URL cuando alguien entra
// desde un anuncio, y los guarda en una cookie propia (primera parte, nunca
// de terceros) por 30 dias. Sirve para saber, cuando esa persona compra, si
// vino de un anuncio pago -- sin depender de la API de ningun proveedor de
// ads (Meta/Google/TikTok). Se lee del lado del servidor en crear-pedido.ts
// al crear el pedido.
//
// Mismo criterio que MetaPixel.tsx/GoogleAdsTag.tsx: aislado, fire-and-forget,
// nunca puede lanzar ni afectar la navegacion. A diferencia de esos, no pega
// a Supabase -- es puramente client-side, mas simple y sin nada que romper.
//
// "Ultimo click gana": si la persona entra por un anuncio, se va, y vuelve
// despues por otro anuncio distinto, se pisa la cookie con la atribucion
// mas reciente. Es el criterio mas simple y el mas comun en herramientas de
// este tipo.
//
// Uso en cada template (en el layout, junto a los otros tags de analytics):
//   import AdAttribution from '@creart/tienda-core/AdAttribution'
//   <AdAttribution />

import { useEffect } from 'react'

export const AD_ATTRIBUTION_COOKIE = 'gounuri_attr'
const MAX_AGE_DAYS = 30

export default function AdAttribution() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const source = params.get('utm_source')
      if (!source) return // sin utm_source no hay nada que atribuir

      const attribution = {
        utm_source: source.slice(0, 100),
        utm_medium: params.get('utm_medium')?.slice(0, 100) || null,
        utm_campaign: params.get('utm_campaign')?.slice(0, 100) || null,
      }

      const value = encodeURIComponent(JSON.stringify(attribution))
      const maxAge = MAX_AGE_DAYS * 24 * 60 * 60
      document.cookie = `${AD_ATTRIBUTION_COOKIE}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`
    } catch {
      // Fire-and-forget a proposito: un error aca nunca debe afectar la
      // navegacion ni el resto de la pagina.
    }
  }, [])

  return null
}
