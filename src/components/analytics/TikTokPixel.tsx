// Instala el TikTok Pixel leyendo store_config.tiktok_pixel_id.
// Mismo criterio que MetaPixel.tsx y GoogleAdsTag.tsx: select propio y
// aislado, solo instala el pixel base (PageView automático vía ttq.page()),
// sin eventos de ecommerce con valor real — ver nota en MetaPixel.tsx.
//
// Uso en cada template:
//   import TikTokPixel from '@creart/tienda-core/TikTokPixel'
//   <TikTokPixel />

import Script from 'next/script'
import { createServerSupabase, getTenantId } from '../../lib/supabase-server'

export default async function TikTokPixel() {
  let pixelId: string | null = null

  try {
    const supabase = await createServerSupabase()
    const { data } = await supabase
      .from('store_config')
      .select('tiktok_pixel_id')
      .eq('tenant_id', getTenantId())
      .maybeSingle()
    pixelId = (data as any)?.tiktok_pixel_id?.trim() || null
  } catch {
    return null
  }

  if (!pixelId) return null

  return (
    <Script id="tiktok-pixel-init" strategy="afterInteractive">
      {`
        !function (w, d, t) {
          w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<e.length;n++)e.methods[n];return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=i+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
          ttq.load('${pixelId}');
          ttq.page();
        }(window, document, 'ttq');
      `}
    </Script>
  )
}
