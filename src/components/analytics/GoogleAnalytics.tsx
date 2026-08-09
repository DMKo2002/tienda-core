// Inyecta el snippet de Google Analytics 4 (gtag.js) en el storefront, usando
// el Measurement ID que el tenant cargó desde Panel Admin > Configuración >
// Google Analytics (store_config.ga4_measurement_id, ver
// migracion_ga4_store_config.sql).
//
// Server component, mismo criterio que buildStoreMetadata en ./lib/seo.ts:
// select propio y aislado (no via getStoreData/FUNCTIONAL_FIELDS) para que un
// problema con esta única columna nunca pueda tirar abajo footer/logo de las
// 6 tiendas a la vez (ver incidente 2026-08-03 documentado en store-data.ts).
// Si el tenant todavía no cargó su Measurement ID, o la consulta falla por
// cualquier motivo, no renderiza nada — no hay tracking a medias ni error
// visible en la tienda pública.
//
// Uso en cada template:
//   // src/app/layout.tsx
//   import GoogleAnalytics from '@creart/tienda-core/GoogleAnalytics'
//   ...
//   <body>
//     {children}
//     <GoogleAnalytics />
//   </body>

import Script from 'next/script'
import { createServerSupabase, getTenantId } from '../../lib/supabase-server'

export default async function GoogleAnalytics() {
  let measurementId: string | null = null

  try {
    const supabase = await createServerSupabase()
    const { data } = await supabase
      .from('store_config')
      .select('ga4_measurement_id')
      .eq('tenant_id', getTenantId())
      .maybeSingle()
    measurementId = (data as any)?.ga4_measurement_id?.trim() || null
  } catch {
    return null
  }

  if (!measurementId) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  )
}
