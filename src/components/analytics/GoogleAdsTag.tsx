// Instala la etiqueta de Google Ads (gtag.js) leyendo store_config.google_ads_id.
// Va como componente propio y separado de GoogleAnalytics.tsx a propósito:
// aunque ambos usan gtag.js, mantenerlos aislados evita tocar el componente
// de GA4 que ya está en producción — el costo es un segundo <script> de
// Google (gtag.js se cachea entre dominios, así que el impacto real es
// mínimo), a cambio de cero riesgo sobre lo que ya funciona.
//
// Fase 1 a propósito: solo instala la base (sin conversion label ni evento
// de compra con valor real) — ver la nota igual en MetaPixel.tsx sobre por
// qué no se toca CheckoutPage en esta etapa.
//
// Uso en cada template:
//   import GoogleAdsTag from '@creart/tienda-core/GoogleAdsTag'
//   <GoogleAdsTag />

import Script from 'next/script'
import { createServerSupabase, getTenantId } from '../../lib/supabase-server'

export default async function GoogleAdsTag() {
  let adsId: string | null = null

  try {
    const supabase = await createServerSupabase()
    const { data } = await supabase
      .from('store_config')
      .select('google_ads_id')
      .eq('tenant_id', getTenantId())
      .maybeSingle()
    adsId = (data as any)?.google_ads_id?.trim() || null
  } catch {
    return null
  }

  if (!adsId) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${adsId}`}
        strategy="afterInteractive"
      />
      <Script id="google-ads-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${adsId}');
        `}
      </Script>
    </>
  )
}
