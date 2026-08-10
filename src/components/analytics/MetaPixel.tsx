// Instala el Meta Pixel (Facebook) leyendo store_config.meta_pixel_id.
// Mismo criterio que GoogleAnalytics.tsx: select propio y aislado, nunca via
// FUNCTIONAL_FIELDS/getStoreData — así esta columna nunca puede afectar
// footer/logo de las 6 tiendas (ver incidente 2026-08-03 en store-data.ts).
//
// Fase 1 a propósito: solo instala el pixel base (PageView automático). No
// dispara eventos de ecommerce (AddToCart, Purchase con valor real) — eso
// requeriría tocar CarritoPage/CheckoutPage, que se dejó afuera para no
// arriesgar el flujo de pago real. Si el tenant quiere retargeting/eventos
// de compra, puede cargar su propio GTM y armarlo él mismo (o su Community
// Manager) sin que Gounuri tenga que tocar el checkout.
//
// Uso en cada template:
//   import MetaPixel from '@creart/tienda-core/MetaPixel'
//   <MetaPixel />

import Script from 'next/script'
import { createServerSupabase, getTenantId } from '../../lib/supabase-server'

export default async function MetaPixel() {
  let pixelId: string | null = null

  try {
    const supabase = await createServerSupabase()
    const { data } = await supabase
      .from('store_config')
      .select('meta_pixel_id')
      .eq('tenant_id', getTenantId())
      .maybeSingle()
    pixelId = (data as any)?.meta_pixel_id?.trim() || null
  } catch {
    return null
  }

  if (!pixelId) return null

  return (
    <>
      <Script id="meta-pixel-init" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${pixelId}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          alt=""
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  )
}
